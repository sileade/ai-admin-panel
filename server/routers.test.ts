import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import {
  escapeLikePattern,
  sanitizeToolArgs,
  splitMessage,
  isUserAllowed,
} from "./telegram-bot";

// ─── Helper: create mock context ───
type CookieCall = { name: string; options: Record<string, unknown> };
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  const user: AuthenticatedUser = {
    id: 1, openId: "sample-user", email: "sample@example.com",
    name: "Sample User", loginMethod: "manus", role: "user",
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

function createAnonContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ═══════════════════════════════════════════════════
// tRPC ROUTER TESTS
// ═══════════════════════════════════════════════════
describe("tRPC Router", () => {
  describe("auth.me", () => {
    it("returns user when authenticated", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.me();
      expect(result).not.toBeNull();
      expect(result?.openId).toBe("sample-user");
      expect(result?.name).toBe("Sample User");
    });

    it("returns null when not authenticated", async () => {
      const ctx = createAnonContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.me();
      expect(result).toBeNull();
    });
  });

  describe("auth.logout", () => {
    it("clears the session cookie and reports success", async () => {
      const { ctx, clearedCookies } = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.logout();
      expect(result).toEqual({ success: true });
      expect(clearedCookies).toHaveLength(1);
      expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
      expect(clearedCookies[0]?.options).toMatchObject({
        maxAge: -1, secure: true, sameSite: "none", httpOnly: true, path: "/",
      });
    });

    it("works for unauthenticated users (public procedure)", async () => {
      const ctx = createAnonContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.logout();
      expect(result).toEqual({ success: true });
    });
  });

  describe("router structure", () => {
    it("has auth and system routers", () => {
      const procedures = Object.keys((appRouter as any)._def.procedures);
      expect(procedures).toContain("auth.me");
      expect(procedures).toContain("auth.logout");
      expect(procedures).toContain("system.notifyOwner");
    });

    it("does not have chat router (moved to Telegram)", () => {
      const procedures = Object.keys((appRouter as any)._def.procedures);
      const chatProcedures = procedures.filter(p => p.startsWith("chat."));
      expect(chatProcedures).toHaveLength(0);
    });
  });
});

// ═══════════════════════════════════════════════════
// TELEGRAM BOT MODULE TESTS
// ═══════════════════════════════════════════════════
describe("Telegram Bot Module", () => {
  it("exports createTelegramBot and startTelegramBot", async () => {
    const mod = await import("./telegram-bot");
    expect(typeof mod.createTelegramBot).toBe("function");
    expect(typeof mod.startTelegramBot).toBe("function");
  });

  it("startTelegramBot returns null when no token is set", async () => {
    const originalToken = process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;
    const mod = await import("./telegram-bot");
    const result = await mod.startTelegramBot();
    expect(result).toBeNull();
    if (originalToken) process.env.TELEGRAM_BOT_TOKEN = originalToken;
  });

  it("createTelegramBot creates a bot instance with valid token", async () => {
    const mod = await import("./telegram-bot");
    const bot = mod.createTelegramBot("123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11");
    expect(bot).toBeDefined();
    expect(typeof bot.start).toBe("function");
    expect(typeof bot.command).toBe("function");
    expect(typeof bot.on).toBe("function");
  });
});

// ═══════════════════════════════════════════════════
// escapeLikePattern TESTS
// ═══════════════════════════════════════════════════
describe("escapeLikePattern", () => {
  it("escapes % wildcard characters", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
    expect(escapeLikePattern("50% off")).toBe("50\\% off");
  });

  it("escapes _ wildcard characters", () => {
    expect(escapeLikePattern("user_name")).toBe("user\\_name");
    expect(escapeLikePattern("a_b_c")).toBe("a\\_b\\_c");
  });

  it("escapes both % and _ together", () => {
    expect(escapeLikePattern("100%_done")).toBe("100\\%\\_done");
  });

  it("returns unchanged string when no wildcards present", () => {
    expect(escapeLikePattern("hello world")).toBe("hello world");
    expect(escapeLikePattern("")).toBe("");
  });

  it("handles multiple consecutive wildcards", () => {
    expect(escapeLikePattern("%%__")).toBe("\\%\\%\\_\\_");
  });
});

