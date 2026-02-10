import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { generateImage } from "../_core/imageGeneration";
import {
  getSetting, setSetting, getArticles, getArticleByFilename,
  upsertArticle, deleteArticle, getArticleStats,
  createConversation, getConversations, getConversation,
  updateConversationTitle, deleteConversation,
  addChatMessage, getConversationMessages,
  createAiGeneration, updateAiGeneration,
} from "../db";

// ─── Tool definitions for the LLM ───
const TOOLS_DEFINITION = [
  {
    type: "function" as const,
    function: {
      name: "list_articles",
      description: "Получить список статей блога с возможностью поиска. Используй для просмотра существующих статей, поиска по заголовку или тегам.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Поисковый запрос по заголовку или тегам" },
          limit: { type: "number", description: "Максимальное количество статей (по умолчанию 10)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_article",
      description: "Получить полное содержимое конкретной статьи по имени файла (filename). Используй для чтения, анализа или редактирования статьи.",
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
      description: "Создать новую статью на Hugo-блоге. Используй для публикации нового контента.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Заголовок статьи" },
          content: { type: "string", description: "Содержимое статьи в формате Markdown" },
          description: { type: "string", description: "SEO описание (макс 160 символов)" },
          tags: { type: "string", description: "Теги через запятую" },
          categories: { type: "string", description: "Категории через запятую" },
          draft: { type: "boolean", description: "Черновик (true) или опубликовать (false)" },
        },
        required: ["title", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "edit_article",
      description: "Редактировать существующую статью на Hugo-блоге. Можно изменить заголовок, содержимое, теги и другие поля.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "Имя файла статьи для редактирования" },
          title: { type: "string", description: "Новый заголовок" },
          content: { type: "string", description: "Новое содержимое в Markdown" },
          description: { type: "string", description: "Новое SEO описание" },
          tags: { type: "string", description: "Новые теги через запятую" },
          categories: { type: "string", description: "Новые категории" },
          draft: { type: "boolean", description: "Статус черновика" },
        },
        required: ["filename"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_article",
      description: "Удалить статью из Hugo-блога. ВНИМАНИЕ: действие необратимо.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "Имя файла статьи для удаления" },
        },
        required: ["filename"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "sync_articles",
      description: "Синхронизировать статьи из Hugo-блога в локальную базу данных. Используй для обновления списка статей.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_stats",
      description: "Получить статистику блога: общее количество статей, опубликованных и черновиков.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_images",
      description: "Поиск бесплатных изображений в интернете (Unsplash/Pixabay). Используй для подбора иллюстраций к статьям.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Поисковый запрос для изображений" },
          count: { type: "number", description: "Количество результатов (по умолчанию 6)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_image",
      description: "Сгенерировать уникальное изображение с помощью AI по текстовому описанию. Используй для создания обложек и иллюстраций.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Описание изображения для генерации (на английском для лучшего качества)" },
          style: { type: "string", description: "Стиль: realistic, illustration, digital-art, anime, photo" },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_settings",
      description: "Получить текущие настройки: Hugo API URL, LLM endpoint, модель. Используй для диагностики подключений.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "save_settings",
      description: "Сохранить настройки подключения к Hugo API или LLM. Используй для конфигурации системы.",
      parameters: {
        type: "object",
        properties: {
          hugo_base_url: { type: "string", description: "URL админ-панели Hugo (например https://admin.nodkeys.com)" },
          hugo_api_key: { type: "string", description: "API-ключ Hugo" },
          llm_endpoint: { type: "string", description: "URL OpenAI-совместимого API (например http://192.168.1.100:11434)" },
          llm_model: { type: "string", description: "Название модели (например llama3.2, mistral)" },
          llm_api_key: { type: "string", description: "API-ключ для LLM" },
          llm_use_local: { type: "boolean", description: "Использовать локальную модель (true/false)" },
        },
        required: [],
      },
    },
  },
];

