#!/bin/sh
set -e

# ── Resolve Render's PORT (defaults to 10000) ─────────────────────────────────
export NGINX_PORT="${PORT:-10000}"
export NATS_URL="nats://127.0.0.1:4222"
export IRIS_CORE_URL="http://127.0.0.1:3000"

echo "═══════════════════════════════════════════════════════════"
echo "  🌐 iris — combined deployment"
echo "  Nginx port: ${NGINX_PORT}"
echo "═══════════════════════════════════════════════════════════"

# ── 1. Run database migrations ────────────────────────────────────────────────
echo "[iris] Running database migrations..."
for f in /migrations/*.up.sql; do
    echo "[iris]   → $(basename "$f")"
    psql "$DATABASE_URL" -f "$f" 2>&1 || echo "[iris]   ⚠ already applied, skipping"
done
echo "[iris] Migrations complete."

# ── 2. Start NATS (JetStream enabled) ────────────────────────────────────────
echo "[iris] Starting NATS server..."
nats-server -js -p 4222 &
NATS_PID=$!
sleep 1

if ! kill -0 $NATS_PID 2>/dev/null; then
    echo "[iris] ✗ NATS failed to start"
    exit 1
fi
echo "[iris] ✓ NATS running (PID $NATS_PID)"

# ── 3. Start Go services ─────────────────────────────────────────────────────
echo "[iris] Starting iris-core..."
/bin/iris-core &
CORE_PID=$!

echo "[iris] Starting iris-hooks..."
/bin/iris-hooks &
HOOKS_PID=$!

echo "[iris] Starting iris-worker..."
/bin/iris-worker &
WORKER_PID=$!

# Wait for core to be healthy before starting telegram
echo "[iris] Waiting for iris-core to be ready..."
for i in $(seq 1 30); do
    if wget -qO- http://127.0.0.1:3000/health >/dev/null 2>&1; then
        echo "[iris] ✓ iris-core healthy"
        break
    fi
    sleep 1
done

echo "[iris] Starting iris-telegram..."
/bin/iris-telegram &
TELEGRAM_PID=$!

# ── 4. Start nginx (public-facing port) ──────────────────────────────────────
echo "[iris] Configuring nginx on port ${NGINX_PORT}..."

# envsubst the port into the nginx config
envsubst '${NGINX_PORT}' < /etc/nginx/http.d/default.conf > /tmp/nginx.conf
cp /tmp/nginx.conf /etc/nginx/http.d/default.conf

nginx -g 'daemon off;' &
NGINX_PID=$!

echo "═══════════════════════════════════════════════════════════"
echo "  ✓ All services running"
echo "  Core:     PID $CORE_PID"
echo "  Hooks:    PID $HOOKS_PID"
echo "  Worker:   PID $WORKER_PID"
echo "  Telegram: PID $TELEGRAM_PID"
echo "  NATS:     PID $NATS_PID"
echo "  Nginx:    PID $NGINX_PID"
echo "═══════════════════════════════════════════════════════════"

# ── 5. Trap signals and wait ──────────────────────────────────────────────────
cleanup() {
    echo "[iris] Shutting down all services..."
    kill $NGINX_PID $TELEGRAM_PID $WORKER_PID $HOOKS_PID $CORE_PID $NATS_PID 2>/dev/null
    wait
    echo "[iris] All services stopped."
}

trap cleanup SIGINT SIGTERM

# Wait for any child to exit — if one crashes, restart the container
wait
