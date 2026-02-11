import { Bot, Context, InlineKeyboard } from "grammy";
import { invokeLLM } from "./_core/llm";
import { generateImage } from "./_core/imageGeneration";
import { storagePut } from "./storage";
import {
  getSetting, setSetting, getArticles, getArticleByFilename,
  upsertArticle, deleteArticle, getArticleStats,
} from "./db";

// ─── Constants ───
const MAX_CONTEXT_MESSAGES = 20;
const MAX_TOOL_ITERATIONS = 5;
const FETCH_TIMEOUT_MS = 30000;
const TG_MAX_MESSAGE_LENGTH = 4000;
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_MESSAGES = 10; // max messages per window
const CONTEXT_TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_CACHED_USERS = 500;

// ─── Fetch with timeout ───
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Escape LIKE wildcards ───
export function escapeLikePattern(input: string): string {
  return input.replace(/%/g, "\\%").replace(/_/g, "\\_");
}

// ─── Sanitize tool arguments from LLM ───
export function sanitizeToolArgs(args: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === "string") sanitized[key] = value.slice(0, 50000);
    else if (typeof value === "number") sanitized[key] = Math.min(Math.max(value, 0), 1000);
    else if (typeof value === "boolean") sanitized[key] = value;
    // Ignore arrays, objects, etc. for safety
  }
  return sanitized;
}

// ─── Split long messages for Telegram ───
export function splitMessage(text: string, maxLen = TG_MAX_MESSAGE_LENGTH): string[] {
  if (text.length <= maxLen) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      parts.push(remaining);
      break;
    }
    let splitIdx = remaining.lastIndexOf("\n", maxLen);
    if (splitIdx < maxLen * 0.3) splitIdx = maxLen;
    parts.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx);
  }
  return parts;
}

// ─── Sanitize error messages before sending to user ───
function sanitizeErrorForUser(error: any): string {
  const msg = error?.message || "Неизвестная ошибка";
  // Strip sensitive info: connection strings, file paths, stack traces
  const sanitized = msg
    .replace(/mysql:\/\/[^\s]+/gi, "[DB_URL]")
    .replace(/\/home\/[^\s]+/g, "[PATH]")
    .replace(/at\s+\S+\s+\(\S+:\d+:\d+\)/g, "")
    .replace(/Bearer\s+\S+/gi, "Bearer [TOKEN]")
    .slice(0, 200);
  return sanitized;
}

// ─── Rate limiter per user ───
const rateLimitMap = new Map<number, number[]>();

function isRateLimited(userId: number): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) || [];
  // Remove expired entries
  const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  rateLimitMap.set(userId, valid);
  if (valid.length >= RATE_LIMIT_MAX_MESSAGES) return true;
  valid.push(now);
  return false;
}

// ─── Per-user conversation context with TTL ───
interface UserContext {
  messages: Array<{ role: string; content: string; tool_call_id?: string; tool_calls?: any[] }>;
  lastActivity: number;
}

const userContexts = new Map<number, UserContext>();

// Periodic cleanup of stale contexts
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startContextCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [userId, ctx] of Array.from(userContexts.entries())) {
      if (now - ctx.lastActivity > CONTEXT_TTL_MS) {
        userContexts.delete(userId);
      }
    }
    // Also clean rate limit map
    for (const [userId, timestamps] of Array.from(rateLimitMap.entries())) {
      const valid = timestamps.filter((t: number) => now - t < RATE_LIMIT_WINDOW_MS);
      if (valid.length === 0) rateLimitMap.delete(userId);
      else rateLimitMap.set(userId, valid);
    }
  }, 5 * 60 * 1000); // every 5 minutes
}

function stopContextCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

function getUserContext(telegramUserId: number): Array<{ role: string; content: string; tool_call_id?: string; tool_calls?: any[] }> {
  // Enforce max cached users
  if (!userContexts.has(telegramUserId) && userContexts.size >= MAX_CACHED_USERS) {
    // Evict oldest entry
    let oldestKey: number | null = null;
    let oldestTime = Infinity;
    for (const [key, val] of Array.from(userContexts.entries())) {
      if (val.lastActivity < oldestTime) {
        oldestTime = val.lastActivity;
        oldestKey = key;
      }
    }
    if (oldestKey !== null) userContexts.delete(oldestKey);
  }

  if (!userContexts.has(telegramUserId)) {
    userContexts.set(telegramUserId, { messages: [], lastActivity: Date.now() });
  }
  const ctx = userContexts.get(telegramUserId)!;
  ctx.lastActivity = Date.now();
  return ctx.messages;
}

