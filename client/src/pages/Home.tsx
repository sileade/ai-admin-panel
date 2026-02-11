import { Bot, MessageSquare, FileText, Image, Sparkles, Settings, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: FileText, title: "Управление статьями", desc: "Создание, редактирование, удаление и синхронизация с Hugo" },
  { icon: Sparkles, title: "AI-генерация контента", desc: "Полное написание статей с учётом контекста блога" },
  { icon: MessageSquare, title: "AI-редактирование", desc: "Улучшение, переписывание и оптимизация текста" },
  { icon: Image, title: "Работа с изображениями", desc: "Поиск фото и AI-генерация уникальных иллюстраций" },
  { icon: Bot, title: "Локальные модели", desc: "Работа через Ollama/LM Studio без внешних API" },
  { icon: Settings, title: "Гибкие настройки", desc: "Настройка Hugo API, LLM и поиска изображений" },
];

const COMMANDS = [
  { cmd: "/start", desc: "Главное меню с кнопками" },
  { cmd: "/articles", desc: "Список статей блога" },
  { cmd: "/stats", desc: "Статистика блога" },
  { cmd: "/sync", desc: "Синхронизация с Hugo" },
  { cmd: "/settings", desc: "Текущие настройки" },
  { cmd: "/new", desc: "Новый контекст разговора" },
];

export default function Home() {
  const botUsername = import.meta.env.VITE_TG_BOT_USERNAME || "your_bot";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/10 to-transparent" />
        <div className="container relative py-20 md:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm mb-8">
              <Bot className="w-4 h-4" />
              Telegram Bot
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              AI Blog Bot
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Управляйте Hugo-блогом через Telegram. AI-ассистент для создания, редактирования и оптимизации контента — прямо из мессенджера.
            </p>
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" className="gap-2 text-lg px-8 py-6 bg-blue-600 hover:bg-blue-700">
                Открыть в Telegram
                <ArrowRight className="w-5 h-5" />
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="container py-20">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Возможности</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {FEATURES.map((f, i) => (
            <div key={i} className="p-6 rounded-xl bg-card border border-border hover:border-blue-500/30 transition-colors">
              <f.icon className="w-8 h-8 text-blue-400 mb-4" />
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Commands */}
      <div className="container py-20">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Команды бота</h2>
        <div className="max-w-lg mx-auto bg-card border border-border rounded-xl overflow-hidden">
          {COMMANDS.map((c, i) => (
            <div key={i} className={`flex items-center gap-4 px-6 py-4 ${i > 0 ? "border-t border-border" : ""}`}>
              <code className="text-blue-400 font-mono text-sm min-w-[100px]">{c.cmd}</code>
              <span className="text-sm text-muted-foreground">{c.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Natural language examples */}
      <div className="container py-20">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Просто напишите</h2>
        <p className="text-center text-muted-foreground mb-12">Бот понимает естественный язык</p>
        <div className="max-w-2xl mx-auto grid gap-3">
          {[
            "Напиши статью про искусственный интеллект в 2025 году",
            "Покажи все статьи с тегом devops",
            "Сгенерируй обложку для статьи о кибербезопасности",
            "Улучши текст статьи about-us.md — сделай его более профессиональным",
            "Найди фотографии серверных комнат для статьи",
            "Оптимизируй SEO для статьи getting-started.md",
          ].map((ex, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
              <MessageSquare className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <span className="text-sm">{ex}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container text-center text-sm text-muted-foreground">
          AI Blog Bot — Telegram-бот для управления Hugo-блогом с AI-ассистентом
        </div>
      </footer>
    </div>
  );
}
