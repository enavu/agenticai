#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# enavu-hub Mac Mini Setup Script
# Run this once on a fresh Mac Mini to get everything ready.
# Usage: bash setup-mac-mini.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERR]${NC}  $1"; exit 1; }

echo ""
echo "  ███████╗███╗   ██╗ █████╗ ██╗   ██╗██╗   ██╗"
echo "  ██╔════╝████╗  ██║██╔══██╗██║   ██║██║   ██║"
echo "  █████╗  ██╔██╗ ██║███████║██║   ██║██║   ██║"
echo "  ██╔══╝  ██║╚██╗██║██╔══██║╚██╗ ██╔╝██║   ██║"
echo "  ███████╗██║ ╚████║██║  ██║ ╚████╔╝ ╚██████╔╝"
echo "  ╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝  ╚═══╝   ╚═════╝ "
echo "  Mac Mini Setup Script"
echo ""

# ─── 1. Enable SSH ───────────────────────────────────────────────────────────
info "Enabling SSH (Remote Login)..."
sudo systemsetup -setremotelogin on 2>/dev/null || warn "Could not enable SSH via systemsetup — enable manually: System Settings → General → Sharing → Remote Login"
success "SSH enabled"

# ─── 2. Get Mac's local IP ───────────────────────────────────────────────────
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "unknown")
info "Local IP: ${LOCAL_IP}"
echo ""
warn "ACTION REQUIRED: Set a static DHCP reservation in your UniFi router"
warn "  → UniFi → Network → Client Devices → find this Mac → Static IP → ${LOCAL_IP}"
warn "  → Update port forwarding rules (80/443) to point to ${LOCAL_IP}"
echo ""

# ─── 3. Xcode Command Line Tools ─────────────────────────────────────────────
info "Checking Xcode Command Line Tools..."
if ! xcode-select -p &>/dev/null; then
  info "Installing Xcode Command Line Tools..."
  xcode-select --install
  echo "  → Wait for the installer to finish, then re-run this script."
  exit 0
fi
success "Xcode CLT installed"

# ─── 4. Homebrew ─────────────────────────────────────────────────────────────
info "Checking Homebrew..."
if ! command -v brew &>/dev/null; then
  info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add brew to PATH for Apple Silicon
  if [[ -f /opt/homebrew/bin/brew ]]; then
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
fi
success "Homebrew ready"

# ─── 5. Git ──────────────────────────────────────────────────────────────────
info "Checking git..."
if ! command -v git &>/dev/null; then
  brew install git
fi
success "git ready"

# ─── 6. Docker ───────────────────────────────────────────────────────────────
info "Checking Docker..."
if ! command -v docker &>/dev/null; then
  info "Installing Docker Desktop..."
  brew install --cask docker
  echo ""
  warn "Docker Desktop installed — open it once to complete setup, then re-run this script."
  open /Applications/Docker.app
  exit 0
fi
# Wait for Docker daemon
for i in {1..12}; do
  docker info &>/dev/null && break
  warn "Waiting for Docker daemon... ($i/12)"
  sleep 5
done
docker info &>/dev/null || error "Docker daemon not running. Open Docker Desktop and try again."
success "Docker ready"

# ─── 7. rclone (for Google Drive backups) ────────────────────────────────────
info "Checking rclone..."
if ! command -v rclone &>/dev/null; then
  brew install rclone
fi
success "rclone ready"

# ─── 8. Clone repo ───────────────────────────────────────────────────────────
REPO_DIR="$HOME/Documents/enavu-hub"
info "Checking repo at ${REPO_DIR}..."
if [[ ! -d "$REPO_DIR/.git" ]]; then
  info "Cloning enavu-hub..."
  mkdir -p "$HOME/Documents"
  git clone https://github.com/enavu/agenticai.git "$REPO_DIR"
else
  info "Repo exists — pulling latest..."
  git -C "$REPO_DIR" pull
fi
success "Repo ready at ${REPO_DIR}"

# ─── 9. Create .env ──────────────────────────────────────────────────────────
ENV_FILE="$REPO_DIR/.env"
if [[ -f "$ENV_FILE" ]]; then
  warn ".env already exists — skipping. Edit manually if needed: nano ${ENV_FILE}"