function clearUserContext(telegramUserId: number) {
  userContexts.set(telegramUserId, { messages: [], lastActivity: Date.now() });
}

// ─── Allowed Telegram user IDs (from env) ───
function getAllowedUserIds(): number[] {
  const envVal = process.env.TELEGRAM_ALLOWED_USERS || "";
  if (!envVal) return [];
  return envVal.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id));
}

export function isUserAllowed(userId: number): boolean {
  const allowed = getAllowedUserIds();
  if (allowed.length === 0) return true;
  return allowed.includes(userId);
}

// ─── Tool definitions for the LLM ───
const TOOLS_DEFINITION = [
  {
    type: "function" as const,
    function: {
      name: "list_articles",
      description: "Получить список статей блога с возможностью поиска по заголовку или тегам.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Поисковый запрос" },
          limit: { type: "number", description: "Максимальное количество (по умолчанию 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_article",
      description: "Получить полное содержимое статьи по имени файла.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "Имя файла статьи" },
        },
        required: ["filename"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_article",
      description: "Создать новую статью на Hugo-блоге.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Заголовок статьи" },
          content: { type: "string", description: "Содержимое в Markdown" },
          description: { type: "string", description: "Краткое описание для SEO" },
          tags: { type: "string", description: "Теги через запятую" },
          categories: { type: "string", description: "Категории через запятую" },
          draft: { type: "boolean", description: "Черновик (true) или публикация (false)" },
        },
        required: ["title", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "edit_article",
      description: "Редактировать существующую статью.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "Имя файла статьи" },
          title: { type: "string", description: "Новый заголовок" },
          content: { type: "string", description: "Новое содержимое" },
          description: { type: "string", description: "Новое описание" },
          tags: { type: "string", description: "Новые теги" },
          categories: { type: "string", description: "Новые категории" },
          draft: { type: "boolean", description: "Черновик или публикация" },
        },
        required: ["filename"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_article",
      description: "Удалить статью из блога. Необратимое действие.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "Имя файла статьи" },
        },
        required: ["filename"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "sync_articles",
      description: "Синхронизировать статьи с Hugo-блогом.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_stats",
      description: "Получить статистику блога.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_images",
      description: "Поиск бесплатных изображений в интернете.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Поисковый запрос на английском" },
          count: { type: "number", description: "Количество (по умолчанию 6)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_image",
      description: "Сгенерировать AI-изображение по описанию.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Описание изображения на английском" },
          style: { type: "string", description: "Стиль: realistic, illustration, digital-art" },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_settings",
      description: "Получить текущие настройки системы.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "save_settings",
      description: "Сохранить настройки подключения.",
      parameters: {
        type: "object",
        properties: {
          hugo_base_url: { type: "string", description: "URL Hugo API" },
          hugo_api_key: { type: "string", description: "API-ключ Hugo" },
          llm_endpoint: { type: "string", description: "URL LLM API" },
          llm_model: { type: "string", description: "Название модели" },
          llm_api_key: { type: "string", description: "API-ключ LLM" },
          llm_use_local: { type: "boolean", description: "Использовать локальную модель" },
        },
        required: [],
      },
    },
  },
];

// ─── Hugo config helper ───
async function getHugoConfig() {
  const baseUrl = (await getSetting("hugo_base_url") ?? "https://admin.nodkeys.com").replace(/\/+$/, "");
  const apiKey = await getSetting("hugo_api_key") ?? "";
  if (!apiKey) throw new Error("Hugo API key не настроен. Используйте /settings для настройки.");
  return { baseUrl, apiKey };
}

