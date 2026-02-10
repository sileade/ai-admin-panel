# Code Review Findings

## Server-Side Issues

### CRITICAL

1. **Hardcoded API keys in source code** (chat.ts:337,357)
   - Unsplash Client-ID and Pixabay API key are hardcoded
   - Must move to settings/env vars

2. **No conversation ownership check** (chat.ts:504-510, 512-516, 519-523)
   - `getConversation`, `deleteConversation`, `renameConversation` don't verify the conversation belongs to `ctx.user.id`
   - Any authenticated user can read/delete/rename any conversation (IDOR vulnerability)

3. **SQL injection via LIKE pattern** (db.ts:91)
   - User search input passed directly to `like()` without escaping `%` and `_` wildcards
   - Allows wildcard injection

### HIGH

4. **Tool call message format incorrect for multi-turn** (chat.ts:577-607)
   - When tool_calls are present, the assistant message should include the tool_calls array, not just content
   - The tool response should include `tool_call_id` to match the OpenAI API spec
   - This may cause issues with some LLM providers

5. **No rate limiting on sendMessage** (chat.ts:527)
   - Expensive LLM calls with no throttling
   - Could lead to abuse or cost overruns

6. **No input sanitization on tool arguments** (chat.ts:586)
   - LLM-generated JSON args are parsed and passed directly to functions
   - Could lead to unexpected behavior

### MEDIUM

7. **getSettings exposes hugoKey existence** (chat.ts:664-677)
   - Returns `hugoKeySet: !!hugoKey` which is fine, but the tool `get_settings` (line 392) shows last 4 chars of API key

8. **No timeout on Hugo API fetch calls** (chat.ts:207-219, 255-261, 283-285, 297-299)
   - External HTTP calls have no AbortController/timeout
   - Could hang indefinitely

9. **Conversation history not filtered by user** (chat.ts:541)
   - `getConversationMessages` doesn't verify ownership before loading history

10. **No max message length validation** (chat.ts:529)
    - `z.string().min(1)` but no `.max()` — user could send extremely long messages

### LOW

11. **Unused imports** (db.ts:1)
    - `asc` imported but only used in one place, some imports may be unused

12. **Magic numbers** (chat.ts:547, 559)
    - `slice(-20)` and `MAX_ITERATIONS = 5` should be named constants

## Client-Side Issues

### HIGH

13. **No login gate / auth redirect** (Chat.tsx)
    - If user is not logged in, the page renders but all queries fail with permission errors
    - Should show login prompt or redirect to login page

14. **Settings dialog sends empty strings as undefined** (Chat.tsx:554-559)
    - `hugoUrl: hugoUrl || undefined` means empty string clears the setting
    - But `hugoKey: hugoKey || undefined` means if user doesn't change the key, it sends undefined and doesn't overwrite
    - Inconsistent behavior: clearing a field vs not changing it

### MEDIUM

15. **No error boundary around chat messages** (Chat.tsx:400-486)
    - If metadata JSON is malformed, extractImages could throw despite try/catch
    - Streamdown component could crash on malformed markdown

16. **Textarea auto-resize missing** (Chat.tsx:498-504)
    - Textarea has `max-h-32` but doesn't auto-grow as user types
    - Should auto-resize based on content

17. **No loading state for conversations list** (Chat.tsx:285)
    - When conversations are loading, no skeleton or spinner shown

18. **Mobile sidebar z-index stacking** (Chat.tsx:250)
    - Mobile sidebar uses z-50, overlay uses z-40
    - Could conflict with dialog z-indices

### LOW

19. **Unused imports** (Chat.tsx:23-24)
    - `PenTool`, `RefreshCw`, `ChevronLeft` imported but never used

20. **Date.now() as message ID** (Chat.tsx:183)
    - Could collide if two messages sent in same millisecond
    - Should use a counter or nanoid

## Docker & Infrastructure Issues

### CRITICAL

21. **Default passwords in docker-compose.yml** (docker-compose.yml:32-35)
    - `MYSQL_ROOT_PASSWORD:-ai_blog_bot_root_2024` and `MYSQL_PASSWORD:-ai_blog_bot_pass_2024` are weak defaults
    - If user forgets to set .env, these defaults are used in production
    - setup.sh generates strong passwords, but direct docker compose usage doesn't

22. **MySQL port exposed to host** (docker-compose.yml:37)
    - `ports: "${MYSQL_PORT:-3306}:3306"` exposes MySQL to all interfaces
    - Should bind to 127.0.0.1 only or remove port mapping (app connects via docker network)

### HIGH

23. **Entrypoint doesn't actually run migrations** (entrypoint.sh:52-61)
    - `run_migrations()` only checks if directory exists, doesn't run `drizzle-kit migrate`
    - App needs drizzle-kit in production deps or a separate migration step
    - Production image doesn't have drizzle-kit (it's a devDependency)

24. **nc command may not exist in alpine** (entrypoint.sh:38)
    - `nc -z` used for DB check but `netcat` not installed in node:22-alpine
    - wget spider to MySQL port also won't work (MySQL doesn't speak HTTP)

25. **DATABASE_URL appended instead of replaced** (setup.sh:266)
    - `echo "DATABASE_URL=..." >> .env` appends, so if run twice, there are duplicate entries
    - Should use sed replacement like other variables

### MEDIUM

26. **No resource limits** (docker-compose.yml)
    - No `deploy.resources.limits` set for any service
    - App or MySQL could consume all host memory

27. **Ollama port check regex is fragile** (setup.sh:227)
    - `if [[ "$ollama_input" != *:114* ]]` only checks for ":114" substring
    - Would fail for non-standard ports like :8080

28. **No log rotation** (docker-compose.yml)
    - No `logging` driver configured
    - Docker logs can grow unbounded

29. **Healthcheck uses wget spider** (Dockerfile:71, docker-compose.yml:97)
    - wget and curl may behave differently
    - Should be consistent across Dockerfile and compose

### LOW

30. **Backup script doesn't verify MySQL container name** (backup.sh)
    - Hardcoded container name could mismatch if user changes it

31. **No .env validation** (setup.sh)
    - Script doesn't validate that critical env vars are set before starting
