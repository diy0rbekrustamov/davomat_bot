#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  apt-get update
  apt-get install -y docker.io docker-compose-v2 ca-certificates curl
fi
systemctl enable --now docker
timedatectl set-timezone Asia/Tashkent
install -d -m 750 /opt/davomat /opt/davomat/releases /opt/davomat/backups
install -d -m 700 /opt/davomat/secrets
docker --version
docker compose version
df -h /
