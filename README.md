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

<!-- KANEO-PROCESS-DOCS:START -->

## Управляемая документация проекта и процессов

**Проект:** AI Admin Panel  
**Kaneo ID:** `bu3lyzrzpp20l5exf9l8zd43`  
**Slug:** `HUGOAI`  
**Текущий repository:** `ai-admin-panel`  
**Документационная ветка:** `kaneo-processes`  
**Количество этапов:** 9  
**Статус задач:** `To Do`

> Этот раздел синхронизирован с карточкой проекта и уникальными процессными задачами Kaneo. Рабочая default branch не изменяется; обновляется только документационная ветка.

### Назначение и контекст

Проект HUGOAI (AI Admin Panel) представляет собой Telegram-бот на Node.js для управления Hugo-блогом. Он предоставляет возможности по созданию, редактированию и удалению статей через Hugo REST API, а также AI-генерации и редактированию контента.

Бот интегрируется с внешним сервером Ollama на отдельной виртуальной машине для работы с локальными LLM (например, llama3.2, mistral). Взаимодействие пользователя происходит через Telegram, а бот использует tool-calling для выполнения различных операций, включая поиск изображений через Unsplash API и синхронизацию с Hugo.

Текущий статус проекта — доработка, с фокусом на завершение RBAC, аудита и deployment workflow. Архитектура включает Docker Compose с профилями для разных сред, базу данных MySQL и интеграцию с внешними сервисами.

### Миссия

Обеспечить удобное и безопасное администрирование Hugo-контента через Telegram с использованием AI-инструментов для генерации и оптимизации статей.

### Входит в scope

- Управление статьями (создание, редактирование, удаление)
- AI-генерация и редактирование статей через Ollama
- SEO-оптимизация и генерация мета-данных
- Поиск и генерация изображений
- Синхронизация с Hugo
- Настройка через Telegram чат
- Ограничение доступа по Telegram user ID (RBAC)
- Аудит действий пользователя
- Deployment workflow (Docker Compose)

### Не входит в scope

- Разработка фронтенда самого Hugo-блога
- Хостинг и управление инфраструктурой Ollama (кроме интеграции)
- Поддержка других мессенджеров кроме Telegram

### Репозитории проекта

