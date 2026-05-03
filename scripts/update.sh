#!/bin/bash
# Iris — update script (pull latest and restart services)
set -e
APP_DIR="/home/iris/Iris"

cd "$APP_DIR"
echo "==> Pulling latest..."
sudo -u iris git pull

echo "==> Rebuilding binaries..."
sudo -u iris go build -o bin/core     ./services/core/cmd/api
sudo -u iris go build -o bin/hooks    ./services/hooks/cmd/server
sudo -u iris go build -o bin/worker   ./services/worker/cmd
sudo -u iris go build -o bin/telegram ./services/iris-telegram/cmd/bot

echo "==> Rebuilding frontend..."
cd web/iris-web && sudo -u iris npm run build && cd ../..

echo "==> Running any new migrations..."
source .env
for f in services/core/db/migrations/*.up.sql; do
    psql "$DATABASE_URL" -f "$f" || true
done

echo "==> Restarting services..."
systemctl restart iris-core iris-hooks iris-worker iris-telegram
sudo -u iris pm2 restart iris-web

echo "✅ Update complete!"
