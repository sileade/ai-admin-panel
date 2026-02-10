import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): { ctx: TrpcContext; clearedCookies: any[] } {
  const clearedCookies: any[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
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

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createUserContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    ctx: {
      user,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    },
  };
}

// ─── Auth Tests ───
describe("auth.me", () => {
  it("returns null for unauthenticated user", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user for authenticated user", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Admin");
    expect(result?.role).toBe("admin");
  });
});

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });
});

// ─── Chat Router Access Control (protectedProcedure) ───
// Now uses protectedProcedure: any authenticated user can access, unauthenticated are rejected

describe("chat.getSettings - access control", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.chat.getSettings()).rejects.toThrow();
  });

  it("allows regular users to get settings", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.getSettings();
    expect(result).toBeDefined();
    expect(typeof result.useLocal).toBe("boolean");
    expect(typeof result.hugoUrl).toBe("string");
  });

  it("allows admin to get settings", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.getSettings();
    expect(result).toBeDefined();
    expect(typeof result.useLocal).toBe("boolean");
    expect(typeof result.hugoUrl).toBe("string");
    expect(typeof result.llmEndpoint).toBe("string");
    expect(typeof result.llmModel).toBe("string");
  });
});

describe("chat.saveSettings - access control", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.chat.saveSettings({ hugoUrl: "https://example.com" })
    ).rejects.toThrow();
  });

  it("allows regular users to save settings", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.saveSettings({ llmModel: "test-model" });
    expect(result).toEqual({ success: true });
  });
});

describe("chat.listConversations - access control", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.chat.listConversations()).rejects.toThrow();
  });

  it("allows regular users to list conversations", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.listConversations();
    expect(Array.isArray(result)).toBe(true);
  });

  it("allows admin to list conversations", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.listConversations();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("chat.createConversation - access control", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.chat.createConversation({ title: "Test" })
    ).rejects.toThrow();
  });

  it("allows regular users to create conversations", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.createConversation({ title: "Test Chat" });
    expect(result).toBeDefined();
    expect(typeof result.id).toBe("number");
  });
});

describe("chat.sendMessage - validation", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.chat.sendMessage({ conversationId: 1, message: "hello" })
    ).rejects.toThrow();
  });

  it("rejects empty messages", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.chat.sendMessage({ conversationId: 1, message: "" })
    ).rejects.toThrow();
  });
});

describe("chat.deleteConversation - access control", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.chat.deleteConversation({ id: 1 })
    ).rejects.toThrow();
  });
});

describe("chat.renameConversation - access control", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.chat.renameConversation({ id: 1, title: "New" })
    ).rejects.toThrow();
  });
});

// ─── Router Structure ───
describe("router structure", () => {
  it("has all expected routers", () => {
    const caller = appRouter.createCaller(createUnauthContext());
    expect(caller.auth).toBeDefined();
    expect(caller.chat).toBeDefined();
    expect(caller.system).toBeDefined();
  });

  it("chat router has all expected procedures", () => {
    const caller = appRouter.createCaller(createUnauthContext());
    expect(caller.chat.getSettings).toBeDefined();
    expect(caller.chat.saveSettings).toBeDefined();
    expect(caller.chat.listConversations).toBeDefined();
    expect(caller.chat.createConversation).toBeDefined();
    expect(caller.chat.getConversation).toBeDefined();
    expect(caller.chat.deleteConversation).toBeDefined();
    expect(caller.chat.renameConversation).toBeDefined();
    expect(caller.chat.sendMessage).toBeDefined();
  });
});
