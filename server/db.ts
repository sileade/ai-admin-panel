import { eq, desc, sql, like, and, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, settings, articles, aiGenerations,
  type InsertArticle, type InsertAiGeneration,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User helpers ───
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Settings helpers ───
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return result.length > 0 ? result[0].value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(settings).values({ key, value }).onDuplicateKeyUpdate({ set: { value } });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(settings);
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

// ─── Article helpers ───
export async function getArticles(opts?: { search?: string; tag?: string; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions = [];
  if (opts?.search) {
    conditions.push(or(like(articles.title, `%${opts.search}%`), like(articles.tags, `%${opts.search}%`)));
  }
  if (opts?.tag) {
    conditions.push(like(articles.tags, `%${opts.tag}%`));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [items, countResult] = await Promise.all([
    db.select().from(articles).where(where).orderBy(desc(articles.updatedAt)).limit(opts?.limit ?? 50).offset(opts?.offset ?? 0),
    db.select({ count: sql<number>`count(*)` }).from(articles).where(where),
  ]);
  return { items, total: countResult[0]?.count ?? 0 };
}

export async function getArticleByFilename(filename: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(articles).where(eq(articles.filename, filename)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getArticleById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertArticle(article: InsertArticle) {
  const db = await getDb();
  if (!db) return;
  await db.insert(articles).values(article).onDuplicateKeyUpdate({
    set: {
      title: article.title,
      description: article.description,
      content: article.content,
      tags: article.tags,
      categories: article.categories,
      draft: article.draft,
      hugoUrl: article.hugoUrl,
      coverImage: article.coverImage,
      slug: article.slug,
      syncedAt: new Date(),
    },
  });
}

export async function deleteArticle(filename: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(articles).where(eq(articles.filename, filename));
}

export async function getArticleStats() {
  const db = await getDb();
  if (!db) return { total: 0, drafts: 0, published: 0 };
  const [totalResult, draftResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(articles),
    db.select({ count: sql<number>`count(*)` }).from(articles).where(eq(articles.draft, true)),
  ]);
  const total = totalResult[0]?.count ?? 0;
  const drafts = draftResult[0]?.count ?? 0;
  return { total, drafts, published: total - drafts };
}

// ─── AI Generation helpers ───
export async function createAiGeneration(gen: InsertAiGeneration) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(aiGenerations).values(gen);
  return result[0]?.insertId;
}

export async function updateAiGeneration(id: number, data: { result?: string; status?: "completed" | "failed"; tokensUsed?: number }) {
  const db = await getDb();
  if (!db) return;
  await db.update(aiGenerations).set(data).where(eq(aiGenerations.id, id));
}

export async function getRecentGenerations(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiGenerations).where(eq(aiGenerations.userId, userId)).orderBy(desc(aiGenerations.createdAt)).limit(limit);
}
