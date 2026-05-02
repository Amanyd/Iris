package logger

import (
	"context"
	"log/slog"
	"os"
)

type contextKey string

const (
	keyRequestID contextKey = "request_id"
	keyRelayID   contextKey = "relay_id"
	keyUserID    contextKey = "user_id"
)

// New creates a JSON slog.Logger tagged with the given service name.
func New(serviceName string, level slog.Level) *slog.Logger {
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	return slog.New(handler).With("service", serviceName)
}

// WithRequestID stores a request ID in the context.
func WithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, keyRequestID, id)
}

// WithRelayID stores a relay ID in the context.
func WithRelayID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, keyRelayID, id)
}

// WithUserID stores a user ID in the context.
func WithUserID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, keyUserID, id)
}

// FromContext returns a logger enriched with any IDs stored in ctx.
// If no logger is in ctx it falls back to the default slog logger.
func FromContext(ctx context.Context) *slog.Logger {
	l := slog.Default()

	if v, ok := ctx.Value(keyRequestID).(string); ok && v != "" {
		l = l.With("request_id", v)
	}
	if v, ok := ctx.Value(keyRelayID).(string); ok && v != "" {
		l = l.With("relay_id", v)
	}
	if v, ok := ctx.Value(keyUserID).(string); ok && v != "" {
		l = l.With("user_id", v)
	}

	return l
}
