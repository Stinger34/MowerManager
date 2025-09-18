#!/usr/bin/env bash
# deploy.sh — Deploy MowerManager application by installing dependencies, building, updating DB schema, and starting service

set -e

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

echo "==> Starting mower-app service..."
if ! systemctl start mower-app; then
    echo "ERROR: Failed to start mower-app service" >&2
    exit 1
fi

echo "==> Deployment complete!"