import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Search, Plus, Trash2, PenLine, Wand2, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

export default function Articles() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const articles = trpc.hugo.listArticles.useQuery({ search: searchQuery, limit: 50 });
  const utils = trpc.useUtils();
  const deleteMutation = trpc.hugo.deleteArticle.useMutation({
    onSuccess: () => {
      toast.success("Статья удалена");
      utils.hugo.listArticles.invalidate();
      utils.hugo.getStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSearch = () => setSearchQuery(search);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Статьи</h1>
          <p className="text-muted-foreground mt-1">
            {articles.data ? `${articles.data.total} статей` : "Загрузка..."}
          </p>
        </div>
        <Button onClick={() => setLocation("/editor")}>
          <Plus className="h-4 w-4 mr-2" />
          Новая статья
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по заголовку или тегам..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button variant="secondary" onClick={handleSearch}>Найти</Button>
      </div>

      {/* Articles List */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {articles.isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : articles.data?.items.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg">Статьи не найдены</p>
              <p className="text-sm mt-1">Синхронизируйте с Hugo или создайте новую статью</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {articles.data?.items.map((article) => (
                <div key={article.filename} className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors">
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate text-foreground">{article.title}</h3>
                      {article.draft ? (
                        <Badge variant="secondary" className="text-xs shrink-0">Черновик</Badge>
                      ) : (
                        <Badge variant="default" className="text-xs shrink-0 bg-green-500/10 text-green-500 hover:bg-green-500/20">Опубликовано</Badge>
                      )}
                    </div>
                    {article.description && (
                      <p className="text-sm text-muted-foreground truncate">{article.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      {article.tags?.split(",").filter(Boolean).slice(0, 4).map((tag) => (
                        <Badge key={tag.trim()} variant="outline" className="text-xs">
                          {tag.trim()}
                        </Badge>
                      ))}
                      <span className="text-xs text-muted-foreground">
                        {article.updatedAt ? new Date(article.updatedAt).toLocaleDateString("ru-RU") : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setLocation(`/editor/${encodeURIComponent(article.filename)}`)}
                      title="Редактировать"
                    >
                      <PenLine className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setLocation(`/ai-edit/${encodeURIComponent(article.filename)}`)}
                      title="AI Редактирование"
                    >
                      <Wand2 className="h-4 w-4" />
                    </Button>
                    {article.hugoUrl && (
                      <Button variant="ghost" size="icon" asChild title="Открыть на сайте">
                        <a href={article.hugoUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" title="Удалить">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Удалить статью?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Статья "{article.title}" будет удалена с сайта и из локальной базы. Это действие необратимо.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отмена</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate({ filename: article.filename })}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Удалить
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
