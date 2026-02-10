import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Save, Loader2, Globe, Bot, CheckCircle2, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function SettingsPage() {
  // Hugo config
  const [hugoBaseUrl, setHugoBaseUrl] = useState("https://admin.nodkeys.com");
  const [hugoApiKey, setHugoApiKey] = useState("");

  // LLM config
  const [llmEndpoint, setLlmEndpoint] = useState("http://localhost:11434");
  const [llmModel, setLlmModel] = useState("llama3.2");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [useLocal, setUseLocal] = useState(false);

  const hugoConfig = trpc.hugo.getConfig.useQuery();
  const llmConfig = trpc.ai.getLlmConfig.useQuery();

  useEffect(() => {
    if (hugoConfig.data) {
      setHugoBaseUrl(hugoConfig.data.baseUrl || "https://admin.nodkeys.com");
      if (hugoConfig.data.apiKey) setHugoApiKey("");
    }
  }, [hugoConfig.data]);

  useEffect(() => {
    if (llmConfig.data) {
      setLlmEndpoint(llmConfig.data.endpoint || "http://localhost:11434");
      setLlmModel(llmConfig.data.model || "llama3.2");
      if (llmConfig.data.apiKey) setLlmApiKey("");
      setUseLocal(llmConfig.data.useLocal);
    }
  }, [llmConfig.data]);

  const saveHugoMutation = trpc.hugo.saveConfig.useMutation({
    onSuccess: () => {
      toast.success("Настройки Hugo сохранены");
      hugoConfig.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const saveLlmMutation = trpc.ai.saveLlmConfig.useMutation({
    onSuccess: () => {
      toast.success("Настройки LLM сохранены");
      llmConfig.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSaveHugo = () => {
    if (!hugoBaseUrl.trim()) { toast.error("Введите URL"); return; }
    if (!hugoApiKey.trim() && !hugoConfig.data?.apiKey) { toast.error("Введите API ключ"); return; }
    saveHugoMutation.mutate({
      baseUrl: hugoBaseUrl,
      apiKey: hugoApiKey || "unchanged",
    });
  };

  const handleSaveLlm = () => {
    saveLlmMutation.mutate({
      endpoint: llmEndpoint,
      model: llmModel,
      apiKey: llmApiKey || "unchanged",
      useLocal,
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Настройки</h1>
        <p className="text-muted-foreground mt-1">Конфигурация подключений и AI моделей</p>
      </div>

      {/* Hugo API Settings */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Globe className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <CardTitle className="text-foreground">Hugo API</CardTitle>
              <CardDescription>Подключение к админ-панели Hugo блога</CardDescription>
            </div>
          </div>
          {hugoConfig.data?.apiKey && (
            <div className="flex items-center gap-2 text-sm text-green-500 mt-2">
              <CheckCircle2 className="h-4 w-4" />
              Ключ настроен ({hugoConfig.data.apiKey})
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">Base URL</Label>
            <Input
              placeholder="https://admin.nodkeys.com"
              value={hugoBaseUrl}
              onChange={(e) => setHugoBaseUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">API Key</Label>
            <Input
              type="password"
              placeholder={hugoConfig.data?.apiKey ? "Оставьте пустым, чтобы не менять" : "Введите API ключ"}
              value={hugoApiKey}
              onChange={(e) => setHugoApiKey(e.target.value)}
            />
          </div>
          <Button onClick={handleSaveHugo} disabled={saveHugoMutation.isPending}>
            {saveHugoMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Сохранить
          </Button>
        </CardContent>
      </Card>

      {/* LLM Settings */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <CardTitle className="text-foreground">AI / LLM</CardTitle>
              <CardDescription>Настройка языковых моделей для генерации контента</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <Label className="text-foreground">Использовать локальную модель</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ollama, LM Studio или другой OpenAI-совместимый API
              </p>
            </div>
            <Switch checked={useLocal} onCheckedChange={setUseLocal} />
          </div>

          {!useLocal && (
            <div className="flex items-center gap-2 text-sm text-blue-500 p-3 rounded-lg bg-blue-500/5">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Используется встроенный AI (Manus LLM). Настройка не требуется.</span>
            </div>
          )}

          {useLocal && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-foreground">Endpoint URL</Label>
                <Input
                  placeholder="http://localhost:11434"
                  value={llmEndpoint}
                  onChange={(e) => setLlmEndpoint(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Ollama: http://localhost:11434 | LM Studio: http://localhost:1234
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Модель</Label>
                <Input
                  placeholder="llama3.2, mistral, gemma2..."
                  value={llmModel}
                  onChange={(e) => setLlmModel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">API Key (если требуется)</Label>
                <Input
                  type="password"
                  placeholder="Необязательно для Ollama"
                  value={llmApiKey}
                  onChange={(e) => setLlmApiKey(e.target.value)}
                />
              </div>
            </>
          )}

          <Button onClick={handleSaveLlm} disabled={saveLlmMutation.isPending}>
            {saveLlmMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Сохранить
          </Button>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="bg-card border-border">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong className="text-foreground">Режим AI:</strong> Если локальная модель не настроена, все AI-функции работают через встроенный Manus LLM.</p>
              <p><strong className="text-foreground">Ollama:</strong> Установите Ollama (ollama.ai), загрузите модель командой <code className="bg-muted px-1 rounded">ollama pull llama3.2</code> и укажите endpoint.</p>
              <p><strong className="text-foreground">LM Studio:</strong> Запустите локальный сервер в LM Studio и укажите его адрес.</p>
              <p><strong className="text-foreground">Fallback:</strong> При ошибке локальной модели система автоматически переключится на встроенный AI.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