// ─── Tool execution engine ───
async function executeTool(name: string, args: Record<string, any>): Promise<{ result: string; metadata?: any }> {
  switch (name) {
    case "list_articles": {
      const { items, total } = await getArticles({ search: args.search, limit: args.limit || 10 });
      if (items.length === 0) return { result: "Статьи не найдены. Попробуйте синхронизировать с Hugo командой или создать новую статью." };
      const list = items.map((a, i) => `${i + 1}. **${a.title}** (${a.filename}) — ${a.draft ? "черновик" : "опубликована"} | теги: ${a.tags || "нет"}`).join("\n");
      return { result: `Найдено ${total} статей:\n\n${list}`, metadata: { type: "articles", items } };
    }

    case "get_article": {
      const article = await getArticleByFilename(args.filename);
      if (!article) return { result: `Статья "${args.filename}" не найдена.` };
      return {
        result: `## ${article.title}\n\n**Файл:** ${article.filename}\n**Статус:** ${article.draft ? "Черновик" : "Опубликована"}\n**Теги:** ${article.tags || "нет"}\n**Категории:** ${article.categories || "нет"}\n**Описание:** ${article.description || "нет"}\n\n---\n\n${article.content || "(содержимое пусто)"}`,
        metadata: { type: "article", article },
      };
    }

    case "create_article": {
      try {
        const { baseUrl, apiKey } = await getHugoConfig();
        const res = await fetch(`${baseUrl}/api/posts/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
          body: JSON.stringify({
            title: args.title,
            content: args.content,
            description: args.description || "",
            tags: args.tags || "",
            categories: args.categories || "",
            draft: args.draft ?? false,
          }),
        });
        if (!res.ok) throw new Error(`Hugo API: ${res.status}`);
        const data = await res.json();
        await upsertArticle({
          filename: data.filename || data.slug || args.title.toLowerCase().replace(/\s+/g, "-"),
          title: args.title,
          slug: data.slug,
          description: args.description,
          content: args.content,
          tags: args.tags,
          categories: args.categories,
          draft: args.draft ?? false,
          hugoUrl: data.url,
          syncedAt: new Date(),
        });
        return { result: `Статья "${args.title}" успешно создана и опубликована на Hugo!${data.url ? `\n\nURL: ${data.url}` : ""}`, metadata: { type: "article_created", data } };
      } catch (e: any) {
        // Save locally even if Hugo fails
        const filename = args.title.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").replace(/-+/g, "-");
        await upsertArticle({
          filename,
          title: args.title,
          content: args.content,
          description: args.description,
          tags: args.tags,
          categories: args.categories,
          draft: true,
          syncedAt: new Date(),
        });
        return { result: `Статья "${args.title}" сохранена локально как черновик. Ошибка Hugo API: ${e.message}. Настройте Hugo API в настройках для публикации.` };
      }
    }

    case "edit_article": {
      try {
        const { baseUrl, apiKey } = await getHugoConfig();
        const { filename, ...data } = args;
        const res = await fetch(`${baseUrl}/api/posts/edit/${filename}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`Hugo API: ${res.status}`);
        const existing = await getArticleByFilename(filename);
        if (existing) {
          await upsertArticle({
            filename,
            title: data.title ?? existing.title,
            description: data.description ?? existing.description ?? undefined,
            content: data.content ?? existing.content ?? undefined,
            tags: data.tags ?? existing.tags ?? undefined,
            categories: data.categories ?? existing.categories ?? undefined,
            draft: data.draft ?? existing.draft ?? false,
            syncedAt: new Date(),
          });
        }
        return { result: `Статья "${filename}" успешно обновлена!` };
      } catch (e: any) {
        return { result: `Ошибка при редактировании "${args.filename}": ${e.message}` };
      }
    }

    case "delete_article": {
      try {
        const { baseUrl, apiKey } = await getHugoConfig();
        await fetch(`${baseUrl}/api/posts/delete/${args.filename}`, {
          method: "DELETE",
          headers: { "X-API-Key": apiKey },
        });
        await deleteArticle(args.filename);
        return { result: `Статья "${args.filename}" удалена.` };
      } catch (e: any) {
        return { result: `Ошибка при удалении: ${e.message}` };
      }
    }

    case "sync_articles": {
      try {
        const { baseUrl, apiKey } = await getHugoConfig();
        const res = await fetch(`${baseUrl}/api/posts/list`, {
          headers: { "X-API-Key": apiKey },
        });
        if (!res.ok) throw new Error(`Hugo API: ${res.status}`);
        const posts = await res.json() as any[];
        let synced = 0;
        for (const post of posts) {
          await upsertArticle({
            filename: post.filename || post.slug || `post-${synced}`,
            title: post.title || "Untitled",
            slug: post.slug,
            description: post.description,
            content: post.content,
            tags: post.tags,
            categories: post.categories,
            draft: post.draft ?? false,
            hugoUrl: post.url,
            syncedAt: new Date(),
          });
          synced++;
        }
        return { result: `Синхронизация завершена! Загружено ${synced} статей из Hugo.` };
      } catch (e: any) {
        return { result: `Ошибка синхронизации: ${e.message}. Проверьте настройки Hugo API.` };
      }
    }

    case "get_stats": {
      const stats = await getArticleStats();
      return {
        result: `📊 **Статистика блога:**\n\n- Всего статей: **${stats.total}**\n- Опубликовано: **${stats.published}**\n- Черновиков: **${stats.drafts}**`,
        metadata: { type: "stats", stats },
      };
    }

    case "search_images": {
      try {
        const count = args.count || 6;
        const res = await fetch(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(args.query)}&per_page=${count}`,
          { headers: { Authorization: "Client-ID 0_gL1FMO0V0OaEjttg7oZ_8ZLDWdYjPmPbRisTezXSo" } }
        );
        if (!res.ok) throw new Error("Unsplash API error");
        const data = await res.json();
        const images = data.results.map((img: any) => ({
          url: img.urls.regular,
          thumb: img.urls.thumb,
          small: img.urls.small,
          description: img.description || img.alt_description || "",
          author: img.user.name,
          markdown: `![${img.alt_description || args.query}](${img.urls.regular})`,
        }));
        const list = images.map((img: any, i: number) => `${i + 1}. ${img.description || "Изображение"} — автор: ${img.author}`).join("\n");
        return {
          result: `Найдено изображений по запросу "${args.query}":\n\n${list}\n\nДля вставки в статью используйте Markdown-код изображения.`,
          metadata: { type: "images", images },
        };
      } catch {
        try {
          const res = await fetch(
            `https://pixabay.com/api/?key=47566229-0e5c1f3b4e4b0c6d8f9a2e1d3&q=${encodeURIComponent(args.query)}&per_page=${args.count || 6}&image_type=photo`
          );
          if (!res.ok) throw new Error("Pixabay error");
          const data = await res.json();
          const images = data.hits.map((img: any) => ({
            url: img.largeImageURL,
            thumb: img.previewURL,
            small: img.webformatURL,
            description: img.tags,
            author: img.user,
            markdown: `![${img.tags}](${img.largeImageURL})`,
          }));
          const list = images.map((img: any, i: number) => `${i + 1}. ${img.description} — автор: ${img.author}`).join("\n");
          return { result: `Найдено изображений:\n\n${list}`, metadata: { type: "images", images } };
        } catch {
          return { result: "Не удалось найти изображения. Попробуйте другой запрос." };
        }
      }
    }

    case "generate_image": {
      try {
        const fullPrompt = args.style ? `${args.prompt}, ${args.style} style` : args.prompt;
        const { url } = await generateImage({ prompt: fullPrompt });
        return {
          result: `Изображение сгенерировано!\n\n![${args.prompt}](${url})\n\nMarkdown для вставки: \`![описание](${url})\``,
          metadata: { type: "generated_image", url, prompt: args.prompt },
        };
      } catch (e: any) {
        return { result: `Ошибка генерации изображения: ${e.message}` };
      }
    }

    case "get_settings": {
      const hugoUrl = await getSetting("hugo_base_url") ?? "не настроен";
      const hugoKey = await getSetting("hugo_api_key");
      const llmEndpoint = await getSetting("llm_endpoint") ?? "не настроен";
      const llmModel = await getSetting("llm_model") ?? "не настроена";
      const useLocal = await getSetting("llm_use_local") ?? "false";
      return {
        result: `**Текущие настройки:**\n\n**Hugo API:**\n- URL: ${hugoUrl}\n- API Key: ${hugoKey ? "настроен (***" + hugoKey.slice(-4) + ")" : "не настроен"}\n\n**LLM:**\n- Endpoint: ${llmEndpoint}\n- Модель: ${llmModel}\n- Локальная модель: ${useLocal === "true" ? "включена" : "выключена"}`,
      };
    }

    case "save_settings": {
      const saved: string[] = [];
      if (args.hugo_base_url) { await setSetting("hugo_base_url", args.hugo_base_url); saved.push("Hugo URL"); }
      if (args.hugo_api_key) { await setSetting("hugo_api_key", args.hugo_api_key); saved.push("Hugo API Key"); }
      if (args.llm_endpoint) { await setSetting("llm_endpoint", args.llm_endpoint); saved.push("LLM Endpoint"); }
      if (args.llm_model) { await setSetting("llm_model", args.llm_model); saved.push("LLM Model"); }
      if (args.llm_api_key) { await setSetting("llm_api_key", args.llm_api_key); saved.push("LLM API Key"); }
      if (args.llm_use_local !== undefined) { await setSetting("llm_use_local", args.llm_use_local ? "true" : "false"); saved.push("Use Local LLM"); }
      return { result: saved.length > 0 ? `Настройки обновлены: ${saved.join(", ")}` : "Нет данных для сохранения." };
    }

    default:
      return { result: `Неизвестный инструмент: ${name}` };
  }
}

