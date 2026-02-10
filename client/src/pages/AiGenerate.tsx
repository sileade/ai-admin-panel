import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Loader2, Copy, Save, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Streamdown } from "streamdown";

export default function AiGenerate() {
  const [, setLocation] = useLocation();
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("");
  const [length, setLength] = useState<"short" | "medium" | "long">("medium");
  const [language, setLanguage] = useState("Russian");
  const [includeContext, setIncludeContext] = useState(true);
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [result, setResult] = useState<any>(null);

  const generateMutation = trpc.ai.generateArticle.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success("Статья сгенерирована!");
    },
    onError: (err) => toast.error(err.message),
  });

  const utils = trpc.useUtils();
  const createMutation = trpc.hugo.createArticle.useMutation({
    onSuccess: () => {
      toast.success("Статья опубликована на Hugo!");
      utils.hugo.listArticles.invalidate();
      utils.hugo.getStats.invalidate();
      setLocation("/articles");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!topic.trim()) { toast.error("Введите тему статьи"); return; }
    generateMutation.mutate({ topic, style, length, language, includeContext, additionalInstructions });
  };

  const handlePublish = () => {
    if (!result) return;
    createMutation.mutate({
      title: result.title || topic,
      content: result.content || "",
      description: result.description || "",
      tags: result.tags || "",
      categories: result.categories || "",
      draft: false,
    });
  };

  const handleCopy = () => {
    if (result?.content) {
      navigator.clipboard.writeText(result.content);
      toast.success("Скопировано в буфер обмена");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Генератор статей</h1>
        <p className="text-muted-foreground mt-1">Создайте полноценную статью с помощью AI</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Параметры генерации
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Тема статьи *</Label>
                <Textarea
                  placeholder="Например: Как развернуть AI-ассистента на локальном сервере с помощью Ollama..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Стиль написания</Label>
                <Input
                  placeholder="Технический, разговорный, академический..."
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Длина</Label>
                  <Select value={length} onValueChange={(v) => setLength(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Короткая (500-800 слов)</SelectItem>
                      <SelectItem value="medium">Средняя (1000-1500 слов)</SelectItem>
                      <SelectItem value="long">Длинная (2000-3000 слов)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Язык</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Russian">Русский</SelectItem>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Ukrainian">Українська</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Дополнительные инструкции</Label>
                <Textarea
                  placeholder="Дополнительные пожелания к генерации..."
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Учитывать контекст блога</Label>
                  <p className="text-xs text-muted-foreground">AI изучит существующие статьи</p>
                </div>
                <Switch checked={includeContext} onCheckedChange={setIncludeContext} />
              </div>

              <Button
                className="w-full"
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Генерация...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Сгенерировать статью
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Result */}
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-foreground">Результат</CardTitle>
              {result && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="h-4 w-4 mr-1" />
                    Копировать
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    setLocation("/editor");
                    // Store in sessionStorage for the editor to pick up
                    sessionStorage.setItem("ai_generated", JSON.stringify(result));
                  }}>
                    <FileText className="h-4 w-4 mr-1" />
                    В редактор
                  </Button>
                  <Button size="sm" onClick={handlePublish} disabled={createMutation.isPending}>
                    <Save className="h-4 w-4 mr-1" />
                    Опубликовать
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {generateMutation.isPending ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-4" />
                  <p>AI генерирует статью...</p>
                  <p className="text-sm mt-1">Это может занять 30-60 секунд</p>
                </div>
              ) : result ? (
                <div className="space-y-4">
                  {result.title && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Заголовок</Label>
                      <p className="font-semibold text-lg text-foreground">{result.title}</p>
                    </div>
                  )}
                  {result.description && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Описание</Label>
                      <p className="text-sm text-muted-foreground">{result.description}</p>
                    </div>
                  )}
                  {result.tags && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Теги</Label>
                      <p className="text-sm text-foreground">{result.tags}</p>
                    </div>
                  )}
                  <div className="border-t border-border pt-4 prose-preview max-h-[500px] overflow-y-auto">
                    <Streamdown>{result.content || ""}</Streamdown>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Введите тему и нажмите "Сгенерировать"</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
