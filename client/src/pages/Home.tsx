import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, FilePlus, Eye, PenLine, Sparkles, RefreshCw, Image, Bot } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Home() {
  const [, setLocation] = useLocation();
  const stats = trpc.hugo.getStats.useQuery();
  const articles = trpc.hugo.listArticles.useQuery({ limit: 5 });
  const syncMutation = trpc.hugo.syncArticles.useMutation({
    onSuccess: (data) => {
      toast.success(`Синхронизировано ${data.synced} статей`);
      stats.refetch();
      articles.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Дашборд</h1>
          <p className="text-muted-foreground mt-1">Обзор контента и быстрые действия</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          Синхронизировать
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Всего статей</p>
                {stats.isLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{stats.data?.total ?? 0}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Eye className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Опубликовано</p>
                {stats.isLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{stats.data?.published ?? 0}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <PenLine className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Черновики</p>
                {stats.isLoading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{stats.data?.drafts ?? 0}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">AI Функции</p>
                <p className="text-2xl font-bold text-foreground">5</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 bg-card hover:bg-accent" onClick={() => setLocation("/editor")}>
          <FilePlus className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Новая статья</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 bg-card hover:bg-accent" onClick={() => setLocation("/ai-generate")}>
          <Sparkles className="h-5 w-5 text-purple-500" />
          <span className="text-sm font-medium">AI Генерация</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 bg-card hover:bg-accent" onClick={() => setLocation("/images")}>
          <Image className="h-5 w-5 text-green-500" />
          <span className="text-sm font-medium">Изображения</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 bg-card hover:bg-accent" onClick={() => setLocation("/assistant")}>
          <Bot className="h-5 w-5 text-blue-500" />
          <span className="text-sm font-medium">AI Ассистент</span>
        </Button>
      </div>

      {/* Recent Articles */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground">Последние статьи</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/articles")}>
            Все статьи →
          </Button>
        </CardHeader>
        <CardContent>
          {articles.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : articles.data?.items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Статьи не найдены</p>
              <p className="text-sm mt-1">Синхронизируйте с Hugo или создайте новую статью</p>
            </div>
          ) : (
            <div className="space-y-2">
              {articles.data?.items.map((article) => (
                <div
                  key={article.filename}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group"
                  onClick={() => setLocation(`/editor/${encodeURIComponent(article.filename)}`)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-foreground group-hover:text-primary transition-colors">
                      {article.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {article.draft ? (
                        <Badge variant="secondary" className="text-xs">Черновик</Badge>
                      ) : (
                        <Badge variant="default" className="text-xs bg-green-500/10 text-green-500 hover:bg-green-500/20">Опубликовано</Badge>
                      )}
                      {article.tags && (
                        <span className="text-xs text-muted-foreground truncate">
                          {article.tags}
                        </span>
                      )}
                    </div>
                  </div>
                  <PenLine className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
