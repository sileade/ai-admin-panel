import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { getSetting, setSetting, upsertArticle, deleteArticle, getArticles, getArticleByFilename, getArticleStats } from "../db";

async function getHugoConfig() {
  const baseUrl = await getSetting("hugo_base_url") ?? "https://admin.nodkeys.com";
  const apiKey = await getSetting("hugo_api_key") ?? "";
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

async function hugoFetch(path: string, options: RequestInit = {}) {
  const { baseUrl, apiKey } = await getHugoConfig();
  if (!apiKey) throw new Error("Hugo API key is not configured. Go to Settings to set it up.");
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Hugo API error ${res.status}: ${text}`);
  }
  return res.json();
}

export const hugoRouter = router({
  // Get Hugo API settings
  getConfig: adminProcedure.query(async () => {
    const baseUrl = await getSetting("hugo_base_url") ?? "https://admin.nodkeys.com";
    const apiKey = await getSetting("hugo_api_key") ?? "";
    return { baseUrl, apiKey: apiKey ? "***" + apiKey.slice(-4) : "" };
  }),

  // Save Hugo API settings
  saveConfig: adminProcedure
    .input(z.object({ baseUrl: z.string().url(), apiKey: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await setSetting("hugo_base_url", input.baseUrl);
      await setSetting("hugo_api_key", input.apiKey);
      return { success: true };
    }),

  // Sync articles from Hugo
  syncArticles: adminProcedure.mutation(async () => {
    const posts = await hugoFetch("/api/posts/list") as any[];
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
    return { synced, total: posts.length };
  }),

  // List articles (local cache)
  listArticles: adminProcedure
    .input(z.object({
      search: z.string().optional(),
      tag: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      return getArticles(input);
    }),

  // Get single article
  getArticle: adminProcedure
    .input(z.object({ filename: z.string() }))
    .query(async ({ input }) => {
      return getArticleByFilename(input.filename);
    }),

  // Create article on Hugo
  createArticle: adminProcedure
    .input(z.object({
      title: z.string().min(1),
      content: z.string(),
      description: z.string().optional(),
      tags: z.string().optional(),
      categories: z.string().optional(),
      draft: z.boolean().optional(),
      coverImage: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await hugoFetch("/api/posts/create", {
        method: "POST",
        body: JSON.stringify({
          title: input.title,
          content: input.content,
          description: input.description || "",
          tags: input.tags || "",
          categories: input.categories || "",
          draft: input.draft ?? false,
        }),
      });
      // Cache locally
      await upsertArticle({
        filename: result.filename || result.slug,
        title: input.title,
        slug: result.slug,
        description: input.description,
        content: input.content,
        tags: input.tags,
        categories: input.categories,
        draft: input.draft ?? false,
        hugoUrl: result.url,
        coverImage: input.coverImage,
        syncedAt: new Date(),
      });
      return result;
    }),

  // Edit article on Hugo
  editArticle: adminProcedure
    .input(z.object({
      filename: z.string(),
      title: z.string().optional(),
      content: z.string().optional(),
      description: z.string().optional(),
      tags: z.string().optional(),
      categories: z.string().optional(),
      draft: z.boolean().optional(),
      coverImage: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { filename, ...data } = input;
      const result = await hugoFetch(`/api/posts/edit/${filename}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      // Update local cache
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
          coverImage: data.coverImage ?? existing.coverImage ?? undefined,
          syncedAt: new Date(),
        });
      }
      return result;
    }),

  // Delete article on Hugo
  deleteArticle: adminProcedure
    .input(z.object({ filename: z.string() }))
    .mutation(async ({ input }) => {
      await hugoFetch(`/api/posts/delete/${input.filename}`, { method: "DELETE" });
      await deleteArticle(input.filename);
      return { success: true };
    }),

  // Dashboard stats
  getStats: adminProcedure.query(async () => {
    return getArticleStats();
  }),
});
