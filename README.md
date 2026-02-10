# AI Admin Panel — CMS с AI-ассистентом для Hugo-блога

Полноценная панель администратора и модератора сайта с интеграцией искусственного интеллекта для управления контентом Hugo-блога. Система поддерживает работу с локальными языковыми моделями (Ollama, LM Studio) через OpenAI-совместимый API на отдельной виртуальной машине, а также включает встроенный AI-движок как fallback.

---

## Возможности

### Управление контентом

Панель предоставляет полный цикл работы с контентом блога: от создания черновика до публикации. **Дашборд** отображает статистику блога (количество статей, черновики, опубликованные), последние статьи и быстрые действия. **Список статей** поддерживает полнотекстовый поиск по заголовкам и тегам, фильтрацию и сортировку по дате. **Редактор статей** включает Markdown-редактор с живым предпросмотром и управление метаданными (теги, категории, SEO-описание, обложка). Двусторонняя **синхронизация с Hugo** осуществляется через REST API админ-панели.

### AI-функции

**AI Генератор статей** выполняет полную генерацию статей по заданной теме с учётом контекста существующих статей блога, с настройкой стиля, длины и языка. **AI Редактор** предлагает 7 режимов обработки текста: улучшение, переписывание, расширение, сокращение, исправление грамматики, перевод и SEO-оптимизация. **AI SEO-оптимизатор** анализирует статью и генерирует оптимизированные заголовки, мета-описания, теги и рекомендации. **AI Ассистент** — интерактивный чат для помощи с написанием контента, стратегией блога и SEO.

### Изображения

Интеграция с **Unsplash** и **Pixabay** для поиска бесплатных фотографий с предпросмотром. **AI Генерация изображений** создаёт уникальные изображения по текстовому описанию. Быстрая вставка позволяет копировать URL или Markdown-код изображения для вставки в статью.

### Интеграция с LLM

Система реализует **3-уровневый AI**: External API → Local Model (Ollama) → Built-in AI (fallback). Поддерживаются Ollama, LM Studio и любой OpenAI-совместимый API. Настройка endpoint URL, модели и API-ключа выполняется через интерфейс настроек.

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
                       │ tRPC v11 + SuperJSON
┌──────────────────────┴──────────────────────────┐
│                   Backend                        │
│  Express 4 + tRPC Server                         │
│  ┌──────────┬──────────┬──────────┬──────────┐  │
│  │Hugo API  │ AI/LLM   │ Images   │ Storage  │  │
│  │Proxy     │ Engine   │ Search   │ S3       │  │
│  └──────────┴──────────┴──────────┴──────────┘  │
└──────┬──────────┬──────────┬──────────┬─────────┘
       │          │          │          │
  Hugo REST   Ollama VM   Unsplash/  MySQL 8
  API         (LLM)      Pixabay
```

### Схема развёртывания с Ollama на отдельной VM

```
┌──────────────────────────┐     ┌──────────────────────────┐
│   VM 1: AI Admin Panel   │     │   VM 2: Ollama Server    │
│                          │     │                          │
│  ┌────────────────────┐  │     │  ┌────────────────────┐  │
│  │  Docker Compose     │  │     │  │  Ollama Service    │  │
│  │  ┌──────────────┐  │  │     │  │  ┌──────────────┐  │  │
│  │  │ Nginx (:80)  │  │  │     │  │  │ llama3.2     │  │  │
│  │  │ App (:3000)  │──│──│─────│──│──│ mistral      │  │  │
│  │  │ MySQL (:3306)│  │  │     │  │  │ gemma2       │  │  │
│  │  └──────────────┘  │  │     │  │  └──────────────┘  │  │
│  └────────────────────┘  │     │  │  Port: 11434       │  │
│                          │     │  └────────────────────┘  │
└──────────────────────────┘     └──────────────────────────┘
         HTTP :11434 ──────────────────►
```

---

## Технологический стек

| Компонент | Технология |
|-----------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Backend | Express 4, tRPC 11, SuperJSON |
| Database | MySQL 8 (Drizzle ORM) |
| AI/LLM | OpenAI-compatible API (Ollama, LM Studio, Manus LLM) |
| Images | Unsplash API, Pixabay API, AI Image Generation |
| Storage | AWS S3 |
| Auth | Manus OAuth |
| Testing | Vitest |
| Deploy | Docker Compose, Nginx |

---

## Docker Deployment — Быстрый старт

### Предварительные требования

| Компонент | Минимум | Рекомендуется |
|-----------|---------|---------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 1 GB | 2 GB |
| Disk | 5 GB | 20 GB |
| Docker | 20.10+ | 24.0+ |
| Docker Compose | V2 | V2 |
| OS | Ubuntu 20.04+ | Ubuntu 22.04+ |

### Вариант 1: Автоматическое развёртывание (рекомендуется)

Один скрипт выполняет полную настройку: проверку зависимостей, конфигурацию, сборку и запуск.

```bash
# Клонировать репозиторий
git clone https://github.com/sileade/ai-admin-panel.git
cd ai-admin-panel

# Интерактивная установка (задаст вопросы)
chmod +x setup.sh
./setup.sh

