module github.com/eulerbutcooler/iris/services/core

go 1.22

require (
	github.com/eulerbutcooler/iris/packages v0.0.0
	github.com/go-chi/chi/v5 v5.1.0
	github.com/go-chi/cors v1.2.1
	github.com/golang-jwt/jwt/v5 v5.2.1
	github.com/google/uuid v1.6.0
	github.com/jackc/pgx/v5 v5.6.0
	github.com/nats-io/nats.go v1.36.0
	github.com/sashabaranov/go-openai v1.26.2
	golang.org/x/crypto v0.24.0
)

replace github.com/eulerbutcooler/iris/packages => ../../packages
