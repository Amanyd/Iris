package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"
)

const elevenLabsSTTURL = "https://api.elevenlabs.io/v1/speech-to-text"

// TranscribeAudio handles POST /api/v1/ai/transcribe.
//
// Accepts multipart/form-data with a single "audio" field containing the
// recorded audio blob (webm/opus from MediaRecorder). Proxies it to
// ElevenLabs Scribe v1 and returns { "text": "transcript..." }.
//
// Returns 503 if ELEVENLABS_API_KEY is not configured.
func (h *Handler) TranscribeAudio(w http.ResponseWriter, r *http.Request) {
	if h.cfg.ElevenLabsAPIKey == "" {
		writeError(w, http.StatusServiceUnavailable, "STT_UNAVAILABLE",
			"Speech-to-text is not configured. Set ELEVENLABS_API_KEY to enable it.")
		return
	}

	// ── Read the uploaded audio from the "audio" field ────────────────────────
	// Limit to 25 MB — ElevenLabs hard limit
	if err := r.ParseMultipartForm(25 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "failed to parse multipart form")
		return
	}

	file, header, err := r.FormFile("audio")
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "audio field is required")
		return
	}
	defer file.Close()

	audioBytes, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to read audio")
		return
	}

	filename := header.Filename
	if filename == "" {
		filename = "audio.webm" // MediaRecorder default in Chrome
	}

	// ── Forward to ElevenLabs Scribe ─────────────────────────────────────────
	transcript, err := elevenLabsTranscribe(r.Context(), h.cfg.ElevenLabsAPIKey, audioBytes, filename)
	if err != nil {
		h.log.Error("stt: elevenlabs transcribe", "err", err)
		writeError(w, http.StatusBadGateway, "STT_ERROR", "transcription failed: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"text": transcript})
}

// elevenLabsTranscribe sends audio bytes to ElevenLabs Scribe v1 and returns the transcript.
func elevenLabsTranscribe(ctx interface{ Done() <-chan struct{} }, apiKey string, audio []byte, filename string) (string, error) {
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)

	if err := mw.WriteField("model_id", "scribe_v1"); err != nil {
		return "", fmt.Errorf("write model_id: %w", err)
	}

	fw, err := mw.CreateFormFile("file", filename)
	if err != nil {
		return "", fmt.Errorf("create form file: %w", err)
	}
	if _, err := io.Copy(fw, bytes.NewReader(audio)); err != nil {
		return "", fmt.Errorf("copy audio: %w", err)
	}
	if err := mw.Close(); err != nil {
		return "", fmt.Errorf("close writer: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, elevenLabsSTTURL, &buf)
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("xi-api-key", apiKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("elevenlabs returned %d: %s", resp.StatusCode, truncateStr(string(body), 200))
	}

	var result struct {
		Text string `json:"text"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("parse response: %w", err)
	}
	return result.Text, nil
}

func truncateStr(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
