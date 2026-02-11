# AI Admin Panel - TODO

## Database & Schema
- [x] Create articles table for local cache/metadata
- [x] Create ai_generations table for tracking AI operations
- [x] Create settings table for LLM/Hugo API configuration
- [x] Push database migrations

## Backend - Hugo API Integration
- [x] Hugo API proxy: list posts
- [x] Hugo API proxy: create post
- [x] Hugo API proxy: edit post
- [x] Hugo API proxy: delete post
- [x] Hugo API settings management (base URL, API key)

## Backend - AI/LLM Integration
- [x] LLM settings management (endpoint, model, API key)
- [x] AI article generator (full article from topic + context)
- [x] AI article editor (improve/rewrite/expand existing content)
- [x] AI SEO optimizer (meta descriptions, tags suggestions)
- [x] AI assistant chat for content help

## Backend - Image Features
- [x] Image search via web API
- [x] AI image generation via built-in image generation
- [x] Image upload to S3 storage

## Frontend - Dashboard
- [x] Dashboard with article statistics
- [x] Recent articles list
- [x] Quick actions (new article, AI generate)

## Frontend - Article Management
- [x] Article list with filtering/sorting/search
- [x] Markdown editor with live preview
- [x] Article creation form with metadata
- [x] Article editing with Hugo API sync
- [x] Article metadata management (tags, categories, SEO)

## Frontend - AI Features
- [x] AI article generator page
- [x] AI article editor page
- [x] AI assistant sidebar/chat
- [x] AI image generation interface
- [x] Image search and gallery

## Frontend - Settings
- [x] Hugo API configuration page
- [x] LLM endpoint configuration page
- [x] Model selection interface

## Infrastructure
- [x] Dark theme design with professional CMS styling
- [x] DashboardLayout with sidebar navigation
- [x] Vitest tests for backend procedures
- [x] GitHub repository creation with README

## Docker Deployment
- [x] Multi-stage Dockerfile (build + production)
- [x] docker-compose.yml with MySQL + app + Nginx
- [x] .env.example with all required variables
- [x] Auto-setup script (setup.sh) — one-command deployment
- [x] Nginx reverse proxy config with SSL support
- [x] Health checks for all services
- [x] Wait-for-db script for startup ordering
- [x] .dockerignore for optimized builds
- [x] Ollama remote connection configuration
- [x] Docker profiles (light/balanced/full)
- [x] Auto-migration on startup
- [x] Backup script for database
- [x] Update README with Docker deployment guide
- [x] Push updated code to GitHub

## Chatbot Redesign (v2)
- [x] Remove all admin panel pages (Articles, Editor, AiGenerate, AiEdit, Images, Assistant, Settings)
- [x] Create unified chat-bot backend router with tool-calling architecture
- [x] Implement chat tools: list_articles, create_article, edit_article, delete_article
- [x] Implement chat tools: generate_article, edit_article_ai, optimize_seo
- [x] Implement chat tools: search_images, generate_image
- [x] Implement chat tools: get_settings, save_settings, sync_hugo
- [x] Implement chat message history in database
- [x] Create single-page chat UI with message bubbles, tool results, image previews
- [x] Add quick-action suggestions and command hints in chat
- [x] Add markdown rendering for article previews in chat
- [x] Add image gallery rendering in chat responses
- [x] Update DashboardLayout or remove in favor of chat-only layout
- [x] Update Docker Compose for chatbot version
- [x] Update README with chatbot documentation
- [x] Push to GitHub

## Bug Fixes
- [x] Fix permission error (10002) — changed adminProcedure to protectedProcedure
- [x] Fix permission error (10002) for conversation list query — promoted user to admin + relaxed access

## Code Review & Testing (v3)
- [x] Server code review: chat router, db helpers, schema
- [x] Security review: input validation, SQL injection, XSS
- [x] Client code review: Chat.tsx, UX, accessibility
- [x] Docker review: Dockerfile, compose, scripts
- [x] Fix all found issues (24/31 fixed, 7 low-priority remaining)
- [x] Expanded vitest test coverage (42 tests, all passing)
- [x] Integration tests for chat flow (lifecycle + multi-user isolation)
- [x] Deliver code review report (CODE_REVIEW_REPORT.md)

## Telegram Bot Redesign (v4)
- [x] Remove React frontend entirely (replaced with minimal landing page)
- [x] Install grammy for Telegram integration
- [x] Create Telegram bot with commands: /start, /help, /articles, /new, /settings, /stats, /sync
- [x] Integrate LLM tool-calling engine (reused from chat router)
- [x] Hugo API tools: list, create, edit, delete articles
- [x] AI tools: generate article, edit article, optimize SEO
- [x] Image tools: search images, generate images
- [x] Settings management via bot commands
- [x] Conversation context/history per Telegram user
- [x] Inline keyboard buttons for article actions
- [x] Markdown formatting for article previews in Telegram
- [x] Image sending directly in Telegram chat
- [x] TELEGRAM_BOT_TOKEN env var configured
- [x] Update Docker Compose with Telegram env vars and --telegram flag in setup.sh
- [x] Update README for Telegram bot version
- [x] Write vitest tests for bot logic (18 tests passing)
- [x] Push to GitHub

## Code Review & Testing v2 (Telegram Bot)
- [ ] Server code review: telegram-bot.ts (tool-calling, commands, security)
- [ ] Server code review: routers.ts, db.ts, schema
- [ ] Security review: input validation, injection, access control
- [ ] Client code review: landing page Home.tsx
- [ ] Docker review: Dockerfile, compose, scripts
- [ ] Fix all critical and high issues found
- [ ] Expand vitest test coverage for Telegram bot
- [ ] Integration tests for tool execution pipeline
- [ ] Edge case tests (empty inputs, long messages, concurrent users)
- [ ] Write code review report
- [ ] Push fixes to GitHub
