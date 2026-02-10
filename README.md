# AI Admin Panel — CMS с AI-ассистентом для Hugo-блога

Полноценная панель администратора и модератора сайта с интеграцией искусственного интеллекта для управления контентом Hugo-блога. Система поддерживает работу с локальными языковыми моделями (Ollama, LM Studio) через OpenAI-совместимый API, а также включает встроенный AI-движок как fallback.

---

## Возможности

### Управление контентом
- **Дашборд** — обзор статистики блога (количество статей, черновики, опубликованные), последние статьи, быстрые действия
- **Список статей** — полнотекстовый поиск по заголовкам и тегам, фильтрация, сортировка по дате
- **Редактор статей** — Markdown-редактор с живым предпросмотром, управление метаданными (теги, категории, SEO-описание, обложка)
- **Синхронизация с Hugo** — двусторонняя синхронизация статей через REST API админ-панели Hugo

### AI-функции
- **AI Генератор статей** — полная генерация статей по заданной теме с учётом контекста существующих статей блога, настройка стиля, длины и языка
- **AI Редактор** — 7 режимов обработки текста: улучшение, переписывание, расширение, сокращение, исправление грамматики, перевод, SEO-оптимизация
- **AI SEO-оптимизатор** — анализ статьи и генерация оптимизированных заголовков, мета-описаний, тегов и рекомендаций
- **AI Ассистент** — интерактивный чат для помощи с написанием контента, стратегией блога и SEO

### Изображения
- **Поиск изображений** — интеграция с Unsplash и Pixabay для поиска бесплатных фотографий с предпросмотром
- **AI Генерация изображений** — создание уникальных изображений по текстовому описанию
- **Быстрая вставка** — копирование URL или Markdown-кода изображения для вставки в статью

### Интеграция с LLM
- **Локальные модели** — поддержка Ollama, LM Studio и любого OpenAI-совместимого API
- **3-уровневый AI** — External API → Local Model (Ollama) → Built-in AI (fallback)
- **Настраиваемый endpoint** — выбор модели, endpoint URL, API-ключ через интерфейс настроек

---

## Архитектура

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│  React 19 + Tailwind CSS 4 + shadcn/ui          │
│  ┌──────────┬──────────┬──────────┬──────────┐  │
│  │Dashboard │ Articles │ AI Tools │ Settings │  │
│  └──────────┴──────────┴──────────┴──────────┘  │
│                    tRPC Client                   │
└──────────────────────┬──────────────────────────┘
                       │
                  tRPC v11 + SuperJSON
                       │
┌──────────────────────┴──────────────────────────┐
│                   Backend                        │
│  Express 4 + tRPC Server                         │
│  ┌──────────┬──────────┬──────────┬──────────┐  │
│  │Hugo API  │ AI/LLM   │ Images   │ Storage  │  │
│  │Proxy     │ Engine   │ Search   │ S3       │  │
│  └──────────┴──────────┴──────────┴──────────┘  │
└──────┬──────────┬──────────┬──────────┬─────────┘
       │          │          │          │
  Hugo REST   LLM APIs   Unsplash/  MySQL/TiDB
  API         (Ollama/   Pixabay
              Manus)
```

---

## Технологический стек

| Компонент | Технология |
|-----------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Backend | Express 4, tRPC 11, SuperJSON |
| Database | MySQL / TiDB (Drizzle ORM) |
| AI/LLM | OpenAI-compatible API (Ollama, LM Studio, Manus LLM) |
| Images | Unsplash API, Pixabay API, AI Image Generation |
| Storage | AWS S3 |
| Auth | Manus OAuth |
| Testing | Vitest |

---

## Быстрый старт

### Предварительные требования

- Node.js 22+
- pnpm 10+
- MySQL или TiDB (для базы данных)
- Ollama (опционально, для локальных моделей)

### Установка

```bash
# Клонировать репозиторий
git clone https://github.com/sileade/ai-admin-panel.git
cd ai-admin-panel

# Установить зависимости
pnpm install

# Настроить переменные окружения
cp .env.example .env
# Отредактировать .env файл

# Применить миграции базы данных
pnpm db:push

# Запустить в режиме разработки
pnpm dev
```

### Переменные окружения

```env
DATABASE_URL=mysql://user:password@host:port/database
JWT_SECRET=your-jwt-secret
VITE_APP_ID=your-app-id
OAUTH_SERVER_URL=https://api.manus.im
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=your-forge-key
```

---

## Настройка AI

### Встроенный AI (по умолчанию)

Система использует встроенный Manus LLM без дополнительной настройки. Все AI-функции работают сразу после развёртывания.

### Локальная модель (Ollama)

```bash
# Установить Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Загрузить модель
ollama pull llama3.2

