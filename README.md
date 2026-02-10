# AI Blog Bot — Telegram-бот для управления Hugo-блогом

Telegram-бот с AI-движком для полного управления Hugo-блогом: создание и редактирование статей, поиск и генерация изображений, SEO-оптимизация — всё через диалог в Telegram. Подключается к внешнему Ollama-серверу на отдельной VM для работы с локальными LLM.

## Возможности

| Функция | Описание |
|---------|----------|
| **Управление статьями** | Просмотр, создание, редактирование и удаление статей через Hugo REST API |
| **AI-генерация статей** | Полное написание статей по теме с учётом контекста существующих публикаций |
| **AI-редактирование** | Улучшение, переписывание и расширение существующего контента |
| **SEO-оптимизация** | Автоматическая генерация мета-описаний, тегов, заголовков |
| **Поиск изображений** | Поиск бесплатных фотографий в интернете с превью прямо в чате |
| **Генерация изображений** | Создание уникальных обложек и иллюстраций через AI |
| **Синхронизация с Hugo** | Двусторонняя синхронизация статей с Hugo-блогом |
| **Настройки через чат** | Конфигурация Hugo API и LLM прямо в Telegram |
| **Ограничение доступа** | Whitelist по Telegram user ID |

## Архитектура

```
┌─────────────────┐     ┌──────────────────────────────┐     ┌─────────────────┐
│   Telegram App   │────▶│    AI Blog Bot (Node.js)      │────▶│   Hugo Blog     │
│   (Пользователь) │◀────│                                │◀────│   (REST API)    │
└─────────────────┘     │  ┌────────────┐ ┌───────────┐  │     └─────────────────┘
                        │  │ grammy Bot │ │ LLM Engine│  │
                        │  └────────────┘ └───────────┘  │     ┌─────────────────┐
                        │  ┌────────────┐ ┌───────────┐  │────▶│   Ollama VM     │
                        │  │ Tool Calls │ │ Image Gen │  │◀────│   (Local LLM)   │
                        │  └────────────┘ └───────────┘  │     └─────────────────┘
                        │  ┌────────────────────────────┐│
                        │  │       MySQL Database       ││     ┌─────────────────┐
                        │  └────────────────────────────┘│────▶│   Unsplash API  │
                        └──────────────────────────────┘     │   (Изображения)  │
                                                              └─────────────────┘
```

### Схема развёртывания (две VM)

```
┌──────────────────────────┐     ┌──────────────────────────┐
│   VM 1: AI Blog Bot      │     │   VM 2: Ollama Server    │
│                          │     │                          │
│  ┌────────────────────┐  │     │  ┌────────────────────┐  │
│  │  Docker Compose     │  │     │  │  Ollama Service    │  │
│  │  ┌──────────────┐  │  │     │  │  ┌──────────────┐  │  │
│  │  │ Nginx (:80)  │  │  │     │  │  │ llama3.2     │  │  │
│  │  │ App (:3000)  │──│──│─────│──│──│ mistral      │  │  │
│  │  │ MySQL (:3306)│  │  │     │  │  │ qwen2.5      │  │  │
│  │  └──────────────┘  │  │     │  │  └──────────────┘  │  │
│  └────────────────────┘  │     │  │  Port: 11434       │  │
│                          │     │  └────────────────────┘  │
└──────────────────────────┘     └──────────────────────────┘
         HTTP :11434 ──────────────────►
```

**AI-инструменты бота (tool-calling):**

| Инструмент | Назначение |
|------------|------------|
| `list_articles` | Получить список статей блога с поиском |
| `get_article` | Получить полное содержимое статьи |
| `create_article` | Создать новую статью в Hugo |
| `edit_article` | Обновить существующую статью |
| `delete_article` | Удалить статью |
| `sync_articles` | Синхронизировать с Hugo |
| `get_stats` | Статистика блога |
| `search_images` | Поиск изображений в интернете |
| `generate_image` | Генерация изображения по описанию |
| `get_settings` / `save_settings` | Управление настройками |

## Быстрый старт

### Предварительные требования

