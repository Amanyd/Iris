include .env
export

.PHONY: infra-up infra-down db-migrate-up db-migrate-down db-migrate-create db-reset db-shell \
        dev-core dev-hooks dev-worker dev-telegram dev-all dev-backend \
        build lint

# ── Infrastructure ─────────────────────────────────────────────────────────
infra-up:
	docker compose up -d

infra-down:
	docker compose down

# ── Database ───────────────────────────────────────────────────────────────
db-migrate-up:
	migrate -path services/core/db/migrations -database "$(DATABASE_URL)" up

db-migrate-down:
	migrate -path services/core/db/migrations -database "$(DATABASE_URL)" down 1

db-migrate-create:
	migrate create -ext sql -dir services/core/db/migrations -seq $(NAME)

db-reset:
	migrate -path services/core/db/migrations -database "$(DATABASE_URL)" drop -f
	$(MAKE) db-migrate-up

db-shell:
	psql "$(DATABASE_URL)"

# ── Dev servers ────────────────────────────────────────────────────────────
dev-core:
	go run ./services/core/cmd/api

dev-hooks:
	go run ./services/hooks/cmd/server

dev-worker:
	go run ./services/worker/cmd

dev-telegram:
	go run ./services/iris-telegram/cmd/bot

# Waits for iris-core to be reachable, then starts the telegram bot.
# Retries every 5s if the bot exits due to missing token (e.g. waiting for UI config).
dev-telegram-delayed:
	@echo "[telegram] waiting for iris-core to be ready..."
	@until curl -sf http://localhost:3000/health > /dev/null 2>&1; do sleep 1; done
	@echo "[telegram] iris-core is up, starting bot..."
	@while true; do \
		go run ./services/iris-telegram/cmd/bot && break; \
		echo "[telegram] bot exited — retrying in 5s (set TELEGRAM_BOT_TOKEN in .env or via the Connections page)"; \
		sleep 5; \
	done

dev-backend:
	$(MAKE) -j3 dev-core dev-hooks dev-worker

dev-all:
	$(MAKE) -j4 dev-core dev-hooks dev-worker dev-telegram-delayed

# ── Build ──────────────────────────────────────────────────────────────────
build:
	go build -o bin/core    ./services/core/cmd/api
	go build -o bin/hooks   ./services/hooks/cmd/server
	go build -o bin/worker  ./services/worker/cmd
	go build -o bin/telegram ./services/iris-telegram/cmd/bot

# ── Lint ───────────────────────────────────────────────────────────────────
lint:
	golangci-lint run ./...
