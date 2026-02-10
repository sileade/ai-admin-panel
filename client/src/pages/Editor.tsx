import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, Eye, Code, ArrowLeft, Sparkles } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

export default function Editor() {
  const params = useParams<{ filename?: string }>();
  const [, setLocation] = useLocation();
  const filename = params.filename ? decodeURIComponent(params.filename) : null;
  const isEditing = !!filename;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [categories, setCategories] = useState("");
  const [draft, setDraft] = useState(false);
  const [coverImage, setCoverImage] = useState("");
  const [activeTab, setActiveTab] = useState("editor");

  const article = trpc.hugo.getArticle.useQuery(
    { filename: filename! },
    { enabled: isEditing }
  );

  useEffect(() => {
    if (article.data) {
      setTitle(article.data.title || "");
      setContent(article.data.content || "");
      setDescription(article.data.description || "");
      setTags(article.data.tags || "");
      setCategories(article.data.categories || "");
      setDraft(article.data.draft ?? false);
      setCoverImage(article.data.coverImage || "");
    }
  }, [article.data]);

  const utils = trpc.useUtils();
  const createMutation = trpc.hugo.createArticle.useMutation({
    onSuccess: (data) => {
      toast.success("Статья создана!");
      utils.hugo.listArticles.invalidate();
      utils.hugo.getStats.invalidate();
      setLocation("/articles");
    },
    onError: (err) => toast.error(err.message),
  });

  const editMutation = trpc.hugo.editArticle.useMutation({
    onSuccess: () => {
      toast.success("Статья сохранена!");
      utils.hugo.listArticles.invalidate();
      utils.hugo.getArticle.invalidate({ filename: filename! });
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = () => {
    if (!title.trim()) { toast.error("Введите заголовок"); return; }
    if (isEditing) {
      editMutation.mutate({ filename: filename!, title, content, description, tags, categories, draft, coverImage });
    } else {
      createMutation.mutate({ title, content, description, tags, categories, draft, coverImage });
    }
  };

  const isSaving = createMutation.isPending || editMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/articles")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {isEditing ? "Редактирование статьи" : "Новая статья"}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing && (
            <Button variant="outline" size="sm" onClick={() => setLocation(`/ai-edit/${encodeURIComponent(filename!)}`)}>
              <Sparkles className="h-4 w-4 mr-2" />
              AI Редактор
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-4">
          <Input
            placeholder="Заголовок статьи"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-semibold h-12"
          />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="editor" className="gap-2">
                <Code className="h-4 w-4" />
                Редактор
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2">
                <Eye className="h-4 w-4" />
                Предпросмотр
              </TabsTrigger>
            </TabsList>
            <TabsContent value="editor" className="mt-2">
              <Textarea
                placeholder="Напишите содержание статьи в формате Markdown..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[500px] font-mono text-sm resize-y"
              />
            </TabsContent>
            <TabsContent value="preview" className="mt-2">
              <Card className="min-h-[500px] bg-card">
                <CardContent className="p-6 prose-preview">
                  {content ? (
                    <Streamdown>{content}</Streamdown>
                  ) : (
                    <p className="text-muted-foreground italic">Предпросмотр будет здесь...</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar - Metadata */}
        <div className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground">Метаданные</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Описание (SEO)</Label>
                <Textarea
                  placeholder="Краткое описание для SEO..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Теги</Label>
                <Input
                  placeholder="tag1, tag2, tag3"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Категории</Label>
                <Input
                  placeholder="category1, category2"
                  value={categories}
                  onChange={(e) => setCategories(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Обложка (URL)</Label>
                <Input
                  placeholder="https://..."
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                />
                {coverImage && (
                  <img src={coverImage} alt="Cover" className="w-full h-32 object-cover rounded-lg mt-2" />
                )}
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-foreground">Черновик</Label>
                <Switch checked={draft} onCheckedChange={setDraft} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