// ─── Hugo config helper ───
async function getHugoConfig() {
  const baseUrl = (await getSetting("hugo_base_url") ?? "https://admin.nodkeys.com").replace(/\/+$/, "");
  const apiKey = await getSetting("hugo_api_key") ?? "";
  if (!apiKey) throw new Error("Hugo API key не настроен. Скажите мне URL и ключ Hugo API для настройки.");
  return { baseUrl, apiKey };
}

// ─── LLM caller with local/built-in fallback ───
async function callLLM(
  messages: Array<{ role: string; content: string }>,
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

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(localApiKey ? { Authorization: `Bearer ${localApiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(`[LLM] Local model error ${res.status}: ${text}, falling back to built-in`);
      // Fall through to built-in
    } else {
      return res.json();
    }
  }

  // Built-in Manus LLM
  return invokeLLM({
    messages: messages.map(m => ({ role: m.role as any, content: m.content })),
    ...(options?.tools ? { tools: options.tools, tool_choice: (options.tool_choice || "auto") as "auto" } : {}),
  });
}

// ─── System prompt ───
const SYSTEM_PROMPT = `Ты — AI-ассистент для управления Hugo-блогом. Ты помогаешь пользователю управлять контентом через чат.

Твои возможности:
1. **Статьи**: просмотр, создание, редактирование, удаление статей на Hugo-блоге
2. **AI-генерация**: написание полных статей по теме с учётом существующего контента
3. **AI-редактирование**: улучшение, переписывание, расширение, сокращение текста
4. **SEO-оптимизация**: генерация мета-описаний, тегов, заголовков
5. **Изображения**: поиск бесплатных фото и AI-генерация уникальных изображений
6. **Настройки**: конфигурация Hugo API и LLM

Правила:
- Отвечай на русском языке
- Используй инструменты для выполнения действий, не придумывай данные
- При создании статей пиши качественный, структурированный Markdown-контент
- При поиске изображений предлагай наиболее подходящие варианты
- Перед удалением статьи всегда уточняй у пользователя
- Если Hugo API не настроен, предложи настроить через save_settings
- Будь кратким в ответах, но информативным
- При генерации статей учитывай контекст существующих статей блога`;

// ─── Main chat router ───
export const chatRouter = router({
  // Conversation management
  listConversations: protectedProcedure.query(async ({ ctx }) => {
    return getConversations(ctx.user.id);
  }),

  createConversation: protectedProcedure
    .input(z.object({ title: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const id = await createConversation(ctx.user.id, input?.title);
      return { id };
    }),

  getConversation: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const conv = await getConversation(input.id);
      const messages = await getConversationMessages(input.id);
      return { conversation: conv, messages };
    }),

  deleteConversation: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteConversation(input.id);
      return { success: true };
    }),

  renameConversation: protectedProcedure
    .input(z.object({ id: z.number(), title: z.string() }))
    .mutation(async ({ input }) => {
      await updateConversationTitle(input.id, input.title);
      return { success: true };
    }),

  // Main chat endpoint with tool calling
  sendMessage: protectedProcedure
    .input(z.object({
      conversationId: z.number(),
      message: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Save user message
      await addChatMessage({
        conversationId: input.conversationId,
        role: "user",
        content: input.message,
      });

      // Get conversation history
      const history = await getConversationMessages(input.conversationId);
      const llmMessages: Array<{ role: string; content: string }> = [
        { role: "system", content: SYSTEM_PROMPT },
      ];

      // Add history (last 20 messages for context window)
      const recentHistory = history.slice(-20);
      for (const msg of recentHistory) {
        if (msg.role === "user" || msg.role === "assistant") {
          llmMessages.push({ role: msg.role, content: msg.content });
        }
      }

      // Call LLM with tools
      let response: any;
      let toolResults: Array<{ name: string; result: string; metadata?: any }> = [];
      let finalContent = "";
      let iterations = 0;
      const MAX_ITERATIONS = 5;

      try {
        while (iterations < MAX_ITERATIONS) {
          iterations++;
          response = await callLLM(llmMessages, {
            tools: TOOLS_DEFINITION,
            tool_choice: "auto",
          });

          const choice = response.choices?.[0];
          if (!choice) break;

          const message = choice.message;

          // Check for tool calls
          if (message.tool_calls && message.tool_calls.length > 0) {
            // Add assistant message with tool calls to context
            llmMessages.push({
              role: "assistant",
              content: message.content || "",
            });

            for (const toolCall of message.tool_calls) {
              const fnName = toolCall.function.name;
              let fnArgs: Record<string, any> = {};
              try {
                fnArgs = JSON.parse(toolCall.function.arguments || "{}");
              } catch { }

              // Execute tool
              const toolResult = await executeTool(fnName, fnArgs);
              toolResults.push({ name: fnName, ...toolResult });

              // Save tool call as message
              await addChatMessage({
                conversationId: input.conversationId,
                role: "tool",
                content: toolResult.result,
                toolName: fnName,
                toolResult: toolResult.result,
                metadata: toolResult.metadata ? JSON.stringify(toolResult.metadata) : undefined,
              });

              // Add tool result to LLM context
              llmMessages.push({
                role: "tool" as any,
                content: toolResult.result,
              });
            }

            // Continue loop to get final response after tool execution
            continue;
          }

          // No tool calls — this is the final response
          finalContent = message.content || "";
          break;
        }

        // If we exhausted iterations without final content, use last response
        if (!finalContent && response?.choices?.[0]?.message?.content) {
          finalContent = response.choices[0].message.content;
        }

        if (!finalContent) {
          finalContent = toolResults.length > 0
            ? toolResults.map(r => r.result).join("\n\n")
            : "Не удалось получить ответ от AI. Попробуйте ещё раз.";
        }

        // Save assistant response
        const allMetadata = toolResults.length > 0
          ? JSON.stringify(toolResults.map(r => r.metadata).filter(Boolean))
          : undefined;

        await addChatMessage({
          conversationId: input.conversationId,
          role: "assistant",
          content: finalContent,
          metadata: allMetadata,
        });

        // Auto-title conversation if it's the first exchange
        if (history.length <= 1) {
          const title = input.message.slice(0, 60) + (input.message.length > 60 ? "..." : "");
          await updateConversationTitle(input.conversationId, title);
        }

        return {
          content: finalContent,
          toolResults,
        };
      } catch (error: any) {
        const errorMsg = `Ошибка AI: ${error.message}. Попробуйте ещё раз или проверьте настройки LLM.`;
        await addChatMessage({
          conversationId: input.conversationId,
          role: "assistant",
          content: errorMsg,
        });
        return { content: errorMsg, toolResults: [] };
      }
    }),

  // Quick settings (no conversation needed)
  getSettings: protectedProcedure.query(async () => {
    const hugoUrl = await getSetting("hugo_base_url") ?? "";
    const hugoKey = await getSetting("hugo_api_key") ?? "";
    const llmEndpoint = await getSetting("llm_endpoint") ?? "";
    const llmModel = await getSetting("llm_model") ?? "";
    const useLocal = await getSetting("llm_use_local") ?? "false";
    return {
      hugoUrl,
      hugoKeySet: !!hugoKey,
      llmEndpoint,
      llmModel,
      useLocal: useLocal === "true",
    };
  }),

  saveSettings: protectedProcedure
    .input(z.object({
      hugoUrl: z.string().optional(),
      hugoKey: z.string().optional(),
      llmEndpoint: z.string().optional(),
      llmModel: z.string().optional(),
      llmApiKey: z.string().optional(),
      useLocal: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      if (input.hugoUrl !== undefined) await setSetting("hugo_base_url", input.hugoUrl);
      if (input.hugoKey !== undefined) await setSetting("hugo_api_key", input.hugoKey);
      if (input.llmEndpoint !== undefined) await setSetting("llm_endpoint", input.llmEndpoint);
      if (input.llmModel !== undefined) await setSetting("llm_model", input.llmModel);
      if (input.llmApiKey !== undefined) await setSetting("llm_api_key", input.llmApiKey);
      if (input.useLocal !== undefined) await setSetting("llm_use_local", input.useLocal ? "true" : "false");
      return { success: true };
    }),
});
