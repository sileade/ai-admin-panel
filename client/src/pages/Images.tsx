import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Sparkles, Loader2, Copy, ExternalLink, Download, Image as ImageIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type SearchImage = {
  id: string;
  url: string;
  thumb: string;
  small: string;
  description: string;
  author: string;
  authorUrl: string;
  downloadUrl: string;
};

export default function Images() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchImage[]>([]);
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [generateStyle, setGenerateStyle] = useState("");
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("search");

  const searchMutation = trpc.ai.searchImages.useMutation({
    onSuccess: (data) => {
      setSearchResults(data.images);
      if (data.images.length === 0) toast.info("Изображения не найдены");
    },
    onError: (err) => toast.error(err.message),
  });

  const generateMutation = trpc.ai.generateImage.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        setGeneratedImages((prev) => [data.url!, ...prev]);
        toast.success("Изображение сгенерировано!");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) { toast.error("Введите запрос"); return; }
    searchMutation.mutate({ query: searchQuery });
  };

  const handleGenerate = () => {
    if (!generatePrompt.trim()) { toast.error("Введите описание"); return; }
    generateMutation.mutate({ prompt: generatePrompt, style: generateStyle });
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL скопирован");
  };

  const copyMarkdown = (url: string, alt: string) => {
    navigator.clipboard.writeText(`![${alt}](${url})`);
    toast.success("Markdown скопирован");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Изображения</h1>
        <p className="text-muted-foreground mt-1">Поиск и генерация изображений для статей</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="search" className="gap-2">
            <Search className="h-4 w-4" />
            Поиск
          </TabsTrigger>
          <TabsTrigger value="generate" className="gap-2">
            <Sparkles className="h-4 w-4" />
            AI Генерация
          </TabsTrigger>
        </TabsList>

        {/* Search Tab */}
        <TabsContent value="search" className="space-y-4 mt-4">
          <div className="flex gap-2">
            <Input
              placeholder="Поиск изображений..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={searchMutation.isPending}>
              {searchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Найти
            </Button>
          </div>

          {searchMutation.isPending ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {searchResults.map((img) => (
                <Card key={img.id} className="overflow-hidden group cursor-pointer bg-card border-border hover:border-primary/50 transition-colors">
                  <div className="relative aspect-[4/3]" onClick={() => setSelectedImage(img.url)}>
                    <img src={img.small || img.thumb} alt={img.description} className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                        <Button size="icon" variant="secondary" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); copyUrl(img.url); }}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="secondary" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); copyMarkdown(img.url, img.description); }}>
                          <ImageIcon className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-2">
                    <p className="text-xs text-muted-foreground truncate">{img.description || "No description"}</p>
                    <p className="text-xs text-muted-foreground/70 truncate">by {img.author}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Введите запрос для поиска изображений</p>
              <p className="text-sm mt-1">Бесплатные фото из Unsplash и Pixabay</p>
            </div>
          )}
        </TabsContent>

        {/* Generate Tab */}
        <TabsContent value="generate" className="space-y-4 mt-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Генерация изображений
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Описание изображения *</Label>
                <Textarea
                  placeholder="Опишите желаемое изображение... Например: Современный сервер в дата-центре с голубой подсветкой"
                  value={generatePrompt}
                  onChange={(e) => setGeneratePrompt(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Стиль (необязательно)</Label>
                <Input
                  placeholder="photorealistic, digital art, illustration, minimalist..."
                  value={generateStyle}
                  onChange={(e) => setGenerateStyle(e.target.value)}
                />
              </div>
              <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="w-full">
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Генерация (10-20 сек)...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Сгенерировать
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {generatedImages.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {generatedImages.map((url, i) => (
                <Card key={i} className="overflow-hidden group cursor-pointer bg-card border-border hover:border-primary/50 transition-colors">
                  <div className="relative aspect-square" onClick={() => setSelectedImage(url)}>
                    <img src={url} alt={`Generated ${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                        <Button size="icon" variant="secondary" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); copyUrl(url); }}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="secondary" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); copyMarkdown(url, "AI Generated"); }}>
                          <ImageIcon className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-foreground">Предпросмотр</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="space-y-4">
              <img src={selectedImage} alt="Preview" className="w-full rounded-lg" />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => copyUrl(selectedImage)}>
                  <Copy className="h-4 w-4 mr-2" />
                  URL
                </Button>
                <Button variant="outline" size="sm" onClick={() => copyMarkdown(selectedImage, "Image")}>
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Markdown
                </Button>
                <Button size="sm" asChild>
                  <a href={selectedImage} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Открыть
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
