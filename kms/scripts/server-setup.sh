#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════
# KMS — Fresh Linux Server Setup (run ONCE as root or sudo user)
# Tested on: Ubuntu 22.04 LTS
#
# Usage: sudo bash scripts/server-setup.sh
# ════════════════════════════════════════════════════════════════════

set -euo pipefail

echo "════════════════════════════════════════════"
echo "  KMS Server Hardening & Setup"
echo "════════════════════════════════════════════"

# ─── Update system ────────────────────────────────────────────────
apt-get update && apt-get upgrade -y

# ─── Essential packages ───────────────────────────────────────────
apt-get install -y \
  curl wget git unzip \
  ufw fail2ban \
  htop vim \
  build-essential

# ─── Create app user ──────────────────────────────────────────────
if ! id "kmsapp" &>/dev/null; then
  useradd -m -s /bin/bash kmsapp
  usermod -aG sudo kmsapp
  echo "✅ Created user: kmsapp"
fi

# ─── Firewall ─────────────────────────────────────────────────────
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable
echo "✅ UFW firewall configured"

# ─── Fail2ban ─────────────────────────────────────────────────────
systemctl enable fail2ban
systemctl start fail2ban
echo "✅ Fail2ban enabled"

# ─── Swap (helpful for embedding model loading) ───────────────────
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "vm.swappiness=10" >> /etc/sysctl.conf
  echo "✅ 4GB swap created"
fi

# ─── Docker ───────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker kmsapp
  systemctl enable docker
  echo "✅ Docker installed"
fi

# ─── Docker Compose ───────────────────────────────────────────────
if ! command -v docker-compose &>/dev/null; then
  curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
    -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
  echo "✅ Docker Compose installed"
fi

# ─── Directory structure ──────────────────────────────────────────
mkdir -p /opt/kms
chown kmsapp:kmsapp /opt/kms
echo "✅ App directory: /opt/kms"

echo ""
echo "════════════════════════════════════════════"
echo "  ✅ Server setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Switch to kmsapp: su - kmsapp"
echo "  2. Clone your repo:  cd /opt/kms && git clone <repo_url> ."
echo "  3. Configure env:    cp .env.example .env && nano .env"
echo "  4. Deploy:           bash scripts/deploy.sh --domain your.domain.com --email admin@domain.com"
echo "════════════════════════════════════════════"
