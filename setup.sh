#!/bin/bash
# ============================================================
# AI Admin Panel — One-Command Auto-Deployment Script
# ============================================================
# Usage:
#   chmod +x setup.sh
#   ./setup.sh                    # Interactive setup
#   ./setup.sh --profile balanced # Non-interactive with profile
#   ./setup.sh --auto             # Full auto with defaults
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Banner
print_banner() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║                                                          ║${NC}"
  echo -e "${CYAN}║   ${BOLD}AI Admin Panel${NC}${CYAN} — Automated Deployment                 ║${NC}"
  echo -e "${CYAN}║   CMS with AI Assistant for Hugo Blog                    ║${NC}"
  echo -e "${CYAN}║                                                          ║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
  echo ""
}

# Logging
log_info()    { echo -e "${BLUE}[INFO]${NC}    $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}    $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC}   $1"; }
log_step()    { echo -e "\n${BOLD}${CYAN}━━━ $1 ━━━${NC}\n"; }

# Parse arguments
PROFILE=""
AUTO_MODE=false
OLLAMA_IP=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --profile)    PROFILE="$2"; shift 2 ;;
    --auto)       AUTO_MODE=true; shift ;;
    --ollama)     OLLAMA_IP="$2"; shift 2 ;;
    --help|-h)
      echo "Usage: ./setup.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --profile <name>   Set profile: light, balanced, full"
      echo "  --auto             Non-interactive mode with defaults"
      echo "  --ollama <ip:port> Ollama server address (e.g., 192.168.1.100:11434)"
      echo "  --help             Show this help"
      exit 0
      ;;
    *) log_error "Unknown option: $1"; exit 1 ;;
  esac
done

# ============================================================
# Step 1: Check Prerequisites
# ============================================================
check_prerequisites() {
  log_step "Step 1/6: Checking Prerequisites"

  local missing=()

  # Docker
  if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)
    log_success "Docker ${DOCKER_VERSION} found"
  else
    missing+=("docker")
    log_error "Docker not found"
  fi

  # Docker Compose
  if docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version | grep -oP '\d+\.\d+\.\d+' | head -1)
    log_success "Docker Compose ${COMPOSE_VERSION} found"
  elif command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version | grep -oP '\d+\.\d+\.\d+' | head -1)
    log_success "Docker Compose ${COMPOSE_VERSION} found (legacy)"
    log_warn "Consider upgrading to Docker Compose V2"
  else
    missing+=("docker-compose")
    log_error "Docker Compose not found"
  fi

  # Git
  if command -v git &> /dev/null; then
    log_success "Git found"
  else
    missing+=("git")
    log_warn "Git not found (optional, for updates)"
  fi

  # Check if Docker daemon is running
  if docker info &> /dev/null; then
    log_success "Docker daemon is running"
  else
    log_error "Docker daemon is not running. Start it with: sudo systemctl start docker"
    missing+=("docker-daemon")
  fi

  if [ ${#missing[@]} -gt 0 ] && [[ " ${missing[*]} " =~ " docker " || " ${missing[*]} " =~ " docker-daemon " ]]; then
    log_error "Missing critical prerequisites. Install Docker first:"
    echo ""
    echo "  curl -fsSL https://get.docker.com | sh"
    echo "  sudo usermod -aG docker \$USER"
    echo "  newgrp docker"
    echo ""
    exit 1
  fi
}

# ============================================================
# Step 2: Select Profile
# ============================================================
select_profile() {
  log_step "Step 2/6: Selecting Deployment Profile"

  if [ -n "$PROFILE" ]; then
    log_info "Profile set via argument: ${PROFILE}"
    return
  fi

  if [ "$AUTO_MODE" = true ]; then
    PROFILE="balanced"
    log_info "Auto mode: using 'balanced' profile"
    return
  fi

  echo -e "${BOLD}Available profiles:${NC}"
  echo ""
  echo -e "  ${GREEN}1) light${NC}     — App only (bring your own MySQL)"
  echo -e "                Requires: External MySQL database"
  echo -e "                RAM: ~256 MB"
  echo ""
  echo -e "  ${CYAN}2) balanced${NC}  — App + MySQL ${YELLOW}(recommended)${NC}"
  echo -e "                Includes: MySQL 8 database"
  echo -e "                RAM: ~512 MB"
  echo ""
  echo -e "  ${BLUE}3) full${NC}      — App + MySQL + Nginx reverse proxy"
  echo -e "                Includes: MySQL 8 + Nginx with SSL support"
  echo -e "                RAM: ~768 MB"
  echo ""

  while true; do
    read -p "Select profile [1/2/3] (default: 2): " choice
    case ${choice:-2} in
      1) PROFILE="light"; break ;;
      2) PROFILE="balanced"; break ;;
      3) PROFILE="full"; break ;;
      *) log_warn "Invalid choice, try again" ;;
    esac
  done

  log_success "Selected profile: ${PROFILE}"
}