# Или полностью автоматическая установка с Ollama
./setup.sh --auto --ollama 192.168.1.100:11434

# Или с выбором профиля
./setup.sh --profile full --ollama 10.0.0.50
```

Скрипт `setup.sh` автоматически выполняет следующие действия:

1. Проверяет наличие Docker и Docker Compose
2. Предлагает выбрать профиль развёртывания
3. Генерирует безопасные пароли и JWT-секреты
4. Настраивает подключение к Ollama
5. Собирает Docker-образ
6. Запускает все сервисы
7. Проверяет доступность и выводит итоговую информацию

### Вариант 2: Ручное развёртывание

```bash
git clone https://github.com/sileade/ai-admin-panel.git
cd ai-admin-panel

# Скопировать и отредактировать конфигурацию
cp docker/env.example .env
nano .env

# Собрать и запустить
docker compose --profile balanced up -d --build

# Проверить статус
docker compose ps
```

---

## Профили развёртывания

Система поддерживает три профиля, адаптированных под разные сценарии использования.

| Профиль | Состав | RAM | Описание |
|---------|--------|-----|----------|
| **light** | App | ~256 MB | Только приложение. Требуется внешняя MySQL |
| **balanced** | App + MySQL | ~512 MB | Рекомендуется. Включает MySQL 8 |
| **full** | App + MySQL + Nginx | ~768 MB | Полный стек с reverse proxy и SSL |

Профиль **balanced** является рекомендованным для большинства случаев. Профиль **light** подходит, если у вас уже есть MySQL-сервер. Профиль **full** добавляет Nginx reverse proxy с поддержкой SSL-сертификатов, rate limiting и кэшированием статики.

```bash
# Запуск с конкретным профилем
docker compose --profile light up -d
docker compose --profile balanced up -d
docker compose --profile full up -d
```

---

## Настройка Ollama на отдельной VM

### Шаг 1: Установка Ollama на VM

На виртуальной машине, где будет работать Ollama, выполните скрипт автоматической настройки:

```bash
# Вариант A: Скачать и запустить скрипт напрямую
curl -fsSL https://raw.githubusercontent.com/sileade/ai-admin-panel/main/docker/setup-ollama-remote.sh | bash

# Вариант B: Или вручную
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llama3.2
```

Скрипт `setup-ollama-remote.sh` автоматически выполняет следующие действия:

1. Устанавливает Ollama (если не установлен)
2. Настраивает `OLLAMA_HOST=0.0.0.0:11434` для приёма удалённых подключений
3. Настраивает `OLLAMA_ORIGINS=*` для CORS
4. Регистрирует и запускает systemd-сервис
5. Загружает указанную модель (по умолчанию `llama3.2`)
6. Выводит данные для подключения

### Шаг 2: Настройка удалённого доступа

Если вы устанавливали вручную, необходимо настроить Ollama для приёма подключений извне:

```bash
# Создать override для systemd
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/override.conf << EOF
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_ORIGINS=*"
EOF

# Перезапустить
sudo systemctl daemon-reload
sudo systemctl restart ollama

# Открыть порт в файрволе
sudo ufw allow 11434/tcp
```

### Шаг 3: Проверка подключения

С сервера AI Admin Panel выполните проверку доступности Ollama:

```bash
# Проверить доступность (замените IP на ваш)
curl http://192.168.1.100:11434/api/tags

# Тест генерации
curl http://192.168.1.100:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "Hello!",
  "stream": false
}'
```

### Шаг 4: Подключение к AI Admin Panel

В файле `.env` на сервере AI Admin Panel укажите адрес Ollama:

```env
OLLAMA_HOST=http://192.168.1.100:11434
OLLAMA_MODEL=llama3.2
```

Или через интерфейс: **Настройки → AI / LLM → Включить локальную модель → Указать endpoint**.

### Рекомендуемые модели

| Модель | Размер | RAM | Описание |
|--------|--------|-----|----------|
| `llama3.2` | 2 GB | 4 GB | Быстрая, хорошее качество текста |
| `llama3.2:70b` | 40 GB | 48 GB | Максимальное качество |
| `mistral` | 4 GB | 8 GB | Отличный баланс скорость/качество |
| `gemma2` | 5 GB | 8 GB | Google, хорош для контента |
| `qwen2.5` | 4 GB | 8 GB | Многоязычный, хорош для русского |
| `deepseek-r1` | 4 GB | 8 GB | Сильная модель для рассуждений |

```bash
# Загрузка нескольких моделей
ollama pull llama3.2
ollama pull mistral
ollama pull qwen2.5
```

---

## Конфигурация

### Переменные окружения

Все переменные задаются в файле `.env` в корне проекта. Шаблон находится в `docker/env.example`.

| Переменная | Описание | По умолчанию |
|------------|----------|-------------|
| `COMPOSE_PROFILES` | Профиль: light, balanced, full | `balanced` |
| `APP_PORT` | Порт приложения | `3000` |
| `MYSQL_ROOT_PASSWORD` | Пароль root MySQL | генерируется |
| `MYSQL_DATABASE` | Имя базы данных | `ai_admin_panel` |
| `MYSQL_USER` | Пользователь MySQL | `ai_admin` |
| `MYSQL_PASSWORD` | Пароль пользователя MySQL | генерируется |
| `DATABASE_URL` | Строка подключения к БД | авто |
| `JWT_SECRET` | Секрет для JWT-токенов | генерируется |
| `OLLAMA_HOST` | Адрес Ollama сервера | — |
| `OLLAMA_MODEL` | Модель по умолчанию | `llama3.2` |
| `HUGO_API_URL` | URL админ-панели Hugo | — |
| `HUGO_API_KEY` | API-ключ Hugo | — |

### Настройка SSL (профиль full)

Для включения HTTPS с Nginx необходимо выполнить следующие шаги:

```bash
# 1. Поместить сертификаты
cp fullchain.pem docker/nginx/ssl/
cp privkey.pem docker/nginx/ssl/