else
  info "Creating .env from template..."
  cat > "$ENV_FILE" << 'ENVEOF'
# ─── Home Assistant ───────────────────────────────────────────────────────────
HA_URL=https://hotel89408.com
HA_TOKEN=REPLACE_ME

# ─── Anthropic ────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=REPLACE_ME

# ─── Instagram ────────────────────────────────────────────────────────────────
INSTAGRAM_ACCESS_TOKEN=REPLACE_ME
INSTAGRAM_USER_ID=REPLACE_ME

# ─── Cyclebar ─────────────────────────────────────────────────────────────────
CYCLEBAR_USERNAME=ena.p.vu@gmail.com
CYCLEBAR_PASSWORD=REPLACE_ME

# ─── Auth ─────────────────────────────────────────────────────────────────────
JWT_SECRET=REPLACE_WITH_LONG_RANDOM_STRING
ADMIN_EMAIL=ena@enavu.io
ADMIN_PASSWORD=REPLACE_ME

# ─── Plaid ────────────────────────────────────────────────────────────────────
PLAID_CLIENT_ID=69fb7e96fd69ca000de0a993
PLAID_SECRET=REPLACE_ME
PLAID_ENV=production
ENVEOF

  warn "ACTION REQUIRED: Fill in REPLACE_ME values in ${ENV_FILE}"
  warn "  → Copy values from your current Mac's .env"
  warn "  → nano ${ENV_FILE}"
fi

# ─── 10. Postgres backup script ──────────────────────────────────────────────
BACKUP_SCRIPT="$HOME/backup.sh"
info "Creating backup script at ${BACKUP_SCRIPT}..."
cat > "$BACKUP_SCRIPT" << 'BACKUPEOF'
#!/bin/bash
# Daily Postgres backup → Google Drive
set -e
BACKUP_DIR="$HOME/backups"
DATE=$(date +%Y-%m-%d)
mkdir -p "$BACKUP_DIR"

docker exec enavu-hub-postgres-1 pg_dump -U enavu enavu_hub | gzip > "$BACKUP_DIR/enavu_hub_${DATE}.sql.gz"
rclone copy "$BACKUP_DIR/enavu_hub_${DATE}.sql.gz" gdrive:enavu-hub-backups/
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
echo "[$(date)] Backup done: enavu_hub_${DATE}.sql.gz"
BACKUPEOF
chmod +x "$BACKUP_SCRIPT"
success "Backup script created"

# ─── 11. Crontab for daily backup ────────────────────────────────────────────
info "Setting up daily backup cron (2am)..."
CRON_JOB="0 2 * * * $BACKUP_SCRIPT >> $HOME/backups/backup.log 2>&1"
( crontab -l 2>/dev/null | grep -v "backup.sh"; echo "$CRON_JOB" ) | crontab -
success "Cron job set"

# ─── 12. Build and start ─────────────────────────────────────────────────────
echo ""
info "Building and starting enavu-hub..."
cd "$REPO_DIR"
docker compose build
docker compose up -d
success "enavu-hub is running"

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
echo "  Setup complete!"
echo "════════════════════════════════════════════════════════"
echo ""
echo "  Local IP:    ${LOCAL_IP}"
echo "  SSH:         ssh $(whoami)@${LOCAL_IP}"
echo "  App:         http://${LOCAL_IP}:3000 (local)"
echo "  Repo:        ${REPO_DIR}"
echo "  Env file:    ${ENV_FILE}"
echo ""
echo "  NEXT STEPS:"
echo "  1. Fill in .env values:  nano ${ENV_FILE}"
echo "  2. Set static IP in UniFi for ${LOCAL_IP}"
echo "  3. Update port forwarding (80/443) to ${LOCAL_IP}"
echo "  4. Set up rclone Google Drive: rclone config"
echo "  5. Restart services after .env update:"
echo "     cd ${REPO_DIR} && docker compose up -d"
echo ""
echo "  Restore Postgres from backup:"
echo "  gunzip -c ~/backups/enavu_hub_YYYY-MM-DD.sql.gz | docker exec -i enavu-hub-postgres-1 psql -U enavu enavu_hub"
echo ""