# ============================================================
# Step 3: Configure Environment
# ============================================================
configure_environment() {
  log_step "Step 3/6: Configuring Environment"

  # Generate secure random strings
  generate_secret() {
    openssl rand -hex 32 2>/dev/null || \
    head -c 64 /dev/urandom | base64 | tr -d '\n/+=' | head -c 64
  }

  # Start with template
  if [ -f ".env" ]; then
    log_warn ".env file already exists"
    if [ "$AUTO_MODE" = false ]; then
      read -p "Overwrite? [y/N]: " overwrite
      if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
        log_info "Keeping existing .env"
        return
      fi
    else
      log_info "Auto mode: backing up existing .env to .env.backup"
      cp .env .env.backup
    fi
  fi

  cp docker/env.example .env

  # Set profile
  sed -i "s|COMPOSE_PROFILES=.*|COMPOSE_PROFILES=${PROFILE}|" .env

  # Generate secrets
  JWT_SECRET=$(generate_secret)
  MYSQL_ROOT_PASS=$(generate_secret | head -c 24)
  MYSQL_PASS=$(generate_secret | head -c 24)

  sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" .env
  sed -i "s|MYSQL_ROOT_PASSWORD=.*|MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASS}|" .env
  sed -i "s|MYSQL_PASSWORD=.*|MYSQL_PASSWORD=${MYSQL_PASS}|" .env

  log_success "Generated secure JWT secret"
  log_success "Generated secure database passwords"

  # Configure Ollama
  if [ -n "$OLLAMA_IP" ]; then
    if [[ "$OLLAMA_IP" != http* ]]; then
      OLLAMA_IP="http://${OLLAMA_IP}"
    fi
    if [[ "$OLLAMA_IP" != *:* ]] || [[ "$OLLAMA_IP" =~ ^http://[^:]+$ ]]; then
      OLLAMA_IP="${OLLAMA_IP}:11434"
    fi
    sed -i "s|OLLAMA_HOST=.*|OLLAMA_HOST=${OLLAMA_IP}|" .env
    log_success "Ollama configured: ${OLLAMA_IP}"
  elif [ "$AUTO_MODE" = false ]; then
    echo ""
    echo -e "${BOLD}Ollama Configuration:${NC}"
    echo "  Enter the IP address of your Ollama server."
    echo "  Leave empty to use built-in AI only."
    echo ""
    read -p "Ollama server IP (e.g., 192.168.1.100): " ollama_input
    if [ -n "$ollama_input" ]; then
      if [[ "$ollama_input" != http* ]]; then
        ollama_input="http://${ollama_input}"
      fi
      if [[ "$ollama_input" != *:114* ]]; then
        ollama_input="${ollama_input}:11434"
      fi
      sed -i "s|OLLAMA_HOST=.*|OLLAMA_HOST=${ollama_input}|" .env
      log_success "Ollama configured: ${ollama_input}"

      read -p "Ollama model (default: llama3.2): " ollama_model
      if [ -n "$ollama_model" ]; then
        sed -i "s|OLLAMA_MODEL=.*|OLLAMA_MODEL=${ollama_model}|" .env
      fi
    else
      sed -i "s|OLLAMA_HOST=.*|OLLAMA_HOST=|" .env
      log_info "Ollama not configured, will use built-in AI"
    fi
  fi

  # Configure Hugo API
  if [ "$AUTO_MODE" = false ]; then
    echo ""
    echo -e "${BOLD}Hugo Blog API Configuration:${NC}"
    read -p "Hugo admin URL (default: https://admin.nodkeys.com): " hugo_url
    if [ -n "$hugo_url" ]; then
      sed -i "s|HUGO_API_URL=.*|HUGO_API_URL=${hugo_url}|" .env
    fi
    read -p "Hugo API key: " hugo_key
    if [ -n "$hugo_key" ]; then
      sed -i "s|HUGO_API_KEY=.*|HUGO_API_KEY=${hugo_key}|" .env
    fi
  fi

  # Set DATABASE_URL for light profile
  if [ "$PROFILE" = "light" ] && [ "$AUTO_MODE" = false ]; then
    echo ""
    echo -e "${BOLD}External Database Configuration:${NC}"
    read -p "DATABASE_URL (mysql://user:pass@host:3306/db): " db_url
    if [ -n "$db_url" ]; then
      echo "DATABASE_URL=${db_url}" >> .env
    fi
  else
    # For balanced/full, construct from MySQL vars
    echo "DATABASE_URL=mysql://ai_admin:${MYSQL_PASS}@mysql:3306/ai_admin_panel" >> .env
  fi

  log_success "Environment configured successfully"
}

# ============================================================
# Step 4: Build and Deploy
# ============================================================
build_and_deploy() {
  log_step "Step 4/6: Building and Deploying"

  # Create SSL directory for full profile
  if [ "$PROFILE" = "full" ]; then
    mkdir -p docker/nginx/ssl
    log_info "SSL directory created at docker/nginx/ssl/"
    log_info "Place your SSL certificates there (fullchain.pem, privkey.pem)"
  fi

  # Pull base images
  log_info "Pulling base images..."
  docker compose --profile "$PROFILE" pull 2>/dev/null || true

  # Build application
  log_info "Building AI Admin Panel..."
  docker compose --profile "$PROFILE" build --no-cache

  log_success "Build completed"

  # Start services
  log_info "Starting services..."
  docker compose --profile "$PROFILE" up -d

  log_success "Services started"
}

# ============================================================
# Step 5: Verify Deployment
# ============================================================
verify_deployment() {
  log_step "Step 5/6: Verifying Deployment"

  # Wait for services to be healthy
  log_info "Waiting for services to become healthy..."

  MAX_WAIT=120
  WAITED=0

  while [ $WAITED -lt $MAX_WAIT ]; do
    APP_STATUS=$(docker inspect --format='{{.State.Health.Status}}' ai-admin-app 2>/dev/null || echo "starting")

    if [ "$APP_STATUS" = "healthy" ]; then
      log_success "Application is healthy!"
      break
    fi

    WAITED=$((WAITED + 5))
    echo -ne "\r  Waiting... ${WAITED}s / ${MAX_WAIT}s (status: ${APP_STATUS})"
    sleep 5
  done

  echo ""

  if [ $WAITED -ge $MAX_WAIT ]; then
    log_warn "Application did not become healthy within ${MAX_WAIT}s"
    log_info "Check logs: docker compose logs app"
  fi

  # Check all services
  echo ""
  log_info "Service status:"
  docker compose --profile "$PROFILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

  # Test connectivity
  echo ""
  APP_PORT=$(grep APP_PORT .env 2>/dev/null | cut -d= -f2)
  APP_PORT=${APP_PORT:-3000}

  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${APP_PORT}/" | grep -q "200\|302"; then
    log_success "Application is accessible at http://localhost:${APP_PORT}"
  else
    log_warn "Application may still be starting. Try: curl http://localhost:${APP_PORT}"
  fi

  # Test Ollama connectivity
  OLLAMA_HOST_VAL=$(grep OLLAMA_HOST .env 2>/dev/null | cut -d= -f2)
  if [ -n "$OLLAMA_HOST_VAL" ]; then
    if curl -s --connect-timeout 5 "${OLLAMA_HOST_VAL}/api/tags" > /dev/null 2>&1; then
      log_success "Ollama is reachable at ${OLLAMA_HOST_VAL}"
    else
      log_warn "Ollama is not reachable at ${OLLAMA_HOST_VAL}"
      log_info "Make sure Ollama is running and accessible from this machine"
      log_info "On the Ollama server, set: OLLAMA_HOST=0.0.0.0:11434"
    fi
  fi
}

# ============================================================
# Step 6: Print Summary
# ============================================================
print_summary() {
  log_step "Step 6/6: Deployment Summary"

  APP_PORT=$(grep APP_PORT .env 2>/dev/null | cut -d= -f2)
  APP_PORT=${APP_PORT:-3000}
  SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")

  echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                                                          ║${NC}"
  echo -e "${GREEN}║   ${BOLD}Deployment Complete!${NC}${GREEN}                                    ║${NC}"
  echo -e "${GREEN}║                                                          ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${BOLD}Access:${NC}"
  echo -e "    Local:    http://localhost:${APP_PORT}"
  echo -e "    Network:  http://${SERVER_IP}:${APP_PORT}"
  echo ""
  echo -e "  ${BOLD}Profile:${NC}      ${PROFILE}"
  echo ""
  echo -e "  ${BOLD}Useful commands:${NC}"
  echo -e "    Logs:     docker compose logs -f app"
  echo -e "    Status:   docker compose ps"
  echo -e "    Stop:     docker compose down"
  echo -e "    Restart:  docker compose restart app"
  echo -e "    Update:   git pull && docker compose build && docker compose up -d"
  echo -e "    Backup:   ./docker/backup.sh"
  echo ""
  echo -e "  ${BOLD}First steps:${NC}"
  echo -e "    1. Open http://localhost:${APP_PORT} in your browser"
  echo -e "    2. Log in with Manus OAuth"
  echo -e "    3. Go to Settings → configure Hugo API and LLM"
  echo -e "    4. Click 'Sync' on Dashboard to load articles"
  echo ""

  if [ "$PROFILE" = "full" ]; then
    echo -e "  ${BOLD}SSL Setup:${NC}"
    echo -e "    1. Place certificates in docker/nginx/ssl/"
    echo -e "    2. Uncomment HTTPS block in docker/nginx/nginx.conf"
    echo -e "    3. docker compose restart nginx"
    echo ""
  fi
}

# ============================================================
# Main Execution
# ============================================================
print_banner
check_prerequisites
select_profile
configure_environment
build_and_deploy
verify_deployment
print_summary