# 2. Раскомментировать HTTPS-блок в docker/nginx/nginx.conf
# 3. Раскомментировать редирект HTTP → HTTPS
# 4. Перезапустить Nginx
docker compose restart nginx
```

Для автоматического получения сертификатов Let's Encrypt можно использовать certbot:

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/nginx/ssl/
cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/nginx/ssl/
```

---

## Управление

### Основные команды

```bash
# Статус сервисов
docker compose ps

# Логи приложения (в реальном времени)
docker compose logs -f app

# Логи всех сервисов
docker compose logs -f

# Перезапуск приложения
docker compose restart app

# Остановка всех сервисов
docker compose down

# Остановка с удалением данных (ОСТОРОЖНО!)
docker compose down -v
```

### Резервное копирование

```bash
# Создать бэкап базы данных
./docker/backup.sh

# Создать бэкап в указанную директорию
./docker/backup.sh /path/to/backups

# Восстановить из бэкапа
./docker/restore.sh backups/ai_admin_panel_20240101_120000.sql.gz
```

Скрипт бэкапа автоматически хранит последние 10 копий и удаляет старые.

### Обновление

```bash
# Автоматическое обновление (бэкап → pull → build → restart)
./docker/update.sh

# Или вручную
git pull origin main
docker compose --profile balanced build --no-cache
docker compose --profile balanced up -d
```

---

## Структура проекта

```
ai-admin-panel/
├── Dockerfile                    # Multi-stage production build
├── docker-compose.yml            # Docker Compose с профилями
├── setup.sh                      # One-command auto-deployment
├── docker/
│   ├── env.example               # Шаблон переменных окружения
│   ├── entrypoint.sh             # Startup: DB wait + migration + health
│   ├── backup.sh                 # Бэкап базы данных
│   ├── restore.sh                # Восстановление из бэкапа
│   ├── update.sh                 # Автоматическое обновление
│   ├── setup-ollama-remote.sh    # Установка Ollama на удалённой VM
│   ├── mysql/
│   │   └── init.sql              # Инициализация схемы БД
│   └── nginx/
│       ├── nginx.conf            # Reverse proxy + SSL + caching
│       └── ssl/                  # SSL-сертификаты (создать вручную)
├── client/                       # Frontend (React 19)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx          # Дашборд
│   │   │   ├── Articles.tsx      # Список статей
│   │   │   ├── Editor.tsx        # Markdown-редактор
│   │   │   ├── AiGenerate.tsx    # AI генерация статей
│   │   │   ├── AiEdit.tsx        # AI редактирование
│   │   │   ├── Images.tsx        # Поиск/генерация изображений
│   │   │   ├── Assistant.tsx     # AI чат-ассистент
│   │   │   └── Settings.tsx      # Настройки
│   │   └── components/           # UI компоненты (shadcn/ui)
│   └── index.html
├── server/                       # Backend (Express + tRPC)
│   ├── routers/
│   │   ├── hugo.ts               # Hugo API прокси
│   │   └── ai.ts                 # AI/LLM роутер
│   ├── routers.ts                # Главный роутер
│   ├── db.ts                     # Database helpers
│   └── storage.ts                # S3 storage
├── drizzle/                      # Database schema & migrations
│   └── schema.ts
└── shared/                       # Shared types
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

## Troubleshooting

### Приложение не запускается

```bash
# Проверить логи
docker compose logs app

# Проверить статус MySQL
docker compose logs mysql

# Проверить health check
docker inspect --format='{{.State.Health.Status}}' ai-admin-app
```

### Ollama недоступен

```bash
# Проверить с сервера AI Admin Panel
curl http://OLLAMA_IP:11434/api/tags

# На Ollama VM проверить, что слушает на 0.0.0.0
sudo ss -tlnp | grep 11434

# Проверить файрвол
sudo ufw status
```

### Ошибки базы данных

```bash
# Подключиться к MySQL
docker exec -it ai-admin-db mysql -u ai_admin -p ai_admin_panel

# Проверить таблицы
SHOW TABLES;

# Восстановить из бэкапа при необходимости
./docker/restore.sh backups/latest_backup.sql.gz
```

---

## Лицензия

MIT

---

## Автор

Создано с помощью Manus AI для управления контентом блога [nodkeys.com](https://nodkeys.com).
