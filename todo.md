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
- [ ] Push updated code to GitHub (in progress)
