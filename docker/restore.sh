#!/bin/bash
# ============================================================
# AI Blog Bot — Database Restore Script
# ============================================================
# Usage:
#   ./docker/restore.sh backups/ai_blog_bot_20240101_120000.sql.gz
# ============================================================

set -e

BACKUP_FILE="$1"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ -z "$BACKUP_FILE" ]; then
  echo -e "${RED}[ERROR] Usage: ./docker/restore.sh <backup_file.sql.gz>${NC}"
  echo ""
  echo "Available backups:"
  ls -lh backups/ai_blog_bot_*.sql.gz 2>/dev/null || echo "  No backups found"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo -e "${RED}[ERROR] Backup file not found: ${BACKUP_FILE}${NC}"
  exit 1
fi

# Load env vars
if [ -f ".env" ]; then
  source .env 2>/dev/null || true
fi

DB_NAME=${MYSQL_DATABASE:-ai_blog_bot}
DB_USER=${MYSQL_USER:-ai_blog_bot}
DB_PASS=${MYSQL_PASSWORD:-ai_blog_bot_pass_2024}

echo -e "${YELLOW}[RESTORE] WARNING: This will overwrite the current database!${NC}"
read -p "Continue? [y/N]: " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo -e "${YELLOW}[RESTORE] Restoring from: ${BACKUP_FILE}${NC}"

gunzip -c "$BACKUP_FILE" | docker exec -i ai-blog-bot-db mysql \
  -u "$DB_USER" \
  -p"$DB_PASS" \
  "$DB_NAME" 2>/dev/null

echo -e "${GREEN}[SUCCESS] Database restored from ${BACKUP_FILE}${NC}"
echo -e "${YELLOW}[INFO] Restarting application...${NC}"

docker compose restart app

echo -e "${GREEN}[DONE] Restore complete${NC}"