// ─── Tool execution engine ───
async function executeTool(name: string, args: Record<string, any>): Promise<{ result: string; metadata?: any }> {
  const safeArgs = sanitizeToolArgs(args);

  switch (name) {
    case "list_articles": {
      const searchTerm = safeArgs.search ? escapeLikePattern(safeArgs.search) : undefined;
      const { items, total } = await getArticles({ search: searchTerm, limit: safeArgs.limit || 10 });
      if (items.length === 0) return { result: "Статьи не найдены." };
      const list = items.map((a, i) => `${i + 1}. ${a.title} (${a.filename}) — ${a.draft ? "черновик" : "опубликована"}`).join("\n");
      return { result: `Найдено ${total} статей:\n\n${list}`, metadata: { type: "articles", items } };
    }

    case "get_article": {
      const article = await getArticleByFilename(safeArgs.filename);
      if (!article) return { result: `Статья "${safeArgs.filename}" не найдена.` };
      const content = article.content ? article.content.slice(0, 3000) : "(пусто)";
      return {
        result: `📄 ${article.title}\n\nФайл: ${article.filename}\nСтатус: ${article.draft ? "Черновик" : "Опубликована"}\nТеги: ${article.tags || "нет"}\nКатегории: ${article.categories || "нет"}\nОписание: ${article.description || "нет"}\n\n---\n\n${content}${article.content && article.content.length > 3000 ? "\n\n...(текст обрезан)" : ""}`,
        metadata: { type: "article", article },
      };
    }

    case "create_article": {
      try {
        const { baseUrl, apiKey } = await getHugoConfig();
        const res = await fetchWithTimeout(`${baseUrl}/api/posts/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
          body: JSON.stringify({
            title: safeArgs.title, content: safeArgs.content,
            description: safeArgs.description || "", tags: safeArgs.tags || "",
            categories: safeArgs.categories || "", draft: safeArgs.draft ?? false,
          }),
        });
        if (!res.ok) throw new Error(`Hugo API: ${res.status}`);
        const data = await res.json();
        await upsertArticle({
          filename: data.filename || data.slug || safeArgs.title.toLowerCase().replace(/\s+/g, "-"),
          title: safeArgs.title, slug: data.slug, description: safeArgs.description,
          content: safeArgs.content, tags: safeArgs.tags, categories: safeArgs.categories,
          draft: safeArgs.draft ?? false, hugoUrl: data.url, syncedAt: new Date(),
        });
        return { result: `✅ Статья "${safeArgs.title}" создана!` };
      } catch (e: any) {
        const filename = (safeArgs.title || "untitled").toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").replace(/-+/g, "-");
        await upsertArticle({
          filename, title: safeArgs.title || "Untitled", content: safeArgs.content,
          description: safeArgs.description, tags: safeArgs.tags, categories: safeArgs.categories,
          draft: true, syncedAt: new Date(),
        });
        return { result: `⚠️ Статья сохранена локально как черновик. Ошибка Hugo: ${sanitizeErrorForUser(e)}` };
      }
    }

    case "edit_article": {
      try {
        const { baseUrl, apiKey } = await getHugoConfig();
        const { filename, ...data } = safeArgs;
        const res = await fetchWithTimeout(`${baseUrl}/api/posts/edit/${encodeURIComponent(filename)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`Hugo API: ${res.status}`);
        const existing = await getArticleByFilename(filename);
        if (existing) {
          await upsertArticle({
            filename, title: data.title ?? existing.title,
            description: data.description ?? existing.description ?? undefined,
            content: data.content ?? existing.content ?? undefined,
            tags: data.tags ?? existing.tags ?? undefined,
            categories: data.categories ?? existing.categories ?? undefined,
            draft: data.draft ?? existing.draft ?? false, syncedAt: new Date(),
          });
        }
        return { result: `✅ Статья "${filename}" обновлена!` };
      } catch (e: any) {
        return { result: `❌ Ошибка редактирования: ${sanitizeErrorForUser(e)}` };
      }
    }

    case "delete_article": {
      try {
        const { baseUrl, apiKey } = await getHugoConfig();
        await fetchWithTimeout(`${baseUrl}/api/posts/delete/${encodeURIComponent(safeArgs.filename)}`, {
          method: "DELETE", headers: { "X-API-Key": apiKey },
        });
        await deleteArticle(safeArgs.filename);
        return { result: `🗑 Статья "${safeArgs.filename}" удалена.` };
      } catch (e: any) {
        return { result: `❌ Ошибка удаления: ${sanitizeErrorForUser(e)}` };
      }
    }

    case "sync_articles": {
      try {
        const { baseUrl, apiKey } = await getHugoConfig();
        const res = await fetchWithTimeout(`${baseUrl}/api/posts/list`, { headers: { "X-API-Key": apiKey } });
        if (!res.ok) throw new Error(`Hugo API: ${res.status}`);
        const posts = await res.json() as any[];
        let synced = 0;
        for (const post of posts) {
          await upsertArticle({
            filename: post.filename || post.slug || `post-${synced}`,
            title: post.title || "Untitled", slug: post.slug, description: post.description,
            content: post.content, tags: post.tags, categories: post.categories,
            draft: post.draft ?? false, hugoUrl: post.url, syncedAt: new Date(),
          });
          synced++;
        }
        return { result: `🔄 Синхронизация завершена! Загружено ${synced} статей.` };
      } catch (e: any) {
        return { result: `❌ Ошибка синхронизации: ${sanitizeErrorForUser(e)}` };
      }
    }

    case "get_stats": {
      const stats = await getArticleStats();
      return {
        result: `📊 Статистика блога:\n\n• Всего статей: ${stats.total}\n• Опубликовано: ${stats.published}\n• Черновиков: ${stats.drafts}`,
        metadata: { type: "stats", stats },
      };
    }

    case "search_images": {
      try {
        const count = Math.min(safeArgs.count || 6, 20);
        const unsplashKey = await getSetting("unsplash_api_key");
        const pixabayKey = await getSetting("pixabay_api_key");

        if (unsplashKey) {
          const res = await fetchWithTimeout(
            `https://api.unsplash.com/search/photos?query=${encodeURIComponent(safeArgs.query)}&per_page=${count}`,
            { headers: { Authorization: `Client-ID ${unsplashKey}` } }
          );
          if (!res.ok) throw new Error("Unsplash API error");
          const data = await res.json();
          const images = data.results.map((img: any) => ({
            url: img.urls.regular, thumb: img.urls.thumb,
            description: img.description || img.alt_description || safeArgs.query,
            author: img.user.name,
          }));
          return {
            result: `🖼 Найдено ${images.length} изображений по "${safeArgs.query}"`,
            metadata: { type: "images", images },
          };
        }

        if (pixabayKey) {
          const res = await fetchWithTimeout(
            `https://pixabay.com/api/?key=${encodeURIComponent(pixabayKey)}&q=${encodeURIComponent(safeArgs.query)}&per_page=${count}&image_type=photo`
          );
          if (!res.ok) throw new Error("Pixabay error");
          const data = await res.json();
          const images = data.hits.map((img: any) => ({
            url: img.largeImageURL, thumb: img.previewURL,
            description: img.tags, author: img.user,
          }));
          return { result: `🖼 Найдено ${images.length} изображений`, metadata: { type: "images", images } };
        }

        return { result: "⚠️ API-ключи для поиска изображений не настроены. Настройте через /settings или используйте генерацию AI-изображений." };
      } catch (e: any) {
        return { result: `❌ Ошибка поиска: ${sanitizeErrorForUser(e)}` };
      }
    }

    case "generate_image": {
      try {
        const fullPrompt = safeArgs.style ? `${safeArgs.prompt}, ${safeArgs.style} style` : safeArgs.prompt;
        const { url } = await generateImage({ prompt: fullPrompt });
        return {
          result: `🎨 Изображение сгенерировано!`,
          metadata: { type: "generated_image", url, prompt: safeArgs.prompt },
        };
      } catch (e: any) {
        return { result: `❌ Ошибка генерации: ${sanitizeErrorForUser(e)}` };
      }
    }

    case "get_settings": {
      const hugoUrl = await getSetting("hugo_base_url") ?? "не настроен";
      const hugoKey = await getSetting("hugo_api_key");
      const llmEndpoint = await getSetting("llm_endpoint") ?? "не настроен";
      const llmModel = await getSetting("llm_model") ?? "не настроена";
      const useLocal = await getSetting("llm_use_local") ?? "false";
      const unsplashKey = await getSetting("unsplash_api_key");
      const pixabayKey = await getSetting("pixabay_api_key");
      return {
        result: `⚙️ Настройки:\n\n🌐 Hugo API:\n• URL: ${hugoUrl}\n• Key: ${hugoKey ? "✅ настроен" : "❌ не настроен"}\n\n🤖 LLM:\n• Endpoint: ${llmEndpoint}\n• Модель: ${llmModel}\n• Локальная: ${useLocal === "true" ? "✅ вкл" : "❌ выкл"}\n\n🖼 Изображения:\n• Unsplash: ${unsplashKey ? "✅" : "❌"}\n• Pixabay: ${pixabayKey ? "✅" : "❌"}`,
      };
    }

    case "save_settings": {
      const saved: string[] = [];
      if (safeArgs.hugo_base_url) { await setSetting("hugo_base_url", safeArgs.hugo_base_url); saved.push("Hugo URL"); }
      if (safeArgs.hugo_api_key) { await setSetting("hugo_api_key", safeArgs.hugo_api_key); saved.push("Hugo API Key"); }
      if (safeArgs.llm_endpoint) { await setSetting("llm_endpoint", safeArgs.llm_endpoint); saved.push("LLM Endpoint"); }
      if (safeArgs.llm_model) { await setSetting("llm_model", safeArgs.llm_model); saved.push("LLM Model"); }
      if (safeArgs.llm_api_key) { await setSetting("llm_api_key", safeArgs.llm_api_key); saved.push("LLM API Key"); }
      if (safeArgs.llm_use_local !== undefined) { await setSetting("llm_use_local", safeArgs.llm_use_local ? "true" : "false"); saved.push("Use Local LLM"); }
      return { result: saved.length > 0 ? `✅ Обновлено: ${saved.join(", ")}` : "Нет данных для сохранения." };
    }

    default:
      return { result: `Неизвестный инструмент: ${name}` };
  }
}

// ─── LLM caller with local/built-in fallback ───
async function callLLM(
  messages: Array<{ role: string; content: string; tool_call_id?: string; tool_calls?: any[] }>,
  options?: { tools?: any[]; tool_choice?: "none" | "auto" | "required" }
): Promise<any> {
  const useLocal = await getSetting("llm_use_local");
  const localEndpoint = await getSetting("llm_endpoint");
  const localModel = await getSetting("llm_model");
  const localApiKey = await getSetting("llm_api_key");

  if (useLocal === "true" && localEndpoint) {
    const url = `${localEndpoint.replace(/\/+$/, "")}/v1/chat/completions`;
    const body: any = {
      model: localModel || "default",
      messages,
      max_tokens: 8192,
      temperature: 0.7,
    };
    if (options?.tools) { body.tools = options.tools; body.tool_choice = options.tool_choice || "auto"; }

    try {
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(localApiKey ? { Authorization: `Bearer ${localApiKey}` } : {}),
        },
        body: JSON.stringify(body),
      }, 60000);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn(`[LLM] Local model error ${res.status}: ${text}, falling back to built-in`);
      } else {
        return res.json();
      }
    } catch (e: any) {
      console.warn(`[LLM] Local model failed: ${e.message}, falling back to built-in`);
    }
  }

  return invokeLLM({
    messages: messages.map(m => ({
      role: m.role as any,
      content: m.content,
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
    })),
    ...(options?.tools ? { tools: options.tools, tool_choice: (options.tool_choice || "auto") as "auto" } : {}),
  });
}

