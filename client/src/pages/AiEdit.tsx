import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wand2, Loader2, Copy, ArrowLeft, Save, ArrowRight, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import { Streamdown } from "streamdown";

const ACTIONS = [
  { value: "improve", label: "Улучшить", desc: "Исправить грамматику, улучшить читаемость" },
  { value: "rewrite", label: "Переписать", desc: "Полностью переписать с новой перспективой" },
  { value: "expand", label: "Расширить", desc: "Добавить деталей и примеров" },
  { value: "shorten", label: "Сократить", desc: "Сделать более кратким" },
  { value: "fix_grammar", label: "Грамматика", desc: "Исправить ошибки" },
  { value: "translate", label: "Перевести", desc: "Перевести на другой язык" },
  { value: "seo_optimize", label: "SEO", desc: "Оптимизировать для поисковиков" },
] as const;

type ActionType = typeof ACTIONS[number]["value"];

export default function AiEdit() {
  const params = useParams<{ filename?: string }>();
  const [, setLocation] = useLocation();
  const filename = params.filename ? decodeURIComponent(params.filename) : null;

  const [content, setContent] = useState("");
  const [action, setAction] = useState<ActionType>("improve");
  const [language, setLanguage] = useState("English");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [result, setResult] = useState("");

  const article = trpc.hugo.getArticle.useQuery(
    { filename: filename! },
    { enabled: !!filename }
  );

  useEffect(() => {
    if (article.data?.content) {
      setContent(article.data.content);
    }
  }, [article.data]);

  const editMutation = trpc.ai.editArticle.useMutation({
    onSuccess: (data) => {
      setResult(data.content);
      toast.success("Текст обработан!");
    },
    onError: (err) => toast.error(err.message),
  });

  const seoMutation = trpc.ai.optimizeSeo.useMutation({
    onSuccess: (data) => {
      setResult(JSON.stringify(data, null, 2));
      toast.success("SEO анализ завершён!");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleEdit = () => {
    if (!content.trim()) { toast.error("Вставьте текст для обработки"); return; }
    editMutation.mutate({ content, action, language, additionalInstructions });
  };

  const handleSeoOptimize = () => {
    if (!content.trim()) { toast.error("Вставьте текст"); return; }
    seoMutation.mutate({
      title: article.data?.title || "Untitled",
      content,
      currentTags: article.data?.tags || "",
    });
  };

  const handleApplyResult = () => {
    setContent(result);
    setResult("");
    toast.success("Результат применён к тексту");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    toast.success("Скопировано");
  };

  const isPending = editMutation.isPending || seoMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation(filename ? `/editor/${encodeURIComponent(filename)}` : "/articles")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">AI Редактор</h1>
          <p className="text-muted-foreground mt-1">
            {filename ? `Редактирование: ${article.data?.title || filename}` : "Вставьте текст для обработки AI"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground">Исходный текст</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Вставьте текст статьи для обработки AI..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
              />

              <div className="space-y-3">
                <Label className="text-foreground">Действие</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ACTIONS.map((a) => (
                    <Button
                      key={a.value}
                      variant={action === a.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAction(a.value)}
                      className="text-xs h-auto py-2 flex flex-col"
                    >
                      <span>{a.label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {action === "translate" && (
                <div className="space-y-2">
                  <Label className="text-foreground">Язык перевода</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Russian">Русский</SelectItem>
                      <SelectItem value="Ukrainian">Українська</SelectItem>
                      <SelectItem value="German">Deutsch</SelectItem>
                      <SelectItem value="French">Français</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-foreground">Дополнительные инструкции</Label>
                <Input
                  placeholder="Необязательно..."
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleEdit} disabled={isPending}>
                  {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
                  {isPending ? "Обработка..." : "Обработать"}
                </Button>
                <Button variant="outline" onClick={handleSeoOptimize} disabled={isPending}>
                  <Search className="h-4 w-4 mr-2" />
                  SEO
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Result */}
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-medium text-foreground">Результат</CardTitle>
              {result && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    <Copy className="h-3 w-3 mr-1" />
                    Копировать
                  </Button>
                  <Button size="sm" onClick={handleApplyResult}>
                    <ArrowRight className="h-3 w-3 mr-1" />
                    Применить
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isPending ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-4" />
                  <p>AI обрабатывает текст...</p>
                </div>
              ) : result ? (
                <div className="prose-preview max-h-[500px] overflow-y-auto">
                  <Streamdown>{result}</Streamdown>
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <Wand2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Выберите действие и нажмите "Обработать"</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
