#!/bin/sh
set -e

# ============================================================
# AI Admin Panel — Container Entrypoint
# Handles: DB wait, auto-migration, Ollama connectivity check
# ============================================================

echo "╔══════════════════════════════════════════════╗"
echo "║   AI Admin Panel — Starting...               ║"
echo "╚══════════════════════════════════════════════╝"

# --- Colors for output ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# --- Wait for MySQL ---
wait_for_db() {
  echo "${YELLOW}[1/4] Waiting for database...${NC}"
  
  if [ -z "$DATABASE_URL" ]; then
    echo "${RED}ERROR: DATABASE_URL is not set${NC}"
    exit 1
  fi

  # Extract host and port from DATABASE_URL
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
  DB_PORT=${DB_PORT:-3306}

  MAX_RETRIES=30
  RETRY=0

  while [ $RETRY -lt $MAX_RETRIES ]; do
    if wget --spider --quiet "http://${DB_HOST}:${DB_PORT}" 2>/dev/null || \
       nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
      echo "${GREEN}  ✓ Database is reachable at ${DB_HOST}:${DB_PORT}${NC}"
      return 0
    fi
    RETRY=$((RETRY + 1))
    echo "  Waiting for database... (${RETRY}/${MAX_RETRIES})"
    sleep 2
  done

  echo "${YELLOW}  ⚠ Could not verify database connection, proceeding anyway...${NC}"
  return 0
}

# --- Run Drizzle migrations ---
run_migrations() {
  echo "${YELLOW}[2/4] Running database migrations...${NC}"
  
  if [ -d "/app/drizzle" ]; then
    # Drizzle migrations are applied via the app startup
    echo "${GREEN}  ✓ Migration files found, will be applied on startup${NC}"
  else
    echo "${YELLOW}  ⚠ No migration directory found, skipping${NC}"
  fi
}

# --- Check Ollama connectivity ---
check_ollama() {
  echo "${YELLOW}[3/4] Checking Ollama connectivity...${NC}"
  
  if [ -n "$OLLAMA_HOST" ]; then
    if wget --spider --quiet --timeout=5 "${OLLAMA_HOST}/api/tags" 2>/dev/null; then
      echo "${GREEN}  ✓ Ollama is reachable at ${OLLAMA_HOST}${NC}"
      
      # List available models
      MODELS=$(wget -qO- --timeout=5 "${OLLAMA_HOST}/api/tags" 2>/dev/null | \
               sed -n 's/.*"name":"\([^"]*\)".*/\1/p' | head -5)
      if [ -n "$MODELS" ]; then
        echo "${GREEN}  ✓ Available models: ${MODELS}${NC}"
      fi
    else
      echo "${YELLOW}  ⚠ Ollama not reachable at ${OLLAMA_HOST}${NC}"
      echo "${YELLOW}    AI will use built-in fallback model${NC}"
    fi
  else
    echo "${YELLOW}  ⚠ OLLAMA_HOST not set, using built-in AI${NC}"
  fi
}

# --- Print config summary ---
print_summary() {
  echo "${YELLOW}[4/4] Configuration summary:${NC}"
  echo "  App Port:     3000"
  echo "  Node Env:     ${NODE_ENV:-production}"
  echo "  Database:     ${DB_HOST:-not set}:${DB_PORT:-3306}"
  echo "  Ollama:       ${OLLAMA_HOST:-not configured}"
  echo "  Hugo API:     ${HUGO_API_URL:-not configured}"
  echo ""
  echo "${GREEN}╔══════════════════════════════════════════════╗${NC}"
  echo "${GREEN}║   AI Admin Panel — Ready!                    ║${NC}"
  echo "${GREEN}╚══════════════════════════════════════════════╝${NC}"
}

# --- Execute startup sequence ---
wait_for_db
run_migrations
check_ollama
print_summary

# --- Start the application ---
exec "$@"
