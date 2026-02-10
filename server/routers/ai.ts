import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { generateImage } from "../_core/imageGeneration";
import { getSetting, setSetting, getArticles, createAiGeneration, updateAiGeneration, getRecentGenerations } from "../db";

export const aiRouter = router({
  // ─── LLM Settings ───
  getLlmConfig: adminProcedure.query(async () => {
    const endpoint = await getSetting("llm_endpoint") ?? "";
    const model = await getSetting("llm_model") ?? "";
    const apiKey = await getSetting("llm_api_key") ?? "";
    const useLocal = await getSetting("llm_use_local") ?? "false";
    return { endpoint, model, apiKey: apiKey ? "***" + apiKey.slice(-4) : "", useLocal: useLocal === "true" };
  }),

  saveLlmConfig: adminProcedure
    .input(z.object({
      endpoint: z.string(),
      model: z.string(),
      apiKey: z.string(),
      useLocal: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      await setSetting("llm_endpoint", input.endpoint);
      await setSetting("llm_model", input.model);
      await setSetting("llm_api_key", input.apiKey);
      await setSetting("llm_use_local", input.useLocal ? "true" : "false");
      return { success: true };
    }),

  // ─── AI Article Generator ───
  generateArticle: adminProcedure
    .input(z.object({
      topic: z.string().min(1),
      style: z.string().optional(),
      length: z.enum(["short", "medium", "long"]).optional(),
      language: z.string().optional(),
      includeContext: z.boolean().optional(),
      additionalInstructions: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Get existing articles for context
      let contextArticles = "";
      if (input.includeContext !== false) {
        const { items } = await getArticles({ limit: 10 });
        if (items.length > 0) {
          contextArticles = items.map(a => `- "${a.title}" (tags: ${a.tags || "none"})`).join("\n");
        }
      }

      const genId = await createAiGeneration({
        userId: ctx.user.id,
        type: "article_generate",
        prompt: input.topic,
        status: "pending",
      });

      try {
        const systemPrompt = `You are an expert content writer and blogger. Write high-quality, engaging articles in Markdown format.
${contextArticles ? `\nExisting articles on the blog for context and style reference:\n${contextArticles}\n\nWrite in a similar style and avoid repeating topics already covered.` : ""}
${input.language ? `Write in ${input.language}.` : "Write in Russian."}
${input.style ? `Style: ${input.style}` : ""}
${input.additionalInstructions ? `Additional instructions: ${input.additionalInstructions}` : ""}

Return a JSON object with these fields:
- title: article title
- description: SEO meta description (max 160 chars)
- content: full article in Markdown
- tags: comma-separated relevant tags
- categories: comma-separated categories`;

        const lengthGuide = input.length === "short" ? "Write a concise article (500-800 words)." :
          input.length === "long" ? "Write a comprehensive article (2000-3000 words)." :
          "Write a detailed article (1000-1500 words).";

        const result = await callLLM([
          { role: "system", content: systemPrompt },
          { role: "user", content: `Write an article about: ${input.topic}\n\n${lengthGuide}` },
        ], true);

        let parsed;
        try {
          const jsonStr = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          parsed = JSON.parse(jsonStr);
        } catch {
          parsed = { title: input.topic, content: result, description: "", tags: "", categories: "" };
        }

        if (genId) {
          await updateAiGeneration(genId, { result: JSON.stringify(parsed), status: "completed" });
        }
        return parsed;
      } catch (error: any) {
        if (genId) await updateAiGeneration(genId, { status: "failed", result: error.message });
        throw error;
      }
    }),

  // ─── AI Article Editor ───
  editArticle: adminProcedure
    .input(z.object({
      content: z.string().min(1),
      action: z.enum(["improve", "rewrite", "expand", "shorten", "fix_grammar", "translate", "seo_optimize"]),
      language: z.string().optional(),
      additionalInstructions: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const genId = await createAiGeneration({
        userId: ctx.user.id,
        type: "article_edit",
        prompt: `${input.action}: ${input.content.slice(0, 200)}...`,
        status: "pending",
      });

      try {
        const actionPrompts: Record<string, string> = {
          improve: "Improve this article: fix grammar, enhance readability, improve structure, and make it more engaging. Keep the same meaning and key points.",
          rewrite: "Completely rewrite this article with fresh perspective and better structure. Maintain the core message but use different wording and examples.",
          expand: "Expand this article with more details, examples, and explanations. Add new sections where appropriate. At least double the content length.",
          shorten: "Shorten this article while keeping all key points. Remove redundancy and make it more concise. Target 50% of original length.",
          fix_grammar: "Fix all grammar, spelling, and punctuation errors. Improve sentence structure where needed. Keep the original style and meaning.",
          translate: `Translate this article to ${input.language || "English"}. Maintain the original formatting and style.`,
          seo_optimize: "Optimize this article for SEO: improve headings, add relevant keywords naturally, improve meta description potential, and enhance readability.",
        };

        const result = await callLLM([
          { role: "system", content: `You are an expert editor. ${actionPrompts[input.action]}${input.additionalInstructions ? `\n\nAdditional instructions: ${input.additionalInstructions}` : ""}\n\nReturn the edited article in Markdown format. Only return the article content, no explanations.` },
          { role: "user", content: input.content },
        ]);

        if (genId) await updateAiGeneration(genId, { result: result.slice(0, 5000), status: "completed" });
        return { content: result };
      } catch (error: any) {
        if (genId) await updateAiGeneration(genId, { status: "failed", result: error.message });
        throw error;
      }
    }),

  // ─── AI SEO Optimizer ───
  optimizeSeo: adminProcedure
    .input(z.object({
      title: z.string(),
      content: z.string(),
      currentTags: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const result = await callLLM([
        { role: "system", content: `You are an SEO expert. Analyze the article and suggest optimizations. Return a JSON object with:
- title: optimized title (max 60 chars)
- description: meta description (max 160 chars)
- tags: comma-separated relevant tags (5-10 tags)
- categories: comma-separated categories
- suggestions: array of improvement suggestions` },
        { role: "user", content: `Title: ${input.title}\nCurrent tags: ${input.currentTags || "none"}\n\nArticle:\n${input.content.slice(0, 3000)}` },
      ], true);

      try {
        const jsonStr = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        return JSON.parse(jsonStr);
      } catch {
        return { title: input.title, description: "", tags: input.currentTags || "", categories: "", suggestions: [result] };
      }
    }),

  // ─── AI Assistant Chat ───
  chat: adminProcedure
    .input(z.object({
      messages: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })),
      context: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const systemMsg = `You are an AI assistant for a blog content management system. Help the user with writing, editing, and optimizing blog articles. You can suggest topics, improve writing, help with SEO, and answer questions about content strategy.${input.context ? `\n\nCurrent article context:\n${input.context}` : ""}`;

      const messages = [
        { role: "system" as const, content: systemMsg },
        ...input.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      ];

      const result = await callLLM(messages);
      return { content: result };
    }),

  // ─── Image Generation ───
  generateImage: adminProcedure
    .input(z.object({
      prompt: z.string().min(1),
      style: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const genId = await createAiGeneration({
        userId: ctx.user.id,
        type: "image_generate",
        prompt: input.prompt,
        status: "pending",
      });

      try {
        const fullPrompt = input.style ? `${input.prompt}, ${input.style}` : input.prompt;
        const { url } = await generateImage({ prompt: fullPrompt });
        if (genId) await updateAiGeneration(genId, { result: url, status: "completed" });
        return { url };
      } catch (error: any) {
        if (genId) await updateAiGeneration(genId, { status: "failed", result: error.message });
        throw error;
      }
    }),

  // ─── Image Search (via web) ───
  searchImages: adminProcedure
    .input(z.object({
      query: z.string().min(1),
      page: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      // Use Unsplash API for free image search
      try {
        const res = await fetch(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(input.query)}&per_page=20&page=${input.page || 1}`,
          { headers: { Authorization: "Client-ID 0_gL1FMO0V0OaEjttg7oZ_8ZLDWdYjPmPbRisTezXSo" } }
        );
        if (!res.ok) throw new Error("Unsplash API error");
        const data = await res.json();
        return {
          images: data.results.map((img: any) => ({
            id: img.id,
            url: img.urls.regular,
            thumb: img.urls.thumb,
            small: img.urls.small,
            description: img.description || img.alt_description || "",
            author: img.user.name,
            authorUrl: img.user.links.html,
            downloadUrl: img.links.download,
          })),
          total: data.total,
          totalPages: data.total_pages,
        };
      } catch {
        // Fallback: use Pixabay
        try {
          const res = await fetch(
            `https://pixabay.com/api/?key=47566229-0e5c1f3b4e4b0c6d8f9a2e1d3&q=${encodeURIComponent(input.query)}&per_page=20&page=${input.page || 1}&image_type=photo`
          );
          if (!res.ok) throw new Error("Pixabay API error");
          const data = await res.json();
          return {
            images: data.hits.map((img: any) => ({
              id: String(img.id),
              url: img.largeImageURL,
              thumb: img.previewURL,
              small: img.webformatURL,
              description: img.tags,
              author: img.user,
              authorUrl: `https://pixabay.com/users/${img.user}-${img.user_id}/`,
              downloadUrl: img.largeImageURL,
            })),
            total: data.totalHits,
            totalPages: Math.ceil(data.totalHits / 20),
          };
        } catch (e: any) {
          return { images: [], total: 0, totalPages: 0 };
        }
      }
    }),

  // ─── Generation History ───
  getHistory: adminProcedure.query(async ({ ctx }) => {
    return getRecentGenerations(ctx.user.id, 50);
  }),
});

// ─── Helper: Call LLM with fallback to local ───
async function callLLM(messages: Array<{ role: string; content: string }>, jsonMode = false): Promise<string> {
  // Check if local LLM is configured
  const useLocal = await getSetting("llm_use_local");
  const localEndpoint = await getSetting("llm_endpoint");
  const localModel = await getSetting("llm_model");
  const localApiKey = await getSetting("llm_api_key");

  if (useLocal === "true" && localEndpoint) {
    // Use local LLM via OpenAI-compatible API
    const url = `${localEndpoint.replace(/\/+$/, "")}/v1/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(localApiKey ? { Authorization: `Bearer ${localApiKey}` } : {}),
      },
      body: JSON.stringify({
        model: localModel || "default",
        messages,
        max_tokens: 8192,
        temperature: 0.7,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Local LLM error ${res.status}: ${text}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }

  // Fallback to built-in Manus LLM
  const result = await invokeLLM({
    messages: messages.map(m => ({ role: m.role as any, content: m.content })),
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
  });
  return result.choices?.[0]?.message?.content as string || "";
}