// ─── System prompt ───
const SYSTEM_PROMPT = `Ты — AI-ассистент для управления Hugo-блогом через Telegram. Ты помогаешь пользователю управлять контентом.

Твои возможности:
1. Статьи: просмотр, создание, редактирование, удаление статей
2. AI-генерация: написание полных статей по теме с учётом существующего контента
3. AI-редактирование: улучшение, переписывание, расширение текста
4. SEO-оптимизация: мета-описания, теги, заголовки
5. Изображения: поиск фото и AI-генерация уникальных изображений
6. Настройки: конфигурация Hugo API и LLM

Правила:
- Отвечай на русском языке
- Используй инструменты для действий, не придумывай данные
- При создании статей пиши качественный Markdown-контент
- Перед удалением статьи уточняй у пользователя
- Если Hugo API не настроен, предложи настроить через save_settings
- Будь кратким — это Telegram, длинные сообщения неудобны
- Используй эмодзи для наглядности
- При генерации статей учитывай контекст существующих статей блога`;

// ─── Process message through LLM with tool calling ───
async function processMessage(userMessage: string, telegramUserId: number): Promise<{
  text: string;
  images?: Array<{ url: string; caption?: string }>;
}> {
  const context = getUserContext(telegramUserId);

  context.push({ role: "user", content: userMessage });

  // Keep context manageable
  while (context.length > MAX_CONTEXT_MESSAGES * 2) {
    context.shift();
  }

  const llmMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...context,
  ];

  let toolResults: Array<{ name: string; result: string; metadata?: any }> = [];
  let finalContent = "";
  let iterations = 0;
  let response: any;
  const images: Array<{ url: string; caption?: string }> = [];

  try {
    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      response = await callLLM(llmMessages, {
        tools: TOOLS_DEFINITION,
        tool_choice: "auto",
      });

      const choice = response.choices?.[0];
      if (!choice) break;

      const message = choice.message;

      if (message.tool_calls && message.tool_calls.length > 0) {
        llmMessages.push({
          role: "assistant",
          content: message.content || "",
          tool_calls: message.tool_calls,
        });

        for (const toolCall of message.tool_calls) {
          const fnName = toolCall.function.name;
          let fnArgs: Record<string, any> = {};
          try { fnArgs = JSON.parse(toolCall.function.arguments || "{}"); } catch { }

          const toolResult = await executeTool(fnName, fnArgs);
          toolResults.push({ name: fnName, ...toolResult });

          if (toolResult.metadata?.type === "images" && toolResult.metadata.images) {
            for (const img of toolResult.metadata.images.slice(0, 4)) {
              images.push({ url: img.url || img.thumb, caption: img.description });
            }
          }
          if (toolResult.metadata?.type === "generated_image" && toolResult.metadata.url) {
            images.push({ url: toolResult.metadata.url, caption: toolResult.metadata.prompt });
          }

          llmMessages.push({
            role: "tool",
            content: toolResult.result,
            tool_call_id: toolCall.id,
          });
        }
        continue;
      }

      finalContent = message.content || "";
      break;
    }

    if (!finalContent && response?.choices?.[0]?.message?.content) {
      finalContent = response.choices[0].message.content;
    }

    if (!finalContent) {
      finalContent = toolResults.length > 0
        ? toolResults.map(r => r.result).join("\n\n")
        : "Не удалось получить ответ. Попробуйте ещё раз.";
    }

    context.push({ role: "assistant", content: finalContent });

    return { text: finalContent, images };
  } catch (error: any) {
    const errorMsg = `❌ Ошибка AI: ${sanitizeErrorForUser(error)}`;
    context.push({ role: "assistant", content: errorMsg });
    return { text: errorMsg };
  }
}

