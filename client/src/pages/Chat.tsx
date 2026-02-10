import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Bot, Send, Plus, Trash2, MessageSquare, Settings2,
  Loader2, User, Sparkles, Image, FileText, Search,
  PenTool, BarChart3, RefreshCw, Wand2, ChevronLeft,
  Menu, X, LogOut,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

type ToolResult = {
  name: string;
  result: string;
  metadata?: any;
};

type ChatMsg = {
  id: number;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolName?: string | null;
  toolResult?: string | null;
  metadata?: string | null;
  createdAt: Date;
};

// Stable counter for unique message IDs (avoids Date.now collisions)
let msgIdCounter = Date.now();
function nextMsgId() {
  return ++msgIdCounter;
}

const SUGGESTED_PROMPTS = [
  { icon: BarChart3, text: "Покажи статистику блога", color: "text-blue-400" },
  { icon: FileText, text: "Покажи список статей", color: "text-green-400" },
  { icon: Wand2, text: "Напиши статью про AI в 2025 году", color: "text-purple-400" },
  { icon: Search, text: "Найди изображения для статьи о технологиях", color: "text-amber-400" },
  { icon: Image, text: "Сгенерируй обложку для блога о программировании", color: "text-pink-400" },
  { icon: Settings2, text: "Покажи текущие настройки", color: "text-cyan-400" },
];

export default function Chat() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [localMessages, setLocalMessages] = useState<ChatMsg[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Responsive check
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  // If not authenticated, show login prompt
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 bg-background text-foreground p-6">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold">AI Blog Assistant</h1>
        <p className="text-muted-foreground text-center max-w-md">
          Войдите в систему, чтобы начать управлять Hugo-блогом через AI-чат.
        </p>
        <Button asChild size="lg">
          <a href={getLoginUrl()}>Войти</a>
        </Button>
      </div>
    );
  }

  return <AuthenticatedChat user={user} />;
}

