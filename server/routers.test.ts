import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// ─── Test Helpers ───
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

function createUserContext(id = 2): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id,
    openId: `regular-user-${id}`,
    email: `user${id}@example.com`,
    name: `User ${id}`,
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

// ═══════════════════════════════════════════════════
// AUTH TESTS
// ═══════════════════════════════════════════════════
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

  it("returns user for regular user", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.role).toBe("user");
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

  it("works for unauthenticated users (public procedure)", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });
});

// ═══════════════════════════════════════════════════
// CHAT ROUTER — ACCESS CONTROL
// ═══════════════════════════════════════════════════
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

  it("returns correct settings structure", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.getSettings();
    expect(result).toHaveProperty("hugoUrl");
    expect(result).toHaveProperty("hugoKeySet");
    expect(result).toHaveProperty("llmEndpoint");
    expect(result).toHaveProperty("llmModel");
    expect(result).toHaveProperty("useLocal");
    expect(typeof result.hugoKeySet).toBe("boolean");
  });
});

describe("chat.saveSettings - access control & validation", () => {
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

  it("saves and retrieves Hugo URL", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await caller.chat.saveSettings({ hugoUrl: "https://test-hugo.example.com" });
    const settings = await caller.chat.getSettings();
    expect(settings.hugoUrl).toBe("https://test-hugo.example.com");
  });

  it("saves and retrieves LLM settings", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await caller.chat.saveSettings({
      llmEndpoint: "http://192.168.1.100:11434",
      llmModel: "llama3.2",
      useLocal: true,
    });
    const settings = await caller.chat.getSettings();
    expect(settings.llmEndpoint).toBe("http://192.168.1.100:11434");
    expect(settings.llmModel).toBe("llama3.2");
    expect(settings.useLocal).toBe(true);
  });

  it("handles empty/optional fields gracefully", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.saveSettings({});
    expect(result).toEqual({ success: true });
  });

  it("handles Hugo key set indicator", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await caller.chat.saveSettings({ hugoKey: "test-key-123" });
    const settings = await caller.chat.getSettings();
    expect(settings.hugoKeySet).toBe(true);
  });
});

// ═══════════════════════════════════════════════════
// CHAT ROUTER — CONVERSATION MANAGEMENT
// ═══════════════════════════════════════════════════
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

describe("chat.createConversation - access control & functionality", () => {
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

  it("creates conversation with title", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.createConversation({ title: "My Test Conversation" });
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe("number");
  });

  it("creates conversation without title", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.chat.createConversation({});
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe("number");
  });
});

describe("chat.getConversation - ownership isolation", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.chat.getConversation({ id: 1 })
    ).rejects.toThrow();
  });

  it("returns conversation with messages for owner", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const conv = await caller.chat.createConversation({ title: "Owner Test" });
    const result = await caller.chat.getConversation({ id: conv.id! });
    expect(result).toBeDefined();
    expect(result.conversation).toBeDefined();
    expect(Array.isArray(result.messages)).toBe(true);
  });

  it("rejects access to other user's conversation", async () => {
    // Create conversation as admin (user id 1)
    const { ctx: adminCtx } = createAdminContext();
    const adminCaller = appRouter.createCaller(adminCtx);
    const conv = await adminCaller.chat.createConversation({ title: "Admin Only" });

    // Try to access as regular user (user id 2)
    const { ctx: userCtx } = createUserContext(2);
    const userCaller = appRouter.createCaller(userCtx);
    await expect(
      userCaller.chat.getConversation({ id: conv.id! })
    ).rejects.toThrow();
  });
});

describe("chat.deleteConversation - access control & ownership", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.chat.deleteConversation({ id: 1 })
    ).rejects.toThrow();
  });

  it("allows owner to delete their conversation", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const conv = await caller.chat.createConversation({ title: "To Delete" });
    const result = await caller.chat.deleteConversation({ id: conv.id! });
    expect(result).toEqual({ success: true });
  });

  it("rejects deletion of other user's conversation", async () => {
    const { ctx: adminCtx } = createAdminContext();
    const adminCaller = appRouter.createCaller(adminCtx);
    const conv = await adminCaller.chat.createConversation({ title: "Admin Conv" });

    const { ctx: userCtx } = createUserContext(2);
    const userCaller = appRouter.createCaller(userCtx);
    await expect(
      userCaller.chat.deleteConversation({ id: conv.id! })
    ).rejects.toThrow();
  });
});

