#!/usr/bin/env bash
# update.sh — Update MowerManager application from git, install new dependencies, rebuild, update DB schema, and restart service

set -e
APP_DIR="/opt/mower-app"

echo "==> Changing to application directory..."
cd "$APP_DIR"

echo "==> Pulling latest changes from git..."
git pull

echo "==> Installing/updating dependencies..."
NODE_OPTIONS="--max-old-space-size=4096" npm install

echo "==> Building application..."
NODE_OPTIONS="--max-old-space-size=4096" npm run build

echo "==> Updating database schema (if needed)..."
npm run db:push

echo "==> Restarting systemd service..."
systemctl restart mower-app

echo "==> Update complete!"