// ─── Create and configure the Telegram bot ───
export function createTelegramBot(token: string): Bot {
  const bot = new Bot(token);

  // ─── Access check middleware for all commands ───
  function checkAccess(ctx: Context): boolean {
    return isUserAllowed(ctx.from?.id ?? 0);
  }

  // ─── /start command ───
  bot.command("start", async (ctx) => {
    if (!checkAccess(ctx)) {
      await ctx.reply("⛔ У вас нет доступа к этому боту.");
      return;
    }
    clearUserContext(ctx.from!.id);

    const keyboard = new InlineKeyboard()
      .text("📊 Статистика", "cmd_stats").text("📄 Статьи", "cmd_articles").row()
      .text("✍️ Написать статью", "cmd_write").text("🔄 Синхронизация", "cmd_sync").row()
      .text("🖼 Найти изображения", "cmd_images").text("🎨 Сгенерировать картинку", "cmd_genimg").row()
      .text("⚙️ Настройки", "cmd_settings").text("❓ Помощь", "cmd_help");

    await ctx.reply(
      "🤖 *AI Blog Bot*\n\n" +
      "Я помогу управлять вашим Hugo\\-блогом\\. Просто напишите мне что нужно сделать, или используйте кнопки ниже\\.\n\n" +
      "Примеры запросов:\n" +
      "• _Покажи список статей_\n" +
      "• _Напиши статью про AI в 2025_\n" +
      "• _Найди изображения для статьи о технологиях_\n" +
      "• _Сгенерируй обложку для блога_",
      { parse_mode: "MarkdownV2", reply_markup: keyboard }
    );
  });

  // ─── /help command (with access check) ───
  bot.command("help", async (ctx) => {
    if (!checkAccess(ctx)) {
      await ctx.reply("⛔ У вас нет доступа к этому боту.");
      return;
    }
    await ctx.reply(
      "📖 *Справка по командам*\n\n" +
      "/start \\- Главное меню\n" +
      "/articles \\- Список статей\n" +
      "/stats \\- Статистика блога\n" +
      "/sync \\- Синхронизация с Hugo\n" +
      "/settings \\- Настройки\n" +
      "/new \\- Новый контекст чата\n" +
      "/help \\- Эта справка\n\n" +
      "Или просто напишите запрос на естественном языке\\!",
      { parse_mode: "MarkdownV2" }
    );
  });

  // ─── /articles command ───
  bot.command("articles", async (ctx) => {
    if (!checkAccess(ctx)) return;
    await ctx.reply("⏳ Загружаю список статей...");
    const result = await processMessage("Покажи список всех статей", ctx.from!.id);
    for (const part of splitMessage(result.text)) {
      await ctx.reply(part);
    }
  });

  // ─── /stats command ───
  bot.command("stats", async (ctx) => {
    if (!checkAccess(ctx)) return;
    await ctx.reply("⏳ Загружаю статистику...");
    const result = await processMessage("Покажи статистику блога", ctx.from!.id);
    await ctx.reply(result.text);
  });

  // ─── /sync command ───
  bot.command("sync", async (ctx) => {
    if (!checkAccess(ctx)) return;
    await ctx.reply("🔄 Синхронизация с Hugo...");
    const result = await processMessage("Синхронизируй статьи с Hugo", ctx.from!.id);
    await ctx.reply(result.text);
  });

  // ─── /settings command ───
  bot.command("settings", async (ctx) => {
    if (!checkAccess(ctx)) return;
    const result = await processMessage("Покажи текущие настройки", ctx.from!.id);
    await ctx.reply(result.text);
  });

  // ─── /new command (clear context, with access check) ───
  bot.command("new", async (ctx) => {
    if (!checkAccess(ctx)) {
      await ctx.reply("⛔ У вас нет доступа к этому боту.");
      return;
    }
    clearUserContext(ctx.from!.id);
    await ctx.reply("🆕 Контекст очищен. Начинаем новый разговор!");
  });

  // ─── Inline keyboard callbacks (with access check) ───
  const callbackHandlers: Record<string, (ctx: Context) => Promise<void>> = {
    cmd_stats: async (ctx) => {
      await ctx.reply("⏳ Загружаю статистику...");
      const result = await processMessage("Покажи статистику блога", ctx.from!.id);
      await ctx.reply(result.text);
    },
    cmd_articles: async (ctx) => {
      await ctx.reply("⏳ Загружаю статьи...");
      const result = await processMessage("Покажи список статей", ctx.from!.id);
      for (const part of splitMessage(result.text)) {
        await ctx.reply(part);
      }
    },
    cmd_write: async (ctx) => {
      await ctx.reply("✍️ О чём написать статью? Напишите тему:");
    },
    cmd_sync: async (ctx) => {
      await ctx.reply("🔄 Синхронизация...");
      const result = await processMessage("Синхронизируй статьи с Hugo", ctx.from!.id);
      await ctx.reply(result.text);
    },
    cmd_images: async (ctx) => {
      await ctx.reply("🔍 Что искать? Напишите запрос для поиска изображений:");
    },
    cmd_genimg: async (ctx) => {
      await ctx.reply("🎨 Опишите изображение, которое нужно сгенерировать:");
    },
    cmd_settings: async (ctx) => {
      const result = await processMessage("Покажи настройки", ctx.from!.id);
      await ctx.reply(result.text);
    },
    cmd_help: async (ctx) => {
      await ctx.reply(
        "📖 Справка:\n\n" +
        "/start - Главное меню\n" +
        "/articles - Список статей\n" +
        "/stats - Статистика\n" +
        "/sync - Синхронизация\n" +
        "/settings - Настройки\n" +
        "/new - Новый контекст\n\n" +
        "Или просто напишите запрос!"
      );
    },
  };

  // Register all callback handlers with access check
  for (const [callbackData, handler] of Object.entries(callbackHandlers)) {
    bot.callbackQuery(callbackData, async (ctx) => {
      await ctx.answerCallbackQuery();
      if (!checkAccess(ctx)) {
        await ctx.reply("⛔ У вас нет доступа.");
        return;
      }
      try {
        await handler(ctx);
      } catch (error: any) {
        console.error(`[TG] Callback ${callbackData} error:`, error);
        await ctx.reply(`❌ Ошибка: ${sanitizeErrorForUser(error)}`);
      }
    });
  }

  // ─── Handle all text messages ───
  bot.on("message:text", async (ctx) => {
    if (!checkAccess(ctx)) {
      await ctx.reply("⛔ У вас нет доступа к этому боту.");
      return;
    }

    const userMessage = ctx.message.text;
    if (!userMessage || userMessage.startsWith("/")) return;

    // Rate limiting
    if (isRateLimited(ctx.from!.id)) {
      await ctx.reply("⏳ Слишком много сообщений. Подождите минуту перед следующим запросом.");
      return;
    }

    await ctx.replyWithChatAction("typing");

    try {
      const result = await processMessage(userMessage, ctx.from!.id);

      // Send images first if any
      if (result.images && result.images.length > 0) {
        for (const img of result.images.slice(0, 5)) {
          try {
            await ctx.replyWithPhoto(img.url, {
              caption: img.caption ? img.caption.slice(0, 200) : undefined,
            });
          } catch (imgErr: any) {
            console.warn(`[TG] Failed to send photo: ${imgErr.message}`);
          }
        }
      }

      // Send text response
      for (const part of splitMessage(result.text)) {
        try {
          await ctx.reply(part);
        } catch {
          await ctx.reply(part.replace(/[*_`\[\]]/g, ""));
        }
      }
    } catch (error: any) {
      console.error("[TG] Message processing error:", error);
      await ctx.reply(`❌ Произошла ошибка: ${sanitizeErrorForUser(error)}`);
    }
  });

  // ─── Handle photos — download to S3 instead of leaking bot token ───
  bot.on("message:photo", async (ctx) => {
    if (!checkAccess(ctx)) return;

    // Rate limiting
    if (isRateLimited(ctx.from!.id)) {
      await ctx.reply("⏳ Слишком много сообщений. Подождите минуту.");
      return;
    }

    const caption = ctx.message.caption || "Пользователь отправил изображение";
    await ctx.replyWithChatAction("typing");

    try {
      // Get the largest photo
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const file = await ctx.api.getFile(photo.file_id);

      // Download photo to buffer (avoid leaking bot token in URL)
      const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
      const response = await fetchWithTimeout(fileUrl);
      const buffer = Buffer.from(await response.arrayBuffer());

      // Upload to S3
      const ext = file.file_path?.split(".").pop() || "jpg";
      const s3Key = `telegram-uploads/${ctx.from!.id}-${Date.now()}.${ext}`;
      const { url: safeUrl } = await storagePut(s3Key, buffer, `image/${ext}`);

      const result = await processMessage(
        `${caption}\n\n[Пользователь прикрепил изображение: ${safeUrl}]`,
        ctx.from!.id
      );

      for (const part of splitMessage(result.text)) {
        await ctx.reply(part);
      }
    } catch (error: any) {
      console.error("[TG] Photo processing error:", error);
      await ctx.reply(`❌ Ошибка обработки изображения: ${sanitizeErrorForUser(error)}`);
    }
  });

  return bot;
}

// ─── Start the bot with graceful shutdown ───
export async function startTelegramBot(): Promise<Bot | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("[TG Bot] TELEGRAM_BOT_TOKEN not set, bot disabled");
    return null;
  }

  const bot = createTelegramBot(token);

  // Start context cleanup timer
  startContextCleanup();

  // Graceful shutdown handlers
  const shutdown = () => {
    console.log("[TG Bot] Shutting down gracefully...");
    stopContextCleanup();
    bot.stop();
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  // Start polling
  console.log("[TG Bot] Starting...");
  bot.start({
    onStart: (botInfo) => {
      console.log(`[TG Bot] Running as @${botInfo.username}`);
    },
  });

  return bot;
}
