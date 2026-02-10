#!/bin/bash
# ============================================================
# AI Admin Panel — Update Script
# ============================================================
# Usage:
#   ./docker/update.sh
# ============================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}[UPDATE] Starting AI Admin Panel update...${NC}"

# Load profile from .env
if [ -f ".env" ]; then
  PROFILE=$(grep COMPOSE_PROFILES .env 2>/dev/null | cut -d= -f2)
fi
PROFILE=${PROFILE:-balanced}

# Step 1: Backup database
echo -e "${YELLOW}[1/5] Creating database backup...${NC}"
if [ -f "docker/backup.sh" ]; then
  bash docker/backup.sh || echo -e "${YELLOW}  ⚠ Backup skipped (DB may not be running)${NC}"
fi

# Step 2: Pull latest code
echo -e "${YELLOW}[2/5] Pulling latest code...${NC}"
if [ -d ".git" ]; then
  git pull origin main
  echo -e "${GREEN}  ✓ Code updated${NC}"
else
  echo -e "${YELLOW}  ⚠ Not a git repository, skipping pull${NC}"
fi

# Step 3: Rebuild
echo -e "${YELLOW}[3/5] Rebuilding application...${NC}"
docker compose --profile "$PROFILE" build --no-cache

# Step 4: Restart
echo -e "${YELLOW}[4/5] Restarting services...${NC}"
docker compose --profile "$PROFILE" up -d

# Step 5: Verify
echo -e "${YELLOW}[5/5] Verifying...${NC}"
sleep 10

APP_STATUS=$(docker inspect --format='{{.State.Health.Status}}' ai-admin-app 2>/dev/null || echo "unknown")

if [ "$APP_STATUS" = "healthy" ]; then
  echo -e "${GREEN}[SUCCESS] Update complete! Application is healthy.${NC}"
else
  echo -e "${YELLOW}[INFO] Application status: ${APP_STATUS}. Check logs: docker compose logs app${NC}"
fi

# Cleanup old images
echo -e "${YELLOW}[CLEANUP] Removing unused Docker images...${NC}"
docker image prune -f 2>/dev/null || true

echo -e "${GREEN}[DONE] Update complete${NC}"