// ═══════════════════════════════════════════════════
// sanitizeToolArgs TESTS
// ═══════════════════════════════════════════════════
describe("sanitizeToolArgs", () => {
  it("passes through safe string values", () => {
    const result = sanitizeToolArgs({ title: "Hello", content: "World" });
    expect(result.title).toBe("Hello");
    expect(result.content).toBe("World");
  });

  it("truncates strings longer than 50000 chars", () => {
    const longStr = "a".repeat(60000);
    const result = sanitizeToolArgs({ content: longStr });
    expect(result.content.length).toBe(50000);
  });

  it("clamps numbers to 0-1000 range", () => {
    expect(sanitizeToolArgs({ limit: -5 }).limit).toBe(0);
    expect(sanitizeToolArgs({ limit: 5000 }).limit).toBe(1000);
    expect(sanitizeToolArgs({ limit: 50 }).limit).toBe(50);
  });

  it("passes through boolean values", () => {
    expect(sanitizeToolArgs({ draft: true }).draft).toBe(true);
    expect(sanitizeToolArgs({ draft: false }).draft).toBe(false);
  });

  it("ignores arrays and objects for safety", () => {
    const result = sanitizeToolArgs({
      name: "test",
      nested: { key: "value" },
      list: [1, 2, 3],
    });
    expect(result.name).toBe("test");
    expect(result.nested).toBeUndefined();
    expect(result.list).toBeUndefined();
  });

  it("handles empty object", () => {
    expect(sanitizeToolArgs({})).toEqual({});
  });

  it("handles mixed types correctly", () => {
    const result = sanitizeToolArgs({
      title: "My Article", limit: 10, draft: false, ignored: [1, 2],
    });
    expect(result).toEqual({ title: "My Article", limit: 10, draft: false });
  });

  it("handles zero as a valid number", () => {
    expect(sanitizeToolArgs({ count: 0 }).count).toBe(0);
  });

  it("handles empty string as valid", () => {
    expect(sanitizeToolArgs({ title: "" }).title).toBe("");
  });
});

