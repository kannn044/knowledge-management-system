#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# KMS — Linux Server Deployment Script
# Run on your Linux server (Ubuntu 22.04 / Debian 12 recommended)
#
# Usage:
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh --domain kms.yourdomain.com --email admin@yourdomain.com
# ════════════════════════════════════════════════════════════════════

set -euo pipefail

DOMAIN=""
EMAIL=""
REPO_DIR="$(pwd)"

# ─── Argument parsing ────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email)  EMAIL="$2";  shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Usage: $0 --domain your.domain.com --email admin@domain.com"
  exit 1
fi

echo "════════════════════════════════════════════════════════"
echo "  KMS Deployment — Domain: $DOMAIN"
echo "════════════════════════════════════════════════════════"

# ─── 1. System dependencies ───────────────────────────────────────
echo "[1/8] Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq \
  apt-transport-https \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  nginx \
  certbot \
  python3-certbot-nginx \
  ufw

# ─── 2. Docker ───────────────────────────────────────────────────
echo "[2/8] Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "⚠️  You may need to re-login for Docker group to take effect."
fi

if ! command -v docker-compose &>/dev/null; then
  sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
    -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
fi

# ─── 3. Firewall ──────────────────────────────────────────────────
echo "[3/8] Configuring UFW firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# ─── 4. Environment file ──────────────────────────────────────────
echo "[4/8] Checking .env file..."
if [[ ! -f "$REPO_DIR/.env" ]]; then
  echo "❌ .env file not found. Copy .env.example to .env and fill in values."
  echo "   cp .env.example .env && nano .env"
  exit 1
fi

# ─── 5. Nginx domain config ──────────────────────────────────────
echo "[5/8] Configuring Nginx for $DOMAIN..."
sudo sed -i "s/kms.yourdomain.com/$DOMAIN/g" "$REPO_DIR/nginx/conf.d/kms.conf"

# Temporary HTTP-only config for Certbot challenge
sudo tee /etc/nginx/sites-available/kms-temp.conf > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    root /var/www/certbot;
    location /.well-known/acme-challenge/ { }
}
EOF
sudo ln -sf /etc/nginx/sites-available/kms-temp.conf /etc/nginx/sites-enabled/kms-temp.conf
sudo nginx -t && sudo systemctl reload nginx

# ─── 6. SSL Certificate ──────────────────────────────────────────
echo "[6/8] Obtaining SSL certificate from Let's Encrypt..."
sudo mkdir -p /var/www/certbot
sudo certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --non-interactive

# Remove temp nginx config
sudo rm -f /etc/nginx/sites-enabled/kms-temp.conf

# ─── 7. Build & start Docker services ────────────────────────────
echo "[7/8] Building and starting Docker Compose services..."
cd "$REPO_DIR"

# Build frontend with production env vars
source .env
export VITE_API_URL="https://$DOMAIN"

docker-compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  build

docker-compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d

# Wait for services to be healthy
echo "Waiting for services to start..."
sleep 15

# Run Prisma migrations
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run db:seed || true

# ─── 8. Nginx production config ──────────────────────────────────
echo "[8/8] Activating production Nginx config..."

# Copy frontend build into nginx html dir
docker cp kms_frontend:/usr/share/nginx/html/. /usr/share/nginx/html/ 2>/dev/null || true

sudo cp "$REPO_DIR/nginx/nginx.conf" /etc/nginx/nginx.conf
sudo cp "$REPO_DIR/nginx/conf.d/kms.conf" /etc/nginx/conf.d/kms.conf
sudo nginx -t && sudo systemctl restart nginx

# ─── Certbot auto-renewal ─────────────────────────────────────────
echo "Setting up Certbot auto-renewal..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx") | crontab -

echo ""
echo "════════════════════════════════════════════════════════"
echo "  ✅ KMS Deployed Successfully!"
echo "  🌐 URL: https://$DOMAIN"
echo "  📊 Health: https://$DOMAIN/api/health"
echo "════════════════════════════════════════════════════════"