# Модель будет доступна на http://localhost:11434
```

В настройках панели:
1. Перейдите в **Настройки → AI / LLM**
2. Включите переключатель **"Использовать локальную модель"**
3. Укажите endpoint: `http://localhost:11434`
4. Укажите модель: `llama3.2`

### LM Studio

1. Запустите LM Studio и загрузите модель
2. Включите локальный сервер (обычно на порту 1234)
3. В настройках укажите endpoint: `http://localhost:1234`

---

## Настройка Hugo API

1. Перейдите в **Настройки → Hugo API**
2. Укажите **Base URL** вашей админ-панели Hugo (например, `https://admin.nodkeys.com`)
3. Введите **API Key** для аутентификации
4. Нажмите **Сохранить**
5. На дашборде нажмите **Синхронизировать** для загрузки статей

---

## Структура проекта

```
ai-admin-panel/
├── client/                  # Frontend (React)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx         # Дашборд
│   │   │   ├── Articles.tsx     # Список статей
│   │   │   ├── Editor.tsx       # Редактор статей
│   │   │   ├── AiGenerate.tsx   # AI генерация
│   │   │   ├── AiEdit.tsx       # AI редактирование
│   │   │   ├── Images.tsx       # Поиск/генерация изображений
│   │   │   ├── Assistant.tsx    # AI ассистент
│   │   │   └── Settings.tsx     # Настройки
│   │   ├── components/          # UI компоненты
│   │   └── lib/trpc.ts          # tRPC клиент
│   └── index.html
├── server/                  # Backend (Express + tRPC)
│   ├── routers/
│   │   ├── hugo.ts              # Hugo API прокси
│   │   └── ai.ts                # AI/LLM роутер
│   ├── routers.ts               # Главный роутер
│   ├── db.ts                    # Database helpers
│   └── storage.ts               # S3 storage
├── drizzle/                 # Database schema
│   └── schema.ts
├── shared/                  # Shared types
└── package.json
```

---

## API Endpoints (tRPC)

### Hugo Router (`trpc.hugo.*`)

| Процедура | Тип | Описание |
|-----------|-----|----------|
| `getConfig` | Query | Получить конфигурацию Hugo API |
| `saveConfig` | Mutation | Сохранить конфигурацию Hugo API |
| `syncArticles` | Mutation | Синхронизировать статьи из Hugo |
| `listArticles` | Query | Список статей с поиском и пагинацией |
| `getArticle` | Query | Получить статью по filename |
| `createArticle` | Mutation | Создать статью на Hugo |
| `editArticle` | Mutation | Редактировать статью на Hugo |
| `deleteArticle` | Mutation | Удалить статью |
| `getStats` | Query | Статистика статей |

### AI Router (`trpc.ai.*`)

| Процедура | Тип | Описание |
|-----------|-----|----------|
| `getLlmConfig` | Query | Получить конфигурацию LLM |
| `saveLlmConfig` | Mutation | Сохранить конфигурацию LLM |
| `generateArticle` | Mutation | Сгенерировать статью по теме |
| `editArticle` | Mutation | AI-редактирование текста |
| `optimizeSeo` | Mutation | SEO-оптимизация статьи |
| `chat` | Mutation | Чат с AI-ассистентом |
| `generateImage` | Mutation | Генерация изображения |
| `searchImages` | Mutation | Поиск изображений |
| `getHistory` | Query | История AI-генераций |

---

## Тестирование

```bash
# Запуск всех тестов
pnpm test

# Тесты покрывают:
# - Аутентификация (auth.me, auth.logout)
# - Контроль доступа (admin-only процедуры)
# - Hugo API роутер (getStats, listArticles, getConfig)
# - AI роутер (getLlmConfig, access control)
```

---

## Скрипты

```bash
pnpm dev          # Запуск в режиме разработки
pnpm build        # Сборка для продакшена
pnpm start        # Запуск продакшен-сборки
pnpm test         # Запуск тестов
pnpm db:push      # Применить миграции БД
pnpm check        # TypeScript проверка типов
pnpm format       # Форматирование кода
```

---

## Лицензия

MIT

---

## Автор

Создано с помощью Manus AI для управления контентом блога [nodkeys.com](https://nodkeys.com).
