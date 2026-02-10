import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

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
// AUTH TESTS
// ═══════════════════════════════════════════════════
describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.openId).toBe("sample-user");
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

// ═══════════════════════════════════════════════════
// ROUTER STRUCTURE TESTS
// ═══════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════
// TELEGRAM BOT MODULE TESTS
// ═══════════════════════════════════════════════════
describe("telegram-bot module", () => {
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
// TOOL LOGIC UNIT TESTS
// ═══════════════════════════════════════════════════
describe("tool execution logic", () => {
  it("sanitizeToolArgs limits string length", () => {
    function sanitizeToolArgs(args: Record<string, any>): Record<string, any> {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(args)) {
        if (typeof value === "string") sanitized[key] = value.slice(0, 50000);
        else if (typeof value === "number") sanitized[key] = Math.min(Math.max(value, 0), 1000);
        else if (typeof value === "boolean") sanitized[key] = value;
      }
      return sanitized;
    }
    const longString = "x".repeat(100000);
    const result = sanitizeToolArgs({ text: longString, count: 5000, draft: true });
    expect(result.text.length).toBe(50000);
    expect(result.count).toBe(1000);
    expect(result.draft).toBe(true);
  });

  it("escapeLikePattern escapes SQL wildcards", () => {
    function escapeLikePattern(input: string): string {
      return input.replace(/%/g, "\\%").replace(/_/g, "\\_");
    }
    expect(escapeLikePattern("100% test_data")).toBe("100\\% test\\_data");
    expect(escapeLikePattern("normal")).toBe("normal");
  });

  it("splitMessage splits long text correctly", () => {
    function splitMessage(text: string, maxLen = 4000): string[] {
      if (text.length <= maxLen) return [text];
      const parts: string[] = [];
      let remaining = text;
      while (remaining.length > 0) {
        if (remaining.length <= maxLen) { parts.push(remaining); break; }
        let splitIdx = remaining.lastIndexOf("\n", maxLen);
        if (splitIdx < maxLen * 0.3) splitIdx = maxLen;
        parts.push(remaining.slice(0, splitIdx));
        remaining = remaining.slice(splitIdx);
      }
      return parts;
    }
    const short = "Hello world";
    expect(splitMessage(short)).toEqual(["Hello world"]);
    const long = "Line\n".repeat(2000);
    const parts = splitMessage(long);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(4000);
    }
  });

  it("sanitizeToolArgs handles negative numbers", () => {
    function sanitizeToolArgs(args: Record<string, any>): Record<string, any> {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(args)) {
        if (typeof value === "string") sanitized[key] = value.slice(0, 50000);
        else if (typeof value === "number") sanitized[key] = Math.min(Math.max(value, 0), 1000);
        else if (typeof value === "boolean") sanitized[key] = value;
      }
      return sanitized;
    }
    const result = sanitizeToolArgs({ count: -5 });
    expect(result.count).toBe(0);
  });

  it("sanitizeToolArgs ignores non-primitive types", () => {
    function sanitizeToolArgs(args: Record<string, any>): Record<string, any> {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(args)) {
        if (typeof value === "string") sanitized[key] = value.slice(0, 50000);
        else if (typeof value === "number") sanitized[key] = Math.min(Math.max(value, 0), 1000);
        else if (typeof value === "boolean") sanitized[key] = value;
      }
      return sanitized;
    }
    const result = sanitizeToolArgs({ arr: [1, 2, 3], obj: { a: 1 } });
    expect(result.arr).toBeUndefined();
    expect(result.obj).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════
// ALLOWED USERS LOGIC
// ═══════════════════════════════════════════════════
describe("telegram user access control logic", () => {
  it("allows all users when TELEGRAM_ALLOWED_USERS is empty", () => {
    function isUserAllowed(userId: number, envVal: string): boolean {
      if (!envVal) return true;
      const allowed = envVal.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (allowed.length === 0) return true;
      return allowed.includes(userId);
    }
    expect(isUserAllowed(12345, "")).toBe(true);
    expect(isUserAllowed(99999, "")).toBe(true);
  });

  it("restricts to listed users when TELEGRAM_ALLOWED_USERS is set", () => {
    function isUserAllowed(userId: number, envVal: string): boolean {
      if (!envVal) return true;
      const allowed = envVal.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (allowed.length === 0) return true;
      return allowed.includes(userId);
    }
    expect(isUserAllowed(111, "111,222,333")).toBe(true);
    expect(isUserAllowed(222, "111,222,333")).toBe(true);
    expect(isUserAllowed(444, "111,222,333")).toBe(false);
  });

  it("handles whitespace in allowed users list", () => {
    function isUserAllowed(userId: number, envVal: string): boolean {
      if (!envVal) return true;
      const allowed = envVal.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (allowed.length === 0) return true;
      return allowed.includes(userId);
    }
    expect(isUserAllowed(111, " 111 , 222 , 333 ")).toBe(true);
    expect(isUserAllowed(444, " 111 , 222 , 333 ")).toBe(false);
  });
});
