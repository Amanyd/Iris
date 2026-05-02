package config

import (
	"bufio"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Config holds all environment-driven configuration for iris-telegram.
type Config struct {
	TelegramBotToken string
	LLMProvider      string
	LLMAPIKey        string
	LLMModel         string
	IrisCoreURL      string // e.g. "http://localhost:3000"
	IrisHooksURL     string // e.g. "http://localhost:8080" — used to display webhook URLs
	DatabaseURL      string // for telegram_links table
	NATSURL          string // for execution notifications
	SessionTTL       time.Duration
	ElevenLabsAPIKey string // optional: enables voice-note STT via ElevenLabs Scribe
}

// Load reads config from environment variables.
// It also attempts to auto-load the root .env file so the bot can be run
// from any working directory without manually sourcing env vars.
func Load() (*Config, error) {
	loadDotEnv()
	cfg := &Config{
		TelegramBotToken: os.Getenv("TELEGRAM_BOT_TOKEN"),
		LLMProvider:      getEnv("LLM_PROVIDER", "openai"),
		LLMAPIKey:        os.Getenv("LLM_API_KEY"),
		LLMModel:         getEnv("LLM_MODEL", "gpt-4o-mini"),
		IrisCoreURL:      getEnv("IRIS_CORE_URL", "http://localhost:3000"),
		IrisHooksURL:     getEnv("IRIS_HOOKS_URL", "http://localhost:8080"),
		DatabaseURL:      os.Getenv("DATABASE_URL"),
		NATSURL:          getEnv("NATS_URL", "nats://localhost:4222"),
		SessionTTL:       getEnvDuration("SESSION_TTL", 24*time.Hour),
		ElevenLabsAPIKey: os.Getenv("ELEVENLABS_API_KEY"),
	}
	return cfg, cfg.validate()
}

func (c *Config) validate() error {
	var missing []string
	// TELEGRAM_BOT_TOKEN is optional here — main.go fetches it from iris-core if absent
	if c.DatabaseURL == "" {
		missing = append(missing, "DATABASE_URL")
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

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}

func join(ss []string) string {
	result := ""
	for i, s := range ss {
		if i > 0 {
			result += ", "
		}
		result += s
	}
	return result
}

// loadDotEnv walks up from the current working directory to find the
// repo-root .env file and loads any keys not already set in the environment.
// Explicitly-set env vars always win over .env values.
func loadDotEnv() {
	cwd, err := os.Getwd()
	if err != nil {
		return
	}
	for dir := cwd; ; dir = filepath.Dir(dir) {
		path := filepath.Join(dir, ".env")
		if f, err := os.Open(path); err == nil {
			scanner := bufio.NewScanner(f)
			for scanner.Scan() {
				line := strings.TrimSpace(scanner.Text())
				if line == "" || strings.HasPrefix(line, "#") {
					continue
				}
				parts := strings.SplitN(line, "=", 2)
				if len(parts) != 2 {
					continue
				}
				key := strings.TrimSpace(parts[0])
				val := strings.TrimSpace(parts[1])
				if os.Getenv(key) == "" {
					os.Setenv(key, val)
				}
			}
			f.Close()
			return
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break // reached filesystem root
		}
	}
}
