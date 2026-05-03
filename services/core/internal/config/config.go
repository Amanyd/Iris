package config

import (
	"errors"
	"os"
)

// Config holds all environment-driven configuration for iris-core.
type Config struct {
	// Server
	Port        string
	FrontendURL string

	// Database
	DatabaseURL string

	// NATS
	NATSURL string

	// Auth
	JWTSecret     string
	EncryptionKey string // 32-byte hex string (64 chars)

	// LLM (for the AI relay generation endpoint)
	LLMProvider string // "openai" | "gemini"
	LLMAPIKey   string
	LLMModel    string

	// ElevenLabs (optional — for the /ai/transcribe STT endpoint)
	ElevenLabsAPIKey string

	// ServiceSecret (optional) — shared secret for internal service-to-service calls.
	// When set, the /api/v1/internal/* routes require Authorization: Bearer <secret>.
	ServiceSecret string
}

// Load reads config from environment variables and validates required fields.
func Load() (*Config, error) {
	cfg := &Config{
		Port:        getEnv("CORE_PORT", "3000"),
		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:3001"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		NATSURL:     getEnv("NATS_URL", "nats://localhost:4222"),

		JWTSecret:     os.Getenv("JWT_SECRET"),
		EncryptionKey: os.Getenv("ENCRYPTION_KEY"),

		LLMProvider: getEnv("LLM_PROVIDER", "openai"),
		LLMAPIKey:   os.Getenv("LLM_API_KEY"),
		LLMModel:    getEnv("LLM_MODEL", "gpt-4o-mini"),

		ElevenLabsAPIKey: os.Getenv("ELEVENLABS_API_KEY"),
		ServiceSecret:    os.Getenv("SERVICE_SECRET"), // optional
	}

	return cfg, cfg.validate()
}

func (c *Config) validate() error {
	var missing []string
	if c.DatabaseURL == "" {
		missing = append(missing, "DATABASE_URL")
	}
	if c.JWTSecret == "" {
		missing = append(missing, "JWT_SECRET")
	}
	if c.EncryptionKey == "" {
		missing = append(missing, "ENCRYPTION_KEY")
	}
	if len(missing) > 0 {
		return errors.New("config: missing required env vars: " + join(missing))
	}
	return nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func join(ss []string) string {
	out := ""
	for i, s := range ss {
		if i > 0 {
			out += ", "
		}
		out += s
	}
	return out
}
