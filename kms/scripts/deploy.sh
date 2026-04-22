#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# KMS — Deployment Script (RHEL / CentOS / Rocky Linux)
#
# Designed for a server that already runs Nginx + wildcard SSL and
# hosts other apps. KMS is deployed under a subpath, e.g. /kms/.
# The Docker stack runs backend + data services; host Nginx proxies.
#
# Usage (from the kms/ directory):
#   chmod +x scripts/deploy.sh
#   ./scripts/deploy.sh --domain poc.moph.go.th --subpath /kms --static-dir /home/kms/www
#
# Flags:
#   --domain      Host + domain only, no trailing slash  (e.g. poc.moph.go.th)
#   --subpath     Subpath KMS is served under           (default: /kms)
#   --static-dir  Where host Nginx serves frontend HTML (default: /home/kms/www)
#   --skip-docker Skip Docker rebuild (re-deploy frontend/nginx only)
# ════════════════════════════════════════════════════════════════════

set -euo pipefail

DOMAIN=""
SUBPATH="/kms"
STATIC_DIR="/home/kms/www"
SKIP_DOCKER=false
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ─── Argument parsing ────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --domain)      DOMAIN="$2";      shift 2 ;;
    --subpath)     SUBPATH="$2";     shift 2 ;;
    --static-dir)  STATIC_DIR="$2";  shift 2 ;;
    --skip-docker) SKIP_DOCKER=true; shift   ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: $0 --domain your.domain.com [--subpath /kms] [--static-dir /home/kms/www]"
  exit 1
fi

# Normalise: subpath must start with / and have no trailing /
SUBPATH="/${SUBPATH#/}"
SUBPATH="${SUBPATH%/}"
BACKEND_PORT=3100   # host port bound by docker-compose.server.yml

echo "════════════════════════════════════════════════════════"
echo "  KMS Deployment"
echo "  Domain  : $DOMAIN"
echo "  Subpath : $SUBPATH"
echo "  Static  : $STATIC_DIR"
echo "════════════════════════════════════════════════════════"

# ─── 1. System dependencies ──────────────────────────────────────
echo "[1/7] Checking system dependencies..."

# Detect package manager — prefer dnf (RHEL 8+), fall back to yum
if command -v dnf &>/dev/null; then
  PKG="dnf"
elif command -v yum &>/dev/null; then
  PKG="yum"
else
  echo "❌ Neither dnf nor yum found. This script supports RHEL/CentOS/Rocky Linux."
  exit 1
fi

# Install curl / git if missing (minimal installs may lack them)
for pkg in curl git; do
  command -v "$pkg" &>/dev/null || $PKG install -y "$pkg"
done

# ─── 2. Docker ───────────────────────────────────────────────────
echo "[2/7] Checking Docker..."
if ! command -v docker &>/dev/null; then
  echo "  Installing Docker CE..."
  $PKG install -y yum-utils
  yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
  $PKG install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
  echo "  Docker installed and started."
fi

# docker compose (V2 plugin) OR standalone docker-compose
if docker compose version &>/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE="docker-compose"
else
  echo "  Installing docker-compose standalone..."
  curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
    -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
  COMPOSE="docker-compose"
fi
echo "  Using: $COMPOSE"

# ─── 3. Node.js + npm (for frontend build) ───────────────────────
echo "[3/7] Checking Node.js..."
if ! command -v node &>/dev/null; then
  echo "  Installing Node.js 20 via NodeSource..."
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
  $PKG install -y nodejs
fi
echo "  Node $(node -v) / npm $(npm -v)"

# ─── 4. Environment file ─────────────────────────────────────────
echo "[4/7] Checking .env file..."
cd "$REPO_DIR"
if [[ ! -f ".env" ]]; then
  if [[ -f ".env.server.example" ]]; then
    echo "  ⚠️  .env not found. Copying from .env.server.example — EDIT IT before re-running."
    cp .env.server.example .env
    echo "  👉  nano $REPO_DIR/.env"
    exit 1
  else
    echo "  ❌ .env not found. Create it from .env.server.example."
    exit 1
  fi
fi

# ─── 5. Build frontend ────────────────────────────────────────────
echo "[5/7] Building frontend..."
cd "$REPO_DIR/frontend"
npm ci --prefer-offline --silent

VITE_BASE_PATH="${SUBPATH}/" \
VITE_API_URL="https://${DOMAIN}${SUBPATH}" \
npm run build

mkdir -p "$STATIC_DIR"
rm -rf "${STATIC_DIR:?}"/*
cp -r dist/. "$STATIC_DIR/"
echo "  Frontend copied to $STATIC_DIR"

# ─── 6. Docker — backend + data services ─────────────────────────
if [[ "$SKIP_DOCKER" == false ]]; then
  echo "[6/7] Building and starting Docker services..."
  cd "$REPO_DIR"

  $COMPOSE \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    -f docker-compose.server.yml \
    up -d --build postgres chromadb redis python-service backend

  echo "  Waiting for services to become healthy (up to 60 s)..."
  for i in $(seq 1 12); do
    if $COMPOSE -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.server.yml \
         ps --filter "status=running" | grep -q kms_backend; then
      break
    fi
    sleep 5
  done

  echo "  Running Prisma migrations..."
  $COMPOSE \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    -f docker-compose.server.yml \
    exec -T backend npx prisma migrate deploy

  $COMPOSE \
    -f docker-compose.yml \
    -f docker-compose.prod.yml \
    -f docker-compose.server.yml \
    exec -T backend npm run db:seed || true
else
  echo "[6/7] Skipping Docker (--skip-docker set)."
fi

# ─── 7. Nginx config snippet ─────────────────────────────────────
echo "[7/7] Writing Nginx location snippet..."

NGINX_SNIPPET="/etc/nginx/conf.d/kms-locations.conf"
# This file is meant to be included inside the existing 443 server block.
# Include it manually if your nginx.conf does not already have:
#   include /etc/nginx/conf.d/kms-locations.conf;
cat > "$NGINX_SNIPPET" <<NGINXEOF
# ─── KMS Frontend (static SPA) — generated by deploy.sh ─────────
location ${SUBPATH}/ {
    alias ${STATIC_DIR}/;
    index index.html;
    try_files \$uri \$uri/ ${SUBPATH}/index.html;
}

# ─── KMS API (Node.js backend on ${BACKEND_PORT}) ─────────────────
location ${SUBPATH}/api/ {
    client_max_body_size 60M;

    proxy_pass http://127.0.0.1:${BACKEND_PORT}/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_cache_bypass \$http_upgrade;
    proxy_read_timeout 300s;
}
NGINXEOF

echo ""
echo "  Nginx snippet written to $NGINX_SNIPPET"
echo ""
echo "  ⚠️  ACTION REQUIRED — add this inside your 443 server block in"
echo "  /etc/nginx/nginx.conf (if not already present):"
echo ""
echo "      include /etc/nginx/conf.d/kms-locations.conf;"
echo ""

if nginx -t 2>/dev/null; then
  systemctl reload nginx
  echo "  Nginx reloaded."
else
  echo "  ⚠️  nginx -t failed — reload Nginx manually after updating nginx.conf."
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "  KMS Deployed Successfully!"
echo "  URL    : https://${DOMAIN}${SUBPATH}/"
echo "  Health : https://${DOMAIN}${SUBPATH}/api/health"
echo "════════════════════════════════════════════════════════"