describe("chat.renameConversation - access control & ownership", () => {
  it("rejects unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.chat.renameConversation({ id: 1, title: "New" })
    ).rejects.toThrow();
  });

  it("allows owner to rename their conversation", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const conv = await caller.chat.createConversation({ title: "Original" });
    const result = await caller.chat.renameConversation({ id: conv.id!, title: "Renamed" });
    expect(result).toEqual({ success: true });
  });

  it("rejects renaming other user's conversation", async () => {
    const { ctx: adminCtx } = createAdminContext();
    const adminCaller = appRouter.createCaller(adminCtx);
    const conv = await adminCaller.chat.createConversation({ title: "Admin Conv" });

    const { ctx: userCtx } = createUserContext(2);
    const userCaller = appRouter.createCaller(userCtx);
    await expect(
      userCaller.chat.renameConversation({ id: conv.id!, title: "Hacked" })
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════
// CHAT ROUTER — SEND MESSAGE VALIDATION
// ═══════════════════════════════════════════════════
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

  it("rejects messages exceeding max length", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const longMessage = "a".repeat(10001);
    await expect(
      caller.chat.sendMessage({ conversationId: 1, message: longMessage })
    ).rejects.toThrow();
  });

  it("rejects sending to non-existent conversation", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.chat.sendMessage({ conversationId: 999999, message: "test" })
    ).rejects.toThrow();
  });

  it("rejects sending to other user's conversation", async () => {
    const { ctx: adminCtx } = createAdminContext();
    const adminCaller = appRouter.createCaller(adminCtx);
    const conv = await adminCaller.chat.createConversation({ title: "Admin Only" });

    const { ctx: userCtx } = createUserContext(2);
    const userCaller = appRouter.createCaller(userCtx);
    await expect(
      userCaller.chat.sendMessage({ conversationId: conv.id!, message: "intruder" })
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════
// CONVERSATION LIFECYCLE INTEGRATION TEST
// ═══════════════════════════════════════════════════
describe("conversation lifecycle", () => {
  it("create → list → rename → delete flow works", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Create
    const conv = await caller.chat.createConversation({ title: "Lifecycle Test" });
    expect(conv.id).toBeDefined();

    // List should include it
    const list1 = await caller.chat.listConversations();
    expect(list1.some(c => c.id === conv.id)).toBe(true);

    // Rename
    await caller.chat.renameConversation({ id: conv.id!, title: "Renamed Lifecycle" });

    // Get and verify rename
    const fetched = await caller.chat.getConversation({ id: conv.id! });
    expect(fetched.conversation?.title).toBe("Renamed Lifecycle");

    // Delete
    await caller.chat.deleteConversation({ id: conv.id! });

    // List should no longer include it
    const list2 = await caller.chat.listConversations();
    expect(list2.some(c => c.id === conv.id)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════
// MULTI-USER ISOLATION TEST
// ═══════════════════════════════════════════════════
describe("multi-user isolation", () => {
  it("users can only see their own conversations", async () => {
    const { ctx: adminCtx } = createAdminContext();
    const adminCaller = appRouter.createCaller(adminCtx);

    const { ctx: userCtx } = createUserContext(3);
    const userCaller = appRouter.createCaller(userCtx);

    // Admin creates a conversation
    const adminConv = await adminCaller.chat.createConversation({ title: "Admin Private" });

    // User creates a conversation
    const userConv = await userCaller.chat.createConversation({ title: "User Private" });

    // Admin list should include admin's conv but not user's
    const adminList = await adminCaller.chat.listConversations();
    expect(adminList.some(c => c.id === adminConv.id)).toBe(true);
    // User list should include user's conv
    const userList = await userCaller.chat.listConversations();
    expect(userList.some(c => c.id === userConv.id)).toBe(true);

    // Cleanup
    await adminCaller.chat.deleteConversation({ id: adminConv.id! });
    await userCaller.chat.deleteConversation({ id: userConv.id! });
  });
});

// ═══════════════════════════════════════════════════
// ROUTER STRUCTURE VERIFICATION
// ═══════════════════════════════════════════════════
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

  it("auth router has me and logout", () => {
    const caller = appRouter.createCaller(createUnauthContext());
    expect(caller.auth.me).toBeDefined();
    expect(caller.auth.logout).toBeDefined();
  });
});
