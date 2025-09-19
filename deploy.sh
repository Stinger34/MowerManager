#!/usr/bin/env bash
# deploy.sh — Deploy MowerManager application by installing dependencies, building, updating DB schema, and restarting service

set -e

echo "==> Pulling latest changes from dev branch..."
if ! git pull origin dev; then
    echo "ERROR: Failed to pull latest changes from dev branch" >&2
    exit 1
fi

echo "==> Installing dependencies..."
if ! NODE_OPTIONS="--max-old-space-size=4096" npm install; then
    echo "ERROR: Failed to install dependencies" >&2
    exit 1
fi

echo "==> Building application..."
if ! NODE_OPTIONS="--max-old-space-size=4096" npm run build; then
    echo "ERROR: Failed to build application" >&2
    exit 1
fi

echo "==> Updating database schema..."
if ! npm run db:push; then
    echo "ERROR: Failed to update database schema" >&2
    exit 1
fi

echo "==> Restarting mower-app service..."
if ! systemctl restart mower-app; then
    echo "ERROR: Failed to restart mower-app service" >&2
    exit 1
fi

echo "==> Clearing application cache (if applicable)..."
# Add commands to clear caches here (if needed)

echo "==> Deployment complete!"
