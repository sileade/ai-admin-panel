# ============================================================
# AI Blog Bot — Multi-stage Production Dockerfile
# ============================================================
# Stage 1: Install dependencies
# Stage 2: Build frontend + backend
# Stage 3: Production runtime (minimal image)
# ============================================================

# --- Stage 1: Dependencies ---
FROM node:22-alpine AS deps
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/ 2>/dev/null || true

# Install all dependencies (including dev for build)
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# --- Stage 2: Build ---
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Copy dependencies from stage 1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# Copy source code
COPY . .

# Build frontend (Vite) + backend (esbuild)
RUN pnpm build

# --- Stage 3: Production Runtime ---
FROM node:22-alpine AS production
WORKDIR /app

LABEL maintainer="sileade"
LABEL description="AI Blog Bot — Telegram bot for Hugo blog management with AI"
LABEL version="2.0.0"

# Install system dependencies (netcat for TCP health checks)
RUN apk add --no-cache netcat-openbsd

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Install only production dependencies
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/ 2>/dev/null || true
RUN pnpm install --prod --frozen-lockfile 2>/dev/null || pnpm install --prod

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist

# Copy drizzle migrations for auto-migration on startup
COPY --from=builder /app/drizzle ./drizzle

# Copy startup scripts
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Create non-root user and switch
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Switch to non-root
USER appuser

EXPOSE 3000

ENV NODE_ENV=production

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "dist/index.js"]
