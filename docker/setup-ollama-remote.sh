#!/bin/bash
# ============================================================
# Ollama Remote Server Setup Script
# ============================================================
# Run this script on the VM where Ollama should be installed.
# It will:
#   1. Install Ollama
#   2. Configure it to accept remote connections
#   3. Pull the specified model
#   4. Set up as a systemd service
#
# Usage (on the Ollama VM):
#   curl -fsSL https://raw.githubusercontent.com/sileade/ai-admin-panel/main/docker/setup-ollama-remote.sh | bash
#   # or
#   ./setup-ollama-remote.sh [model_name]
# ============================================================

set -e

MODEL="${1:-llama3.2}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Ollama Remote Server Setup                 ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ---- Step 1: Install Ollama ----
echo -e "${YELLOW}[1/5] Installing Ollama...${NC}"

if command -v ollama &> /dev/null; then
  OLLAMA_VER=$(ollama --version 2>/dev/null || echo "unknown")
  echo -e "${GREEN}  ✓ Ollama already installed (${OLLAMA_VER})${NC}"
else
  curl -fsSL https://ollama.ai/install.sh | sh
  echo -e "${GREEN}  ✓ Ollama installed${NC}"
fi

# ---- Step 2: Configure for remote access ----
echo -e "${YELLOW}[2/5] Configuring remote access...${NC}"

# Create systemd override for OLLAMA_HOST
sudo mkdir -p /etc/systemd/system/ollama.service.d

cat << 'EOF' | sudo tee /etc/systemd/system/ollama.service.d/override.conf > /dev/null
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_ORIGINS=*"
EOF

echo -e "${GREEN}  ✓ Configured OLLAMA_HOST=0.0.0.0:11434${NC}"
echo -e "${GREEN}  ✓ Configured OLLAMA_ORIGINS=* (allow all origins)${NC}"

# ---- Step 3: Restart Ollama service ----
echo -e "${YELLOW}[3/5] Restarting Ollama service...${NC}"

sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl restart ollama

# Wait for Ollama to start
sleep 3

if systemctl is-active --quiet ollama; then
  echo -e "${GREEN}  ✓ Ollama service is running${NC}"
else
  echo -e "${RED}  ✗ Ollama service failed to start${NC}"
  echo "  Check logs: sudo journalctl -u ollama -f"
  exit 1
fi

# ---- Step 4: Pull model ----
echo -e "${YELLOW}[4/5] Pulling model '${MODEL}'...${NC}"
echo "  This may take several minutes depending on model size and connection speed."
echo ""

ollama pull "$MODEL"

echo ""
echo -e "${GREEN}  ✓ Model '${MODEL}' downloaded${NC}"

# ---- Step 5: Verify and print info ----
echo -e "${YELLOW}[5/5] Verification...${NC}"

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')

# Test API
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo -e "${GREEN}  ✓ Ollama API is responding${NC}"
else
  echo -e "${RED}  ✗ Ollama API is not responding${NC}"
fi

# List models
echo ""
echo -e "${BOLD}Available models:${NC}"
ollama list

# Print connection info
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Ollama Server Ready!                       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Connection info for AI Admin Panel:${NC}"
echo ""
echo -e "  OLLAMA_HOST = ${CYAN}http://${SERVER_IP}:11434${NC}"
echo -e "  OLLAMA_MODEL = ${CYAN}${MODEL}${NC}"
echo ""
echo -e "  ${BOLD}Use in setup.sh:${NC}"
echo -e "  ${CYAN}./setup.sh --ollama ${SERVER_IP}:11434${NC}"
echo ""
echo -e "  ${BOLD}Or set in .env:${NC}"
echo -e "  ${CYAN}OLLAMA_HOST=http://${SERVER_IP}:11434${NC}"
echo -e "  ${CYAN}OLLAMA_MODEL=${MODEL}${NC}"
echo ""
echo -e "  ${BOLD}Firewall:${NC}"
echo -e "  Make sure port 11434 is open:"
echo -e "  ${CYAN}sudo ufw allow 11434/tcp${NC}"
echo ""
echo -e "  ${BOLD}Test from AI Admin Panel server:${NC}"
echo -e "  ${CYAN}curl http://${SERVER_IP}:11434/api/tags${NC}"
echo ""
echo -e "  ${BOLD}Useful commands:${NC}"
echo -e "  Status:  sudo systemctl status ollama"
echo -e "  Logs:    sudo journalctl -u ollama -f"
echo -e "  Models:  ollama list"
echo -e "  Pull:    ollama pull <model>"
echo -e "  Remove:  ollama rm <model>"
echo ""