// ═══════════════════════════════════════════════════
// splitMessage TESTS
// ═══════════════════════════════════════════════════
describe("splitMessage", () => {
  it("returns single element for short messages", () => {
    expect(splitMessage("Hello world")).toEqual(["Hello world"]);
  });

  it("returns single element for exactly max length", () => {
    const msg = "a".repeat(4000);
    expect(splitMessage(msg)).toEqual([msg]);
  });

  it("splits long messages at newline boundaries", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i}: ${"x".repeat(50)}`);
    const msg = lines.join("\n");
    const result = splitMessage(msg, 500);
    expect(result.length).toBeGreaterThan(1);
    for (const part of result) {
      expect(part.length).toBeLessThanOrEqual(500);
    }
    expect(result.join("")).toBe(msg);
  });

  it("handles message with no newlines (force split at maxLen)", () => {
    const msg = "a".repeat(10000);
    const result = splitMessage(msg, 4000);
    expect(result.length).toBe(3);
    expect(result[0].length).toBe(4000);
    expect(result[1].length).toBe(4000);
    expect(result[2].length).toBe(2000);
  });

  it("handles empty string", () => {
    expect(splitMessage("")).toEqual([""]);
  });

  it("handles message exactly one char over limit", () => {
    const msg = "a".repeat(4001);
    const result = splitMessage(msg, 4000);
    expect(result.length).toBe(2);
    expect(result[0].length).toBe(4000);
    expect(result[1].length).toBe(1);
  });

  it("handles unicode content correctly", () => {
    const msg = "Привет мир! 🌍 ".repeat(500);
    const result = splitMessage(msg, 1000);
    expect(result.length).toBeGreaterThan(1);
    expect(result.join("")).toBe(msg);
  });
});

// ═══════════════════════════════════════════════════
// isUserAllowed TESTS
// ═══════════════════════════════════════════════════
describe("isUserAllowed", () => {
  const originalEnv = process.env.TELEGRAM_ALLOWED_USERS;

  it("allows all users when TELEGRAM_ALLOWED_USERS is not set", () => {
    delete process.env.TELEGRAM_ALLOWED_USERS;
    expect(isUserAllowed(12345)).toBe(true);
    expect(isUserAllowed(99999)).toBe(true);
  });

  it("allows all users when TELEGRAM_ALLOWED_USERS is empty", () => {
    process.env.TELEGRAM_ALLOWED_USERS = "";
    expect(isUserAllowed(12345)).toBe(true);
  });

  it("allows only listed users when set", () => {
    process.env.TELEGRAM_ALLOWED_USERS = "111,222,333";
    expect(isUserAllowed(111)).toBe(true);
    expect(isUserAllowed(222)).toBe(true);
    expect(isUserAllowed(333)).toBe(true);
    expect(isUserAllowed(444)).toBe(false);
  });

  it("handles whitespace in user IDs", () => {
    process.env.TELEGRAM_ALLOWED_USERS = " 111 , 222 , 333 ";
    expect(isUserAllowed(111)).toBe(true);
    expect(isUserAllowed(222)).toBe(true);
  });

  it("ignores invalid (NaN) entries", () => {
    process.env.TELEGRAM_ALLOWED_USERS = "111,abc,333";
    expect(isUserAllowed(111)).toBe(true);
    expect(isUserAllowed(333)).toBe(true);
  });

  it("blocks user ID 0 when list is set", () => {
    process.env.TELEGRAM_ALLOWED_USERS = "100,200";
    expect(isUserAllowed(0)).toBe(false);
  });

  // Cleanup
  it("cleanup env", () => {
    if (originalEnv !== undefined) process.env.TELEGRAM_ALLOWED_USERS = originalEnv;
    else delete process.env.TELEGRAM_ALLOWED_USERS;
    expect(true).toBe(true);
  });
});

// ═══════════════════════════════════════════════════
// SECURITY TESTS
// ═══════════════════════════════════════════════════
describe("Security", () => {
  it("escapeLikePattern neutralizes LIKE injection", () => {
    expect(escapeLikePattern("%admin%")).toBe("\\%admin\\%");
    expect(escapeLikePattern("_secret_")).toBe("\\_secret\\_");
  });

  it("sanitizeToolArgs prevents excessively long strings", () => {
    const result = sanitizeToolArgs({ content: "x".repeat(100000) });
    expect(result.content.length).toBeLessThanOrEqual(50000);
  });

  it("sanitizeToolArgs prevents negative numbers", () => {
    expect(sanitizeToolArgs({ limit: -100 }).limit).toBe(0);
  });

  it("sanitizeToolArgs prevents excessively large numbers", () => {
    expect(sanitizeToolArgs({ limit: 999999 }).limit).toBe(1000);
  });

  it("sanitizeToolArgs strips nested objects", () => {
    const result = sanitizeToolArgs({ name: "safe", nested: { key: "value" } });
    expect(result.name).toBe("safe");
    expect(result.nested).toBeUndefined();
  });

  it("access control blocks unauthorized users when list is set", () => {
    const original = process.env.TELEGRAM_ALLOWED_USERS;
    process.env.TELEGRAM_ALLOWED_USERS = "100,200";
    expect(isUserAllowed(100)).toBe(true);
    expect(isUserAllowed(300)).toBe(false);
    if (original !== undefined) process.env.TELEGRAM_ALLOWED_USERS = original;
    else delete process.env.TELEGRAM_ALLOWED_USERS;
  });
});
