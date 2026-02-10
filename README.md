# AI Blog Bot

**Чат-бот для управления Hugo-блогом с AI-возможностями.**

Единый диалоговый интерфейс для полного управления контентом: создание и редактирование статей, поиск и генерация изображений, SEO-оптимизация — всё через чат с AI-ассистентом. Подключается к внешнему Ollama-серверу на отдельной VM для работы с локальными LLM.

---

## Возможности

| Функция | Описание |
|---------|----------|
| **Управление статьями** | Список, создание, редактирование, удаление статей через Hugo REST API |
| **AI-генерация статей** | Полное написание статей по теме с учётом контекста существующих публикаций |
| **AI-редактирование** | Улучшение, переписывание, дополнение существующего контента |
| **Поиск изображений** | Поиск изображений в интернете с превью и вставкой в статьи |
| **AI-генерация изображений** | Создание обложек и иллюстраций по текстовому описанию |
| **SEO-оптимизация** | Генерация мета-описаний, тегов, заголовков |
| **Управление настройками** | Конфигурация Hugo API и LLM через чат |
| **История разговоров** | Сохранение и управление историей чатов |
| **Локальные LLM** | Подключение к Ollama/LM Studio через OpenAI-совместимый API |

---

## Архитектура

```
┌─────────────────────────────────────────────────────┐
│                   Ваш браузер                       │
│              Чат-интерфейс (React)                  │
└──────────────────────┬──────────────────────────────┘
                       │ tRPC
┌──────────────────────▼──────────────────────────────┐
│              AI Blog Bot Server                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Chat     │  │ Hugo API │  │ Image Search /   │  │
│  │ Router   │  │ Proxy    │  │ Generation       │  │
│  └────┬─────┘  └──────────┘  └──────────────────┘  │
│       │                                              │
│  ┌────▼─────────────────────────────────────────┐   │
│  │  LLM Tool-Calling Engine                      │   │
│  │  (System prompt + 8 tools)                    │   │
│  └────┬─────────────────────────────────────────┘   │
└───────┼─────────────────────────────────────────────┘
        │
   ┌────▼────┐    ┌──────────┐    ┌──────────────┐
   │ Ollama  │    │  MySQL   │    │  Hugo Blog   │
   │ (VM 2)  │    │  (DB)    │    │  (REST API)  │
   └─────────┘    └──────────┘    └──────────────┘
```

### Схема развёртывания

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
| `list_articles` | Получить список статей блога |
| `get_article` | Получить полное содержимое статьи |
| `create_article` | Создать новую статью в Hugo |
| `update_article` | Обновить существующую статью |
| `search_images` | Поиск изображений в интернете |
| `generate_image` | Генерация изображения по описанию |
| `get_blog_stats` | Статистика блога |
| `get_settings` | Текущие настройки системы |

---

## Быстрый старт

### Вариант 1: Автоматическая установка (рекомендуется)

```bash
git clone https://github.com/sileade/ai-admin-panel.git
cd ai-admin-panel

# Запустить автоустановку с указанием IP Ollama-сервера
./setup.sh --auto --ollama 192.168.1.100
```

### Вариант 2: Ручная установка

```bash
git clone https://github.com/sileade/ai-admin-panel.git
cd ai-admin-panel

# Скопировать и отредактировать конфигурацию
cp docker/env.example .env
nano .env

# Запустить
docker compose --profile balanced up -d --build
```

### Вариант 3: Интерактивная установка

```bash
git clone https://github.com/sileade/ai-admin-panel.git
cd ai-admin-panel
./setup.sh
```

Скрипт пошагово проведёт через настройку: выбор профиля, конфигурация Ollama, Hugo API и базы данных.

---

## Настройка Ollama на отдельной VM

### Автоматическая установка

На VM, где будет работать Ollama:

```bash
curl -fsSL https://raw.githubusercontent.com/sileade/ai-admin-panel/main/docker/setup-ollama-remote.sh | bash
```

Скрипт автоматически установит Ollama, настроит приём удалённых подключений (`OLLAMA_HOST=0.0.0.0:11434`), скачает модель `llama3.2`, настроит systemd-сервис и выведет параметры подключения.

### Ручная установка

```bash
# Установить Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Настроить удалённый доступ
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/override.conf << 'EOF'
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_ORIGINS=*"
EOF

# Перезапустить и скачать модель
sudo systemctl daemon-reload
sudo systemctl restart ollama
ollama pull llama3.2

# Открыть порт
sudo ufw allow 11434/tcp
```

### Проверка подключения

```bash
curl http://<OLLAMA_IP>:11434/api/tags
```

### Рекомендуемые модели

| Модель | RAM | Описание |
|--------|-----|----------|
| `llama3.2` | 4 GB | Быстрая, хорошее качество (рекомендуется) |
| `llama3.2:70b` | 40 GB | Максимальное качество |
| `mistral` | 4 GB | Хорошая альтернатива |
| `qwen2.5:14b` | 10 GB | Отличная для русского языка |
| `gemma2:9b` | 6 GB | Сбалансированная |

---

## Профили развёртывания

