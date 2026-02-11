# Code Review v2 — Telegram Bot Version

## Summary
Total issues found: 22
- Critical: 3
- High: 5
- Medium: 8
- Low: 6

---

## CRITICAL

### CR2-01: Bot token exposed in photo URL construction (telegram-bot.ts:842)
```ts
const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
```
The bot token is embedded in the URL sent to processMessage, which gets stored in conversation context (in-memory). If context is ever logged or persisted, the token leaks.
**Fix:** Download the file to a buffer and upload to S3 instead of passing the token-bearing URL.

### CR2-02: No rate limiting on Telegram messages (telegram-bot.ts)
Any allowed user can spam the bot with unlimited messages, each triggering LLM calls. This can exhaust API quotas or cause high costs.
**Fix:** Add per-user rate limiting (e.g., 10 messages/minute).

### CR2-03: Unbounded in-memory context growth (telegram-bot.ts:519-531)
`userContexts` Map grows indefinitely — one entry per unique Telegram user, never cleaned up. Long-running bots will leak memory.
**Fix:** Add TTL-based cleanup (e.g., clear contexts older than 1 hour) and limit max users.

---

## HIGH

### CR2-04: /dev/tcp not available in Alpine (entrypoint.sh:39)
```sh
if (echo > /dev/tcp/${DB_HOST}/${DB_PORT}) 2>/dev/null; then
```
Alpine uses `ash`, not `bash`. `/dev/tcp` is a bash-ism and won't work. The wget fallback on line 46 also won't work for MySQL port (not HTTP).
**Fix:** Use `nc` (netcat) for TCP port checking, which is available in Alpine.

### CR2-05: Missing access control on /help and /new commands (telegram-bot.ts:675,724)
`/help` and `/new` commands don't check `isUserAllowed()`. Any user can trigger them.
**Fix:** Add `isUserAllowed()` check to all commands.

### CR2-06: Error messages may leak internal details (telegram-bot.ts:829)
```ts
await ctx.reply(`❌ Произошла ошибка: ${error.message}`);
```
Internal error messages (stack traces, DB connection strings) could be sent to users.
**Fix:** Sanitize error messages before sending to user.

### CR2-07: Dockerfile label says "AI Admin Panel" not "AI Blog Bot" (Dockerfile:44)
Labels are outdated from previous version.
**Fix:** Update labels.

### CR2-08: Missing `drizzle-kit` in production image (Dockerfile)
The entrypoint mentions migrations but `drizzle-kit` is a devDependency not installed in production. The `run_migrations` function in entrypoint.sh is a no-op.
**Fix:** Either include drizzle-kit in production or run migrations during build stage and copy the SQL output.

---

## MEDIUM

### CR2-09: Conversation DB helpers imported but unused in Telegram bot
`addChatMessage`, `getConversationMessages`, `createConversation`, `getConversations`, `getConversation`, `updateConversationTitle`, `deleteConversation` are imported but never called. All context is in-memory only.
**Fix:** Either use DB for persistence or remove unused imports.

### CR2-10: chatConversations/chatMessages tables unused
The schema defines `chat_conversations` and `chat_messages` tables, but the Telegram bot uses in-memory context only. Dead schema.
**Fix:** Either persist Telegram conversations to DB or remove unused tables.

### CR2-11: No graceful shutdown for bot (telegram-bot.ts)
When the process exits, the bot doesn't call `bot.stop()`. This can cause issues with Telegram polling.
**Fix:** Add process signal handlers to stop the bot gracefully.

### CR2-12: `escapeMarkdownV2` function defined but not used (telegram-bot.ts:46)
The function is defined but never called. Messages are sent without MarkdownV2 parsing (except /start and /help).
**Fix:** Either use it consistently or remove it.

### CR2-13: Ollama port check regex is fragile (setup.sh:262)
```sh
if [[ "$ollama_input" != *:114* ]]; then
```
This matches any string containing `:114` anywhere, not just port 11434.
**Fix:** Use proper port check: `if [[ "$ollama_input" != *:[0-9]* ]]; then`

### CR2-14: `window.__TG_BOT_USERNAME__` never set (Home.tsx:23)
```ts
const botUsername = (window as any).__TG_BOT_USERNAME__ || "your_bot";
```
This global is never injected by the server, so it always falls back to "your_bot".
**Fix:** Either inject it from server or use an env var.

### CR2-15: Landing page button links to `t.me/your_bot` (Home.tsx)
Since `__TG_BOT_USERNAME__` is never set, the "Open in Telegram" button always links to a non-existent bot.
**Fix:** Make bot username configurable via env var.

### CR2-16: Docker Compose `depends_on` with `required: false` (docker-compose.yml:104-106)
When using `light` profile (no MySQL), the app still tries to depend on mysql service. The `required: false` syntax may not be supported in older Docker Compose versions.
**Fix:** Document minimum Docker Compose version requirement.

---

## LOW

### CR2-17: Inconsistent naming — "AI Admin Panel" vs "AI Blog Bot" across files
Dockerfile says "AI Admin Panel", docker-compose says "AI Blog Bot". Should be consistent.

### CR2-18: `patches/` directory copied but may not exist (Dockerfile:18)
If no patches directory exists, the COPY will fail.

### CR2-19: No input validation on Telegram callback queries
Callback data like "cmd_stats" is trusted without validation.

### CR2-20: Missing `--frozen-lockfile` fallback warning (Dockerfile:21)
The `|| pnpm install` fallback silently ignores lockfile mismatches.

### CR2-21: App.tsx still imports unused DashboardLayout components
Old imports may still be referenced.

### CR2-22: Test functions duplicate production code (routers.test.ts)
`sanitizeToolArgs`, `escapeLikePattern`, `splitMessage`, `isUserAllowed` are re-implemented in tests instead of importing from source.
