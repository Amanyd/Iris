package api

import (
	"net/http"
	"strings"
)

// sensitiveKeys are masked when returned to the client (show only first 8 chars + …).
var sensitiveKeys = map[string]bool{
	"telegram_bot_token": true,
	"elevenlabs_api_key": true,
	"llm_api_key":        true,
}

func maskValue(key, value string) string {
	if !sensitiveKeys[strings.ToLower(key)] || len(value) < 8 {
		return value
	}
	return value[:8] + "…"
}

// GetSettings handles GET /api/v1/settings.
// Returns all stored settings. Sensitive values are masked.
func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	all, err := h.settings.GetAll(r.Context())
	if err != nil {
		h.log.Error("settings: get_all", "err", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to load settings")
		return
	}

	// Mask sensitive values
	masked := make(map[string]string, len(all))
	for k, v := range all {
		masked[k] = maskValue(k, v)
	}
	writeJSON(w, http.StatusOK, masked)
}

// PutSettings handles PUT /api/v1/settings.
// Body: { "key": "telegram_bot_token", "value": "123:ABC..." }
func (h *Handler) PutSettings(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}
	if req.Key == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "key is required")
		return
	}

	if err := h.settings.Set(r.Context(), req.Key, req.Value); err != nil {
		h.log.Error("settings: set", "key", req.Key, "err", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to save setting")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "key": req.Key})
}

// GetSettingValue handles GET /api/v1/settings/{key}.
// Used by internal services (e.g. iris-telegram) to fetch a specific key.
// Does NOT mask values — caller must be authenticated.
func (h *Handler) GetSettingValue(w http.ResponseWriter, r *http.Request) {
	key := r.PathValue("key")
	if key == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "key is required")
		return
	}

	value, err := h.settings.Get(r.Context(), key)
	if err != nil {
		h.log.Error("settings: get", "key", key, "err", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to load setting")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"key": key, "value": value})
}
