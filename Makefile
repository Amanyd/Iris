.PHONY: db-migrate-up db-migrate-down db-migrate-create db-reset db-shell \
        dev-core dev-hooks dev-worker dev-telegram dev-all \
        build lint

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

dev-all:
	$(MAKE) -j4 dev-core dev-hooks dev-worker dev-telegram

# ── Build ──────────────────────────────────────────────────────────────────
build:
	go build -o bin/core    ./services/core/cmd/api
	go build -o bin/hooks   ./services/hooks/cmd/server
	go build -o bin/worker  ./services/worker/cmd
	go build -o bin/telegram ./services/iris-telegram/cmd/bot

# ── Lint ───────────────────────────────────────────────────────────────────
lint:
	golangci-lint run ./...
