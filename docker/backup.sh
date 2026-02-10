#!/bin/bash
# ============================================================
# AI Admin Panel — Database Backup Script
# ============================================================
# Usage:
#   ./docker/backup.sh              # Backup to ./backups/
#   ./docker/backup.sh /path/to/dir # Backup to custom directory
# ============================================================

set -e

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/ai_admin_panel_${TIMESTAMP}.sql.gz"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}[BACKUP] Starting database backup...${NC}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Load env vars
if [ -f ".env" ]; then
  source .env 2>/dev/null || true
fi

DB_NAME=${MYSQL_DATABASE:-ai_admin_panel}
DB_USER=${MYSQL_USER:-ai_admin}
DB_PASS=${MYSQL_PASSWORD:-ai_admin_pass_2024}

# Check if MySQL container is running
if ! docker ps --format '{{.Names}}' | grep -q "ai-admin-db"; then
  echo -e "${RED}[ERROR] MySQL container (ai-admin-db) is not running${NC}"
  echo "  Start it with: docker compose --profile balanced up -d mysql"
  exit 1
fi

# Perform backup
echo -e "${YELLOW}[BACKUP] Dumping database '${DB_NAME}'...${NC}"

docker exec ai-admin-db mysqldump \
  -u "$DB_USER" \
  -p"$DB_PASS" \
  --single-transaction \
  --routines \
  --triggers \
  --add-drop-table \
  "$DB_NAME" 2>/dev/null | gzip > "$BACKUP_FILE"

# Verify backup
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo -e "${GREEN}[SUCCESS] Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})${NC}"

# Cleanup old backups (keep last 10)
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/ai_admin_panel_*.sql.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 10 ]; then
  REMOVE_COUNT=$((BACKUP_COUNT - 10))
  echo -e "${YELLOW}[CLEANUP] Removing ${REMOVE_COUNT} old backup(s)...${NC}"
  ls -1t "${BACKUP_DIR}"/ai_admin_panel_*.sql.gz | tail -n "$REMOVE_COUNT" | xargs rm -f
fi

echo -e "${GREEN}[DONE] Backup complete. Total backups: $(ls -1 "${BACKUP_DIR}"/ai_admin_panel_*.sql.gz 2>/dev/null | wc -l)${NC}"