// ─── Authenticated Chat Component ───
function AuthenticatedChat({ user }: { user: any }) {
  const { logout } = useAuth();
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [localMessages, setLocalMessages] = useState<ChatMsg[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Responsive check
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  // Conversations list
  const conversationsQuery = trpc.chat.listConversations.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  // Active conversation messages
  const messagesQuery = trpc.chat.getConversation.useQuery(
    { id: activeConversationId! },
    { enabled: !!activeConversationId, refetchOnWindowFocus: false }
  );

  // Mutations
  const createConv = trpc.chat.createConversation.useMutation({
    onSuccess: (data) => {
      if (data.id) {
        setActiveConversationId(data.id);
        setLocalMessages([]);
        conversationsQuery.refetch();
        if (isMobile) setSidebarOpen(false);
      }
    },
  });

  const deleteConv = trpc.chat.deleteConversation.useMutation({
    onSuccess: () => {
      if (activeConversationId) {
        setActiveConversationId(null);
        setLocalMessages([]);
      }
      conversationsQuery.refetch();
    },
  });

  const sendMsg = trpc.chat.sendMessage.useMutation({
    onSuccess: (data) => {
      // Remove optimistic loading, add real response
      setLocalMessages(prev => {
        const withoutLoading = prev.filter(m => m.id !== -1);
        return [...withoutLoading, {
          id: nextMsgId(),
          role: "assistant" as const,
          content: data.content,
          toolName: null,
          toolResult: null,
          metadata: data.toolResults?.length
            ? JSON.stringify(data.toolResults.map((r: ToolResult) => r.metadata).filter(Boolean))
            : null,
          createdAt: new Date(),
        }];
      });
      messagesQuery.refetch();
      conversationsQuery.refetch();
    },
    onError: (err) => {
      setLocalMessages(prev => prev.filter(m => m.id !== -1));
      toast.error(`Ошибка: ${err.message}`);
    },
  });

  // Combine server messages with local optimistic messages
  const displayMessages = useMemo(() => {
    const serverMsgs = messagesQuery.data?.messages || [];
    if (localMessages.length > 0) {
      const lastServerId = serverMsgs.length > 0 ? serverMsgs[serverMsgs.length - 1].id : 0;
      const newLocal = localMessages.filter(m => m.id > lastServerId || m.id < 0);
      return [...serverMsgs.filter(m => m.role !== "system" && m.role !== "tool"), ...newLocal];
    }
    return serverMsgs.filter(m => m.role !== "system" && m.role !== "tool");
  }, [messagesQuery.data, localMessages]);

  // Auto-scroll
  useEffect(() => {
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement;
    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [displayMessages]);

  // Auto-resize textarea
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 128) + "px";
  }, []);

  const handleSend = useCallback(async (text?: string) => {
    const msg = text || inputValue.trim();
    if (!msg || sendMsg.isPending) return;

    let convId = activeConversationId;

    // Create conversation if none active
    if (!convId) {
      try {
        const result = await createConv.mutateAsync({ title: msg.slice(0, 60) });
        convId = result.id!;
        setActiveConversationId(convId);
      } catch {
        toast.error("Не удалось создать чат");
        return;
      }
    }

    setInputValue("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Add optimistic user message + loading indicator
    setLocalMessages(prev => [
      ...prev,
      {
        id: nextMsgId(),
        role: "user" as const,
        content: msg,
        toolName: null,
        toolResult: null,
        metadata: null,
        createdAt: new Date(),
      },
      {
        id: -1, // loading indicator
        role: "assistant" as const,
        content: "",
        toolName: null,
        toolResult: null,
        metadata: null,
        createdAt: new Date(),
      },
    ]);

    sendMsg.mutate({ conversationId: convId, message: msg });
  }, [inputValue, activeConversationId, sendMsg.isPending, createConv]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleNewChat = useCallback(() => {
    setActiveConversationId(null);
    setLocalMessages([]);
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const handleSelectConversation = useCallback((id: number) => {
    setActiveConversationId(id);
    setLocalMessages([]);
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  // Extract images from metadata for rendering
  const extractImages = useCallback((metadata: string | null): Array<{ url: string; thumb?: string; description?: string }> => {
    if (!metadata) return [];
    try {
      const parsed = JSON.parse(metadata);
      const images: Array<{ url: string; thumb?: string; description?: string }> = [];
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (!item) continue;
        if (item.type === "images" && item.images) {
          images.push(...item.images);
        }
        if (item.type === "generated_image" && item.url) {
          images.push({ url: item.url, description: item.prompt });
        }
      }
      return images;
    } catch {
      return [];
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    window.location.reload();
  }, [logout]);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <div className={cn(
        "flex flex-col border-r border-border bg-card transition-all duration-300",
        sidebarOpen ? "w-72" : "w-0",
        isMobile && sidebarOpen && "absolute inset-y-0 left-0 z-50 w-72 shadow-2xl"
      )}>
        {sidebarOpen && (
          <>
            {/* Sidebar Header */}
            <div className="flex items-center justify-between p-4 h-16">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <span className="font-semibold text-sm">AI Blog Bot</span>
              </div>
              {isMobile && (
                <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} aria-label="Закрыть боковую панель">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* New Chat Button */}
            <div className="px-3 pb-3">
              <Button
                onClick={handleNewChat}
                className="w-full justify-start gap-2"
                variant="outline"
                size="sm"
              >
                <Plus className="h-4 w-4" />
                Новый чат
              </Button>
            </div>

            <Separator />

            {/* Conversations List */}
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {conversationsQuery.data?.map((conv) => (
                  <div
                    key={conv.id}
                    className={cn(
                      "group flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-colors",
                      activeConversationId === conv.id
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50 text-muted-foreground"
                    )}
                    onClick={() => handleSelectConversation(conv.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSelectConversation(conv.id); }}
                    aria-label={`Открыть чат: ${conv.title}`}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1">{conv.title}</span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Удалить чат: ${conv.title}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Удалить чат?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Чат "{conv.title}" и вся его история будут удалены безвозвратно.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отмена</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteConv.mutate({ id: conv.id })}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Удалить
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
                {conversationsQuery.data?.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Нет чатов. Начните новый разговор!
                  </p>
                )}
              </div>
            </ScrollArea>

            {/* Settings & User */}
            <Separator />
            <div className="p-3 space-y-2">
              <SettingsDialog />
              <div className="flex items-center gap-2 px-2 py-1">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-medium text-primary">
                    {user?.name?.charAt(0).toUpperCase() || "?"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{user?.name || "User"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user?.email || ""}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleLogout} aria-label="Выйти">
                  <LogOut className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border bg-card/50 backdrop-blur shrink-0">
          {!sidebarOpen && (
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="shrink-0" aria-label="Открыть боковую панель">
              <Menu className="h-4 w-4" />
            </Button>
          )}
          <Bot className="h-5 w-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold truncate">
              {activeConversationId
                ? (messagesQuery.data?.conversation?.title || "Чат")
                : "AI Blog Assistant"
              }
            </h1>
            <p className="text-[10px] text-muted-foreground">
              Управление Hugo-блогом через чат
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-hidden">
          {displayMessages.length === 0 && !activeConversationId ? (
            // Welcome screen
            <div className="flex h-full flex-col items-center justify-center p-6">
              <div className="flex flex-col items-center gap-4 mb-8">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">AI Blog Assistant</h2>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Управляйте Hugo-блогом через чат. Создавайте статьи, ищите изображения,
                  генерируйте контент и настраивайте систему — всё через диалог.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
                {SUGGESTED_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(prompt.text)}
                    disabled={sendMsg.isPending || createConv.isPending}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition-all hover:bg-accent hover:border-accent disabled:opacity-50"
                  >
                    <prompt.icon className={cn("h-4 w-4 shrink-0", prompt.color)} />
                    <span className="text-muted-foreground">{prompt.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full" ref={scrollRef}>
              <div className="flex flex-col gap-4 p-4 max-w-3xl mx-auto">
                {displayMessages.map((msg, idx) => {
                  if (msg.id === -1) {
                    // Loading indicator
                    return (
                      <div key="loading" className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                          <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        <div className="rounded-xl bg-muted px-4 py-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Думаю...</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const images = extractImages(msg.metadata ?? null);

                  return (
                    <div
                      key={`${msg.id}-${idx}`}
                      className={cn(
                        "flex gap-3",
                        msg.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      {msg.role === "assistant" && (
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                          <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                      )}

                      <div className={cn(
                        "max-w-[85%] rounded-xl px-4 py-3",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}>
                        {msg.role === "assistant" ? (
                          <div className="space-y-3">
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <Streamdown>{msg.content}</Streamdown>
                            </div>

                            {/* Render images if present */}
                            {images.length > 0 && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                                {images.map((img, i) => (
                                  <a
                                    key={i}
                                    href={img.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
                                  >
                                    <img
                                      src={img.thumb || img.url}
                                      alt={img.description || "Image"}
                                      className="w-full h-24 object-cover"
                                      loading="lazy"
                                    />
                                    {img.description && (
                                      <p className="text-[10px] text-muted-foreground p-1 truncate">
                                        {img.description}
                                      </p>
                                    )}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                        )}
                      </div>

                      {msg.role === "user" && (
                        <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
                          <User className="h-4 w-4 text-secondary-foreground" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-border bg-card/50 backdrop-blur p-4 shrink-0">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2 max-w-3xl mx-auto items-end"
          >
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Напишите сообщение... (Enter — отправить, Shift+Enter — новая строка)"
              className="flex-1 max-h-32 resize-none min-h-[42px] bg-background"
              rows={1}
              aria-label="Сообщение для AI-ассистента"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || sendMsg.isPending}
              className="shrink-0 h-[42px] w-[42px]"
              aria-label="Отправить сообщение"
            >
              {sendMsg.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Settings Dialog ───
function SettingsDialog() {
  const settingsQuery = trpc.chat.getSettings.useQuery(undefined, { refetchOnWindowFocus: false });
  const saveMutation = trpc.chat.saveSettings.useMutation({
    onSuccess: () => {
      toast.success("Настройки сохранены");
      settingsQuery.refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const [hugoUrl, setHugoUrl] = useState("");
  const [hugoKey, setHugoKey] = useState("");
  const [llmEndpoint, setLlmEndpoint] = useState("");
  const [llmModel, setLlmModel] = useState("");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [useLocal, setUseLocal] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) {
      setHugoUrl(settingsQuery.data.hugoUrl || "");
      setLlmEndpoint(settingsQuery.data.llmEndpoint || "");
      setLlmModel(settingsQuery.data.llmModel || "");
      setUseLocal(settingsQuery.data.useLocal || false);
    }
  }, [settingsQuery.data]);

  const handleSave = () => {
    saveMutation.mutate({
      hugoUrl: hugoUrl || undefined,
      hugoKey: hugoKey || undefined,
      llmEndpoint: llmEndpoint || undefined,
      llmModel: llmModel || undefined,
      llmApiKey: llmApiKey || undefined,
      useLocal,
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
          <Settings2 className="h-4 w-4" />
          Настройки
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Настройки</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Hugo API</h4>
            <div className="space-y-2">
              <Label htmlFor="hugo-url" className="text-xs">URL админ-панели Hugo</Label>
              <Input
                id="hugo-url"
                value={hugoUrl}
                onChange={(e) => setHugoUrl(e.target.value)}
                placeholder="https://admin.nodkeys.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hugo-key" className="text-xs">API Key</Label>
              <Input
                id="hugo-key"
                type="password"
                value={hugoKey}
                onChange={(e) => setHugoKey(e.target.value)}
                placeholder={settingsQuery.data?.hugoKeySet ? "••••••••" : "Введите API ключ"}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">LLM / Ollama</h4>
            <div className="flex items-center justify-between">
              <Label htmlFor="use-local" className="text-xs">Использовать локальную модель</Label>
              <Switch id="use-local" checked={useLocal} onCheckedChange={setUseLocal} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="llm-endpoint" className="text-xs">Endpoint URL</Label>
              <Input
                id="llm-endpoint"
                value={llmEndpoint}
                onChange={(e) => setLlmEndpoint(e.target.value)}
                placeholder="http://192.168.1.100:11434"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="llm-model" className="text-xs">Модель</Label>
              <Input
                id="llm-model"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                placeholder="llama3.2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="llm-key" className="text-xs">API Key (опционально)</Label>
              <Input
                id="llm-key"
                type="password"
                value={llmApiKey}
                onChange={(e) => setLlmApiKey(e.target.value)}
                placeholder="Для Ollama обычно не нужен"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">Отмена</Button>
          </DialogClose>
          <Button onClick={handleSave} size="sm" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
