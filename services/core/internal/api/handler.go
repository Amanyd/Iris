package api

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/eulerbutcooler/iris/packages/encryptor"
	"github.com/eulerbutcooler/iris/services/core/internal/ai"
	"github.com/eulerbutcooler/iris/services/core/internal/config"
	"github.com/eulerbutcooler/iris/services/core/internal/queue"
)

// Handler holds all dependencies for the HTTP handlers.
type Handler struct {
	relays    RelayStore
	secrets   SecretStore
	users     UserStore
	settings  SettingsStore
	publisher *queue.Publisher
	llm       ai.LLMClient
	enc       *encryptor.Encryptor
	cfg       *config.Config
	log       *slog.Logger
}

// NewHandler creates a Handler with all dependencies injected.
func NewHandler(
	relays RelayStore,
	secrets SecretStore,
	users UserStore,
	settings SettingsStore,
	publisher *queue.Publisher,
	llm ai.LLMClient,
	enc *encryptor.Encryptor,
	cfg *config.Config,
	log *slog.Logger,
) *Handler {
	return &Handler{
		relays:    relays,
		secrets:   secrets,
		users:     users,
		settings:  settings,
		publisher: publisher,
		llm:       llm,
		enc:       enc,
		cfg:       cfg,
		log:       log,
	}
}

// HealthCheck handles GET /health.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "iris-core"})
}

// ─── JSON helpers ─────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		// Best-effort; headers already sent
		return
	}
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"code": code, "message": message})
}

func decodeJSON(r *http.Request, v any) error {
	return json.NewDecoder(r.Body).Decode(v)
}