| Профиль | Компоненты | RAM | Когда использовать |
|---------|-----------|-----|-------------------|
| `light` | Только приложение | ~256 MB | Есть внешний MySQL |
| `balanced` | Приложение + MySQL | ~512 MB | Стандартная установка |
| `full` | Приложение + MySQL + Nginx | ~768 MB | Продакшн с SSL |

```bash
docker compose --profile light up -d
docker compose --profile balanced up -d
docker compose --profile full up -d
```

---

## Использование

### Примеры команд чата

**Управление статьями:**
```
> Покажи список статей
> Покажи статистику блога
> Покажи статью "Введение в Docker"
> Создай статью про машинное обучение в 2025 году
> Отредактируй статью #5 — добавь раздел про безопасность
```

**AI-генерация:**
```
> Напиши статью про AI в 2025 году
> Напиши SEO-оптимизированную статью про Kubernetes
> Перепиши статью #3 в более профессиональном стиле
> Добавь в статью #7 раздел про мониторинг
```

**Изображения:**
```
> Найди изображения для статьи о технологиях
> Сгенерируй обложку для блога о программировании
> Создай иллюстрацию: минималистичный сервер в облаках
```

**Настройки:**
```
> Покажи текущие настройки
> Измени модель на qwen2.5:14b
```

---

## Конфигурация

### Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|-------------|
| `APP_PORT` | Порт приложения | `3000` |
| `OLLAMA_HOST` | URL Ollama-сервера | — |
| `OLLAMA_MODEL` | Модель для генерации | `llama3.2` |
| `HUGO_API_URL` | URL Hugo admin API | `https://admin.nodkeys.com` |
| `HUGO_API_KEY` | API-ключ Hugo | — |
| `MYSQL_ROOT_PASSWORD` | Пароль root MySQL | генерируется |
| `MYSQL_DATABASE` | Имя базы данных | `ai_blog_bot` |
| `MYSQL_USER` | Пользователь MySQL | `ai_blog_bot` |
| `MYSQL_PASSWORD` | Пароль MySQL | генерируется |
| `JWT_SECRET` | Секрет для JWT-токенов | генерируется |

---

## Управление

### Полезные команды

```bash
docker compose ps                    # Статус сервисов
docker compose logs -f app           # Логи приложения
docker compose restart app           # Перезапуск
docker compose down                  # Остановка
docker compose down -v               # Остановка с удалением данных
```

### Бэкап и восстановление

```bash
./docker/backup.sh                   # Создать бэкап
./docker/backup.sh /path/to/backups  # Бэкап в директорию
./docker/restore.sh backups/ai_blog_bot_20240101_120000.sql.gz  # Восстановить
```

### Обновление

```bash
./docker/update.sh                   # Автоматическое обновление
```

### Настройка SSL (профиль full)

```bash
cp fullchain.pem docker/nginx/ssl/
cp privkey.pem docker/nginx/ssl/
# Раскомментировать HTTPS-блок в docker/nginx/nginx.conf
docker compose restart nginx
```

---

## Структура проекта

```
ai-admin-panel/
├── client/                 # React фронтенд
│   └── src/pages/
│       ├── Chat.tsx        # Основной чат-интерфейс
│       └── Home.tsx        # Точка входа
├── server/                 # Express + tRPC бэкенд
│   ├── routers/
│   │   └── chat.ts        # Чат-роутер с AI tool-calling
│   ├── routers.ts          # Главный роутер
│   └── db.ts               # Запросы к БД
├── drizzle/
│   └── schema.ts           # Схема базы данных
├── docker/                 # Docker-инфраструктура
│   ├── mysql/init.sql      # Инициализация БД
│   ├── nginx/nginx.conf    # Конфигурация Nginx
│   ├── entrypoint.sh       # Точка входа контейнера
│   ├── env.example         # Шаблон переменных окружения
│   ├── backup.sh           # Скрипт бэкапа
│   ├── restore.sh          # Скрипт восстановления
│   ├── update.sh           # Скрипт обновления
│   └── setup-ollama-remote.sh  # Установка Ollama на VM
├── docker-compose.yml      # Docker Compose конфигурация
├── Dockerfile              # Сборка приложения
├── setup.sh                # Автоматический установщик
└── README.md
```

---

## Системные требования

### Сервер AI Blog Bot

| Параметр | Минимум | Рекомендуется |
|----------|---------|---------------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 512 MB | 1 GB |
| Диск | 2 GB | 5 GB |
| ОС | Ubuntu 20.04+ | Ubuntu 22.04 |
| Docker | 20.10+ | 24.0+ |

### Сервер Ollama (отдельная VM)

| Параметр | Минимум (7B модели) | Рекомендуется (14B+) |
|----------|--------------------|--------------------|
| CPU | 4 vCPU | 8 vCPU |
| RAM | 8 GB | 16 GB |
| GPU | Не обязательно | NVIDIA 8GB+ VRAM |
| Диск | 10 GB | 50 GB |

---

## Технологический стек

| Компонент | Технология |
|-----------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Backend | Express 4, tRPC 11, SuperJSON |
| Database | MySQL 8 (Drizzle ORM) |
| AI/LLM | OpenAI-compatible API (Ollama, LM Studio) |
| Images | AI Image Generation, Web Search |
| Auth | Manus OAuth |
| Testing | Vitest |
| Deploy | Docker Compose, Nginx |

---

## Лицензия

MIT License