- **ai-admin-panel**: [Forgejo](https://git.nodkeys.com/ilea/ai-admin-panel) · [GitHub](https://github.com/sileade/ai-admin-panel) · [Process branch](https://git.nodkeys.com/ilea/ai-admin-panel/src/branch/kaneo-processes/README.md)

### Компоненты

| Компонент | Роль | Подтверждение/проверка |
|---|---|---|
| Telegram Bot (Node.js) | Основной интерфейс взаимодействия с пользователем и оркестратор | Telegram-бот с tool-calling движком (877 строк) |
| Ollama Server | Локальный LLM-движок для генерации контента | Подключается к внешнему Ollama-серверу на отдельной VM |
| MySQL Database | Хранение статей, настроек и сообщений чата | Схема БД (articles, settings, chat_messages) |
| Hugo Blog (REST API) | Целевая система управления контентом | Управление статьями через Hugo REST API |

### Зависимости

- Docker и Docker Compose
- Telegram API
- Ollama (внешняя VM)
- Unsplash API
- Hugo REST API

### Карта процесса

| № | Код | Этап | Приоритет | Контрольная точка |
|---:|---|---|---|---|
| 1 | `[HUGOAI-P01]` | AI Admin Panel — HUGOAI-PNN-1: Анализ текущей реализации RBAC и определение требований | `high` | [HUGOAI-P01-C01] AI Admin Panel — контроль результата «AI Admin Panel — HUGOAI-PNN-1: Анализ текущей реализации RBAC и определение требований»: Дизайн расширенной модели RBAC утвержден |
| 2 | `[HUGOAI-P02]` | AI Admin Panel — HUGOAI-PNN-2: Реализация расширенной модели RBAC в базе данных | `high` | [HUGOAI-P02-C01] AI Admin Panel — контроль результата «AI Admin Panel — HUGOAI-PNN-2: Реализация расширенной модели RBAC в базе данных»: Миграции БД для RBAC успешно применены |
| 3 | `[HUGOAI-P03]` | AI Admin Panel — HUGOAI-PNN-3: Интеграция RBAC в Telegram-бот | `high` | [HUGOAI-P03-C01] AI Admin Panel — контроль результата «AI Admin Panel — HUGOAI-PNN-3: Интеграция RBAC в Telegram-бот»: Проверка прав доступа работает для всех команд |
| 4 | `[HUGOAI-P04]` | AI Admin Panel — HUGOAI-PNN-4: Проектирование системы аудита действий | `medium` | [HUGOAI-P04-C01] AI Admin Panel — контроль результата «AI Admin Panel — HUGOAI-PNN-4: Проектирование системы аудита действий»: Структура системы аудита утверждена |
| 5 | `[HUGOAI-P05]` | AI Admin Panel — HUGOAI-PNN-5: Реализация системы аудита | `medium` | [HUGOAI-P05-C01] AI Admin Panel — контроль результата «AI Admin Panel — HUGOAI-PNN-5: Реализация системы аудита»: Записи аудита корректно сохраняются в БД |
| 6 | `[HUGOAI-P06]` | AI Admin Panel — HUGOAI-PNN-6: Разработка интерфейса просмотра аудита | `low` | [HUGOAI-P06-C01] AI Admin Panel — контроль результата «AI Admin Panel — HUGOAI-PNN-6: Разработка интерфейса просмотра аудита»: Команда /audit возвращает корректные логи |
| 7 | `[HUGOAI-P07]` | AI Admin Panel — HUGOAI-PNN-7: Анализ и улучшение deployment workflow | `medium` | [HUGOAI-P07-C01] AI Admin Panel — контроль результата «AI Admin Panel — HUGOAI-PNN-7: Анализ и улучшение deployment workflow»: План улучшения deployment workflow составлен |
| 8 | `[HUGOAI-P08]` | AI Admin Panel — HUGOAI-PNN-8: Внедрение улучшений в скрипты развертывания | `medium` | [HUGOAI-P08-C01] AI Admin Panel — контроль результата «AI Admin Panel — HUGOAI-PNN-8: Внедрение улучшений в скрипты развертывания»: Обновленные скрипты развертывания успешно протестированы |
| 9 | `[HUGOAI-P09]` | AI Admin Panel — HUGOAI-PNN-9: Настройка CI/CD pipeline | `medium` | [HUGOAI-P09-C01] AI Admin Panel — контроль результата «AI Admin Panel — HUGOAI-PNN-9: Настройка CI/CD pipeline»: CI pipeline успешно выполняется при пуше |

### Детальные этапы

#### [HUGOAI-P01] AI Admin Panel — HUGOAI-PNN-1: Анализ текущей реализации RBAC и определение требований

**Приоритет:** `high`

**Цель этапа**

Проанализировать существующий механизм ограничения доступа (TELEGRAM_ALLOWED_USERS) и спроектировать расширенную модель RBAC.

**Входы и зависимости**

- Исходный код server/telegram-bot.ts
- Конфигурация .env (TELEGRAM_ALLOWED_USERS)
- Схема БД (drizzle/schema.ts)

**Шаги выполнения**

1. [HUGOAI-P01-S01] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-1: Анализ текущей реализации RBAC и определение требований»: Изучить текущую реализацию проверки Telegram user ID.
2. [HUGOAI-P01-S02] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-1: Анализ текущей реализации RBAC и определение требований»: Спроектировать структуру таблиц для хранения ролей и разрешений.
3. [HUGOAI-P01-S03] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-1: Анализ текущей реализации RBAC и определение требований»: Определить набор базовых ролей (например, admin, editor, viewer).
4. [HUGOAI-P01-S04] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-1: Анализ текущей реализации RBAC и определение требований»: Разработать план миграции существующих пользователей на новую модель.

**Контрольная точка**

[HUGOAI-P01-C01] AI Admin Panel — контроль результата «AI Admin Panel — HUGOAI-PNN-1: Анализ текущей реализации RBAC и определение требований»: Дизайн расширенной модели RBAC утвержден

**Критерии приёмки**

- [HUGOAI-P01-A01] Для результата «AI Admin Panel — HUGOAI-PNN-1: Анализ текущей реализации RBAC и определение требований»: Документ с описанием ролевой модели создан.
- [HUGOAI-P01-A02] Для результата «AI Admin Panel — HUGOAI-PNN-1: Анализ текущей реализации RBAC и определение требований»: Схема новых таблиц БД для RBAC спроектирована.
- [HUGOAI-P01-A03] Для результата «AI Admin Panel — HUGOAI-PNN-1: Анализ текущей реализации RBAC и определение требований»: План миграции данных описан.

**Артефакты**

- rbac_design_doc.md
- db_schema_update.sql

**Риски и откат**

Риск нарушения доступа текущих пользователей. Откат: использование старого механизма TELEGRAM_ALLOWED_USERS.

#### [HUGOAI-P02] AI Admin Panel — HUGOAI-PNN-2: Реализация расширенной модели RBAC в базе данных

**Приоритет:** `high`

**Цель этапа**

Внедрить спроектированную модель RBAC в базу данных MySQL.

**Входы и зависимости**

- Схема БД (drizzle/schema.ts)
- Дизайн расширенной модели RBAC (из задачи 1)

**Шаги выполнения**

1. [HUGOAI-P02-S01] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-2: Реализация расширенной модели RBAC в базе данных»: Создать миграции для новых таблиц ролей и разрешений.
2. [HUGOAI-P02-S02] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-2: Реализация расширенной модели RBAC в базе данных»: Обновить drizzle/schema.ts с новыми сущностями.
3. [HUGOAI-P02-S03] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-2: Реализация расширенной модели RBAC в базе данных»: Применить миграции к тестовой базе данных.
4. [HUGOAI-P02-S04] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-2: Реализация расширенной модели RBAC в базе данных»: Написать скрипт для инициализации базовых ролей.

**Контрольная точка**

[HUGOAI-P02-C01] AI Admin Panel — контроль результата «AI Admin Panel — HUGOAI-PNN-2: Реализация расширенной модели RBAC в базе данных»: Миграции БД для RBAC успешно применены

**Критерии приёмки**

- [HUGOAI-P02-A01] Для результата «AI Admin Panel — HUGOAI-PNN-2: Реализация расширенной модели RBAC в базе данных»: Таблицы ролей и разрешений созданы в БД.
- [HUGOAI-P02-A02] Для результата «AI Admin Panel — HUGOAI-PNN-2: Реализация расширенной модели RBAC в базе данных»: drizzle/schema.ts обновлен и компилируется без ошибок.
- [HUGOAI-P02-A03] Для результата «AI Admin Panel — HUGOAI-PNN-2: Реализация расширенной модели RBAC в базе данных»: Базовые роли успешно инициализированы скриптом.

**Артефакты**

- migrations/*.sql
- drizzle/schema.ts

**Риски и откат**

Риск потери данных при миграции. Откат: восстановление БД из резервной копии (backup.sh).

#### [HUGOAI-P03] AI Admin Panel — HUGOAI-PNN-3: Интеграция RBAC в Telegram-бот

**Приоритет:** `high`

**Цель этапа**

Обновить логику обработки команд в боте для использования новой модели RBAC.

**Входы и зависимости**

- Исходный код server/telegram-bot.ts
- Новая схема БД с RBAC

**Шаги выполнения**

1. [HUGOAI-P03-S01] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-3: Интеграция RBAC в Telegram-бот»: Реализовать middleware для проверки прав доступа к командам.
2. [HUGOAI-P03-S02] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-3: Интеграция RBAC в Telegram-бот»: Применить middleware к существующим командам (/articles, /sync, /settings).
3. [HUGOAI-P03-S03] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-3: Интеграция RBAC в Telegram-бот»: Добавить команды для управления ролями (например, назначение роли пользователю).
4. [HUGOAI-P03-S04] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-3: Интеграция RBAC в Telegram-бот»: Протестировать доступность команд для разных ролей.

**Контрольная точка**

[HUGOAI-P03-C01] AI Admin Panel — контроль результата «AI Admin Panel — HUGOAI-PNN-3: Интеграция RBAC в Telegram-бот»: Проверка прав доступа работает для всех команд

**Критерии приёмки**

- [HUGOAI-P03-A01] Для результата «AI Admin Panel — HUGOAI-PNN-3: Интеграция RBAC в Telegram-бот»: Middleware для проверки прав реализован и подключен.
- [HUGOAI-P03-A02] Для результата «AI Admin Panel — HUGOAI-PNN-3: Интеграция RBAC в Telegram-бот»: Команды управления ролями добавлены и функционируют.
- [HUGOAI-P03-A03] Для результата «AI Admin Panel — HUGOAI-PNN-3: Интеграция RBAC в Telegram-бот»: Тесты подтверждают корректное ограничение доступа на основе ролей.

**Артефакты**

- server/telegram-bot.ts
- server/middlewares/rbac.ts

**Риски и откат**

Риск блокировки администраторов. Откат: временное отключение middleware RBAC.

#### [HUGOAI-P04] AI Admin Panel — HUGOAI-PNN-4: Проектирование системы аудита действий

**Приоритет:** `medium`

**Цель этапа**

Спроектировать систему логирования и аудита действий пользователей в Telegram-боте.

**Входы и зависимости**

- Текущая система логирования (docker compose logs)
- Требования к аудиту

**Шаги выполнения**

1. [HUGOAI-P04-S01] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-4: Проектирование системы аудита действий»: Определить перечень критичных действий для аудита (создание, редактирование, удаление статей, изменение настроек).
2. [HUGOAI-P04-S02] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-4: Проектирование системы аудита действий»: Спроектировать структуру таблицы audit_logs в БД.
3. [HUGOAI-P04-S03] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-4: Проектирование системы аудита действий»: Определить формат записей аудита (timestamp, user_id, action, details).
4. [HUGOAI-P04-S04] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-4: Проектирование системы аудита действий»: Разработать механизм ротации и архивирования логов аудита.

**Контрольная точка**

[HUGOAI-P04-C01] AI Admin Panel — контроль результата «AI Admin Panel — HUGOAI-PNN-4: Проектирование системы аудита действий»: Структура системы аудита утверждена

**Критерии приёмки**

- [HUGOAI-P04-A01] Для результата «AI Admin Panel — HUGOAI-PNN-4: Проектирование системы аудита действий»: Перечень действий для аудита задокументирован.
- [HUGOAI-P04-A02] Для результата «AI Admin Panel — HUGOAI-PNN-4: Проектирование системы аудита действий»: Схема таблицы audit_logs спроектирована.
- [HUGOAI-P04-A03] Для результата «AI Admin Panel — HUGOAI-PNN-4: Проектирование системы аудита действий»: Механизм ротации логов описан.

**Артефакты**

- audit_design_doc.md
- db_schema_audit.sql

**Риски и откат**

Риск избыточного логирования и переполнения БД. Откат: корректировка перечня действий для аудита.

#### [HUGOAI-P05] AI Admin Panel — HUGOAI-PNN-5: Реализация системы аудита

**Приоритет:** `medium`

**Цель этапа**

Внедрить систему аудита действий пользователей в код бота и базу данных.

**Входы и зависимости**

- Дизайн системы аудита (из задачи 4)
- Исходный код server/telegram-bot.ts
- Схема БД (drizzle/schema.ts)

**Шаги выполнения**

1. [HUGOAI-P05-S01] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-5: Реализация системы аудита»: Создать миграцию для таблицы audit_logs.
2. [HUGOAI-P05-S02] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-5: Реализация системы аудита»: Обновить drizzle/schema.ts.
3. [HUGOAI-P05-S03] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-5: Реализация системы аудита»: Реализовать функцию записи в audit_logs.
4. [HUGOAI-P05-S04] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-5: Реализация системы аудита»: Интегрировать запись аудита в обработчики критичных команд.

**Контрольная точка**

[HUGOAI-P05-C01] AI Admin Panel — контроль результата «AI Admin Panel — HUGOAI-PNN-5: Реализация системы аудита»: Записи аудита корректно сохраняются в БД

**Критерии приёмки**

- [HUGOAI-P05-A01] Для результата «AI Admin Panel — HUGOAI-PNN-5: Реализация системы аудита»: Таблица audit_logs создана в БД.
- [HUGOAI-P05-A02] Для результата «AI Admin Panel — HUGOAI-PNN-5: Реализация системы аудита»: Функция записи аудита реализована и протестирована.
- [HUGOAI-P05-A03] Для результата «AI Admin Panel — HUGOAI-PNN-5: Реализация системы аудита»: Критичные действия успешно логируются в БД.

**Артефакты**

- migrations/audit.sql
- server/db.ts
- server/telegram-bot.ts

**Риски и откат**

Риск снижения производительности из-за записи в БД. Откат: асинхронная запись логов или временное отключение аудита.

#### [HUGOAI-P06] AI Admin Panel — HUGOAI-PNN-6: Разработка интерфейса просмотра аудита

**Приоритет:** `low`

**Цель этапа**

Добавить команду в Telegram-бот для просмотра логов аудита администраторами.

**Входы и зависимости**

- Таблица audit_logs в БД
- Система RBAC (из задачи 3)

**Шаги выполнения**

1. [HUGOAI-P06-S01] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-6: Разработка интерфейса просмотра аудита»: Реализовать функцию выборки логов аудита из БД с фильтрацией (по пользователю, дате, действию).
2. [HUGOAI-P06-S02] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-6: Разработка интерфейса просмотра аудита»: Добавить команду /audit в Telegram-бот.
3. [HUGOAI-P06-S03] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-6: Разработка интерфейса просмотра аудита»: Ограничить доступ к команде /audit только для администраторов (через RBAC).
4. [HUGOAI-P06-S04] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-6: Разработка интерфейса просмотра аудита»: Настроить форматирование вывода логов в Telegram-сообщении.

**Контрольная точка**

[HUGOAI-P06-C01] AI Admin Panel — контроль результата «AI Admin Panel — HUGOAI-PNN-6: Разработка интерфейса просмотра аудита»: Команда /audit возвращает корректные логи

**Критерии приёмки**

- [HUGOAI-P06-A01] Для результата «AI Admin Panel — HUGOAI-PNN-6: Разработка интерфейса просмотра аудита»: Команда /audit добавлена и доступна только администраторам.
- [HUGOAI-P06-A02] Для результата «AI Admin Panel — HUGOAI-PNN-6: Разработка интерфейса просмотра аудита»: Логи корректно извлекаются из БД с учетом фильтров.
- [HUGOAI-P06-A03] Для результата «AI Admin Panel — HUGOAI-PNN-6: Разработка интерфейса просмотра аудита»: Вывод логов в Telegram читаем и не превышает лимиты длины сообщения.

**Артефакты**

- server/telegram-bot.ts
- server/db.ts

**Риски и откат**

Риск превышения лимита длины сообщения Telegram. Откат: пагинация вывода логов.

#### [HUGOAI-P07] AI Admin Panel — HUGOAI-PNN-7: Анализ и улучшение deployment workflow

**Приоритет:** `medium`

**Цель этапа**

Проанализировать текущий процесс развертывания (setup.sh, docker compose) и подготовить улучшения.

**Входы и зависимости**

- Скрипты setup.sh, docker/backup.sh, docker/update.sh
- docker-compose.yml

**Шаги выполнения**

1. [HUGOAI-P07-S01] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-7: Анализ и улучшение deployment workflow»: Проанализировать скрипт setup.sh на предмет обработки ошибок и краевых случаев.
2. [HUGOAI-P07-S02] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-7: Анализ и улучшение deployment workflow»: Проверить конфигурацию профилей Docker Compose (light, balanced, full).
3. [HUGOAI-P07-S03] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-7: Анализ и улучшение deployment workflow»: Определить узкие места в процессе обновления (update.sh).
4. [HUGOAI-P07-S04] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-7: Анализ и улучшение deployment workflow»: Спроектировать улучшения для CI/CD процесса (например, GitHub Actions).

**Контрольная точка**

[HUGOAI-P07-C01] AI Admin Panel — контроль результата «AI Admin Panel — HUGOAI-PNN-7: Анализ и улучшение deployment workflow»: План улучшения deployment workflow составлен

**Критерии приёмки**

- [HUGOAI-P07-A01] Для результата «AI Admin Panel — HUGOAI-PNN-7: Анализ и улучшение deployment workflow»: Документ с анализом текущего deployment workflow создан.
- [HUGOAI-P07-A02] Для результата «AI Admin Panel — HUGOAI-PNN-7: Анализ и улучшение deployment workflow»: Предложены конкретные улучшения для setup.sh и update.sh.
- [HUGOAI-P07-A03] Для результата «AI Admin Panel — HUGOAI-PNN-7: Анализ и улучшение deployment workflow»: Спроектирован базовый pipeline для CI/CD.

**Артефакты**

- deployment_analysis.md
- ci_cd_design.md

**Риски и откат**

Риск несовместимости предложенных улучшений с текущей инфраструктурой. Откат: корректировка плана улучшений.

#### [HUGOAI-P08] AI Admin Panel — HUGOAI-PNN-8: Внедрение улучшений в скрипты развертывания

**Приоритет:** `medium`

**Цель этапа**

Применить разработанные улучшения к скриптам setup.sh и update.sh.

**Входы и зависимости**

- План улучшения (из задачи 7)
- Скрипты setup.sh, update.sh

**Шаги выполнения**

1. [HUGOAI-P08-S01] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-8: Внедрение улучшений в скрипты развертывания»: Добавить улучшенную обработку ошибок в setup.sh.
2. [HUGOAI-P08-S02] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-8: Внедрение улучшений в скрипты развертывания»: Оптимизировать процесс сборки Docker-образов в update.sh.
3. [HUGOAI-P08-S03] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-8: Внедрение улучшений в скрипты развертывания»: Добавить автоматическую проверку зависимостей перед запуском скриптов.
4. [HUGOAI-P08-S04] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-8: Внедрение улучшений в скрипты развертывания»: Протестировать обновленные скрипты в чистой среде.

**Контрольная точка**

[HUGOAI-P08-C01] AI Admin Panel — контроль результата «AI Admin Panel — HUGOAI-PNN-8: Внедрение улучшений в скрипты развертывания»: Обновленные скрипты развертывания успешно протестированы

**Критерии приёмки**

- [HUGOAI-P08-A01] Для результата «AI Admin Panel — HUGOAI-PNN-8: Внедрение улучшений в скрипты развертывания»: setup.sh корректно обрабатывает ошибки и информирует пользователя.
- [HUGOAI-P08-A02] Для результата «AI Admin Panel — HUGOAI-PNN-8: Внедрение улучшений в скрипты развертывания»: update.sh выполняет обновление без простоев (zero-downtime, если возможно).
- [HUGOAI-P08-A03] Для результата «AI Admin Panel — HUGOAI-PNN-8: Внедрение улучшений в скрипты развертывания»: Тестирование в чистой среде прошло успешно.

**Артефакты**

- setup.sh
- docker/update.sh

**Риски и откат**

Риск поломки процесса установки для новых пользователей. Откат: возврат к предыдущим версиям скриптов.

#### [HUGOAI-P09] AI Admin Panel — HUGOAI-PNN-9: Настройка CI/CD pipeline

**Приоритет:** `medium`

**Цель этапа**

Настроить автоматическое тестирование и сборку при пуше в репозиторий.

**Входы и зависимости**

- CI/CD дизайн (из задачи 7)
- Репозиторий проекта (ai-admin-panel)

**Шаги выполнения**

1. [HUGOAI-P09-S01] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-9: Настройка CI/CD pipeline»: Создать конфигурационный файл для CI (например, .github/workflows/ci.yml или эквивалент для Forgejo).
2. [HUGOAI-P09-S02] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-9: Настройка CI/CD pipeline»: Настроить шаги для линтинга и проверки типов TypeScript.
3. [HUGOAI-P09-S03] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-9: Настройка CI/CD pipeline»: Настроить тестовую сборку Docker-образа в CI.
4. [HUGOAI-P09-S04] AI Admin Panel — этап «AI Admin Panel — HUGOAI-PNN-9: Настройка CI/CD pipeline»: Проверить работу pipeline на тестовом pull request.

**Контрольная точка**

[HUGOAI-P09-C01] AI Admin Panel — контроль результата «AI Admin Panel — HUGOAI-PNN-9: Настройка CI/CD pipeline»: CI pipeline успешно выполняется при пуше

**Критерии приёмки**

- [HUGOAI-P09-A01] Для результата «AI Admin Panel — HUGOAI-PNN-9: Настройка CI/CD pipeline»: Конфигурационный файл CI создан и добавлен в репозиторий.
- [HUGOAI-P09-A02] Для результата «AI Admin Panel — HUGOAI-PNN-9: Настройка CI/CD pipeline»: Pipeline включает шаги линтинга, проверки типов и сборки Docker-образа.
- [HUGOAI-P09-A03] Для результата «AI Admin Panel — HUGOAI-PNN-9: Настройка CI/CD pipeline»: Pipeline успешно проходит на тестовом pull request.

**Артефакты**

- .github/workflows/ci.yml

**Риски и откат**

Риск ложных срабатываний в CI. Откат: отключение проблемных шагов в конфигурации CI.

### Ключевые риски

| Риск | Влияние | Мера | Триггер отката |
|---|---|---|---|
| Недоступность Ollama сервера | Невозможность AI-генерации и редактирования | Проверка доступности перед вызовом, fallback на базовые функции | Таймаут соединения с Ollama |
| Ошибки синхронизации с Hugo | Рассинхронизация контента между ботом и блогом | Двусторонняя fast-forward-only синхронизация | Конфликт версий при синхронизации |

### Эксплуатационные контроли

| Контроль | Доказательство | Периодичность/триггер |
|---|---|---|
| Проверка Telegram user ID (Whitelist) | TELEGRAM_ALLOWED_USERS в конфигурации | При каждом входящем сообщении |
| Ротация логов | max 20MB для приложения | По достижении размера |

### Стратегия проверки

- Проверка функциональности через тестовые команды в Telegram, мониторинг логов Docker-контейнеров и валидация синхронизации с тестовым экземпляром Hugo.

### Примечания к документации

- Использовать только факты из предоставленного контекста. Неизвестные детали реализовывать через проверки и логирование.

### Связи

- Kaneo: https://kaneo.nodkeys.com/project/bu3lyzrzpp20l5exf9l8zd43
- Forgejo: https://git.nodkeys.com/ilea/ai-admin-panel
- GitHub: https://github.com/sileade/ai-admin-panel
- Git policy: двусторонняя fast-forward-only; force-push запрещён; divergence требует ручного merge.

<!-- KANEO-PROCESS-DOCS:END -->