- Docker и Docker Compose
- Telegram-аккаунт
- Ollama на отдельной VM (опционально)

### 1. Создание Telegram-бота

1. Откройте Telegram и найдите **@BotFather**
2. Отправьте `/newbot`
3. Следуйте инструкциям — задайте имя и username бота
4. Скопируйте полученный **токен** (формат: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Автоматическая установка (рекомендуется)

```bash
git clone https://github.com/sileade/ai-admin-panel.git
cd ai-admin-panel
chmod +x setup.sh

# Полностью автоматический режим
./setup.sh --auto --telegram <ВАШ_ТОКЕН> --ollama <IP_OLLAMA_VM>

# Или интерактивный режим
./setup.sh
```

### 3. Ручная установка

```bash
git clone https://github.com/sileade/ai-admin-panel.git
cd ai-admin-panel

# Скопировать и настроить .env
cp docker/env.example .env
nano .env  # Заполнить TELEGRAM_BOT_TOKEN и другие параметры

# Запустить
docker compose --profile balanced up -d --build
```

### 4. Проверка

```bash
# Статус контейнеров
docker compose ps

# Логи бота
docker compose logs -f app
# Должно появиться: [TG Bot] Running as @ваш_бот_username
```

Откройте Telegram, найдите вашего бота и отправьте `/start`.

## Команды бота

| Команда | Описание |
|---------|----------|
| `/start` | Главное меню с кнопками быстрого доступа |
| `/articles` | Список статей блога |
| `/stats` | Статистика блога |
| `/sync` | Синхронизация с Hugo |
| `/settings` | Текущие настройки |
| `/new` | Очистить контекст разговора |
| `/help` | Справка по командам |

Помимо команд, бот понимает **естественный язык**. Примеры:

- *«Покажи последние 5 статей»*
- *«Напиши статью про искусственный интеллект в медицине»*
- *«Улучши текст статьи about-us.md»*
- *«Найди изображения для статьи о космосе»*
- *«Сгенерируй обложку для блога в стиле digital art»*
- *«Оптимизируй SEO для статьи my-post.md»*
- *«Настрой Hugo API на https://admin.example.com с ключом abc123»*

Также можно отправить **фотографию** с подписью — бот обработает изображение.

## Настройка Ollama (отдельная VM)

### Автоматическая настройка

На машине с Ollama:

```bash
scp docker/setup-ollama-remote.sh user@ollama-vm:~/
ssh user@ollama-vm
chmod +x setup-ollama-remote.sh
./setup-ollama-remote.sh
```

### Ручная настройка

```bash
# Установка Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Скачать модель
ollama pull llama3.2

# Разрешить внешние подключения
sudo systemctl edit ollama.service
# Добавить:
# [Service]
# Environment="OLLAMA_HOST=0.0.0.0:11434"

sudo systemctl restart ollama

# Проверить
curl http://localhost:11434/api/tags
```

### Рекомендуемые модели

| Модель | RAM | Описание |
|--------|-----|----------|
| `llama3.2` | 4 GB | Быстрая, хорошее качество (рекомендуется) |
| `llama3.2:70b` | 40 GB | Максимальное качество |
| `mistral` | 4 GB | Хорошая альтернатива |
| `qwen2.5:14b` | 10 GB | Отличная для русского языка |
| `gemma2:9b` | 6 GB | Сбалансированная |

## Профили Docker Compose

| Профиль | Компоненты | RAM | Когда использовать |
|---------|-----------|-----|-------------------|
| `light` | Только приложение | ~256 MB | Есть внешний MySQL |
| `balanced` | Приложение + MySQL | ~512 MB | Стандартная установка |
| `full` | Приложение + MySQL + Nginx | ~768 MB | Продакшн с SSL |

```bash
docker compose --profile balanced up -d
```

## Переменные окружения

### Обязательные

| Переменная | Описание |
|-----------|----------|
| `TELEGRAM_BOT_TOKEN` | Токен от @BotFather |
| `DATABASE_URL` | MySQL connection string |
| `JWT_SECRET` | Секрет для JWT (генерируется setup.sh) |

### Опциональные

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `TELEGRAM_ALLOWED_USERS` | *(пусто = все)* | ID пользователей через запятую |
| `OLLAMA_HOST` | *(пусто)* | URL Ollama сервера (`http://IP:11434`) |
| `OLLAMA_MODEL` | `llama3.2` | Модель Ollama |
| `HUGO_API_URL` | *(пусто)* | URL Hugo Admin API |
| `HUGO_API_KEY` | *(пусто)* | API-ключ Hugo |
| `APP_PORT` | `3000` | Порт приложения |
| `MYSQL_PORT` | `3306` | Порт MySQL |

## Управление

### Логи

```bash
docker compose logs -f          # Все логи
docker compose logs -f app      # Только бот
docker compose logs -f mysql    # Только БД
```

### Бэкап и восстановление

```bash
./docker/backup.sh                                              # Создать бэкап
./docker/restore.sh backups/ai-blog-bot-2025-01-15-120000.sql.gz  # Восстановить
```

### Обновление

```bash
./docker/update.sh
```

### Остановка

```bash
docker compose down       # Остановить
docker compose down -v    # Остановить и удалить данные
```

## Безопасность

- **Ограничение доступа**: `TELEGRAM_ALLOWED_USERS` — whitelist по Telegram user ID
- **MySQL**: Привязан к `127.0.0.1`, недоступен извне
- **Секреты**: Генерируются автоматически через `openssl rand`
- **Ресурсы**: Лимиты памяти для каждого контейнера
- **Логи**: Ротация (max 20MB для приложения)
- **Санитизация**: Все аргументы LLM tool-calls проходят валидацию

## Структура проекта

```
ai-admin-panel/
├── server/
│   ├── telegram-bot.ts     # Telegram-бот с tool-calling движком (877 строк)
│   ├── db.ts               # Хелперы базы данных
│   ├── routers.ts          # tRPC роутеры (минимальный веб-сервер)
│   ├── storage.ts          # S3 хелперы
│   └── _core/              # Ядро: LLM, OAuth, env, image generation
├── drizzle/
│   └── schema.ts           # Схема БД (articles, settings, chat_messages)
├── client/
│   └── src/pages/Home.tsx  # Минимальная лендинг-страница
├── docker/
│   ├── entrypoint.sh       # Точка входа контейнера
│   ├── env.example         # Шаблон переменных окружения
│   ├── mysql/init.sql      # Инициализация БД
│   ├── nginx/nginx.conf    # Конфиг Nginx
│   ├── backup.sh           # Скрипт бэкапа
│   ├── restore.sh          # Скрипт восстановления
│   ├── update.sh           # Скрипт обновления
│   └── setup-ollama-remote.sh  # Настройка Ollama на VM
├── Dockerfile              # Multi-stage сборка
├── docker-compose.yml      # Docker Compose с профилями
├── setup.sh                # Автоматический установщик
└── README.md
```

## Системные требования

### Сервер AI Blog Bot

| Параметр | Минимум | Рекомендуется |
|----------|---------|---------------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 512 MB | 1 GB |
| Диск | 2 GB | 5 GB |
| ОС | Ubuntu 20.04+ | Ubuntu 22.04 |

### Сервер Ollama (отдельная VM)

| Параметр | Минимум (7B) | Рекомендуется (14B+) |
|----------|-------------|---------------------|
| CPU | 4 vCPU | 8 vCPU |
| RAM | 8 GB | 16 GB |
| GPU | Не обязательно | NVIDIA 8GB+ VRAM |
| Диск | 10 GB | 50 GB |

## Технологии

| Компонент | Технология |
|-----------|-----------|
| Telegram Bot | grammy (современный Telegram Bot Framework) |
| Backend | Node.js 22, Express 4, tRPC 11, TypeScript |
| AI/LLM | OpenAI-совместимый API, Ollama |
| Database | MySQL 8, Drizzle ORM |
| Images | AI Image Generation, Unsplash |
| Testing | Vitest (18+ тестов) |
| Deploy | Docker Compose, Nginx |

## Лицензия

MIT
