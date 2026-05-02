package stt

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"
)

const (
	elevenLabsSTTURL = "https://api.elevenlabs.io/v1/speech-to-text"
	// Scribe v1 supports ogg/opus natively — no re-encoding needed for Telegram voice notes.
	defaultModel = "scribe_v1"
)

// Client is a thin ElevenLabs Speech-to-Text client.
type Client struct {
	apiKey     string
	httpClient *http.Client
}

// New creates a Client with the given ElevenLabs API key.
func New(apiKey string) *Client {
	return &Client{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Transcribe sends audio bytes to ElevenLabs Scribe and returns the transcript.
// filename should include the extension (e.g. "voice.ogg") so the API can
// detect the codec. Telegram voice notes are always OGG/Opus.
func (c *Client) Transcribe(ctx context.Context, audio []byte, filename string) (string, error) {
	// ── Build multipart body ─────────────────────────────────────────────────
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)

	// model_id field
	if err := mw.WriteField("model_id", defaultModel); err != nil {
		return "", fmt.Errorf("stt: write model_id field: %w", err)
	}

	// file field
	fw, err := mw.CreateFormFile("file", filename)
	if err != nil {
		return "", fmt.Errorf("stt: create form file: %w", err)
	}
	if _, err := io.Copy(fw, bytes.NewReader(audio)); err != nil {
		return "", fmt.Errorf("stt: copy audio bytes: %w", err)
	}

	if err := mw.Close(); err != nil {
		return "", fmt.Errorf("stt: close multipart writer: %w", err)
	}

	// ── HTTP request ─────────────────────────────────────────────────────────
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, elevenLabsSTTURL, &buf)
	if err != nil {
		return "", fmt.Errorf("stt: build request: %w", err)
	}
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("xi-api-key", c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("stt: http request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("stt: read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("stt: elevenlabs returned %d: %s", resp.StatusCode, truncate(string(body), 200))
	}

	// ── Parse response ───────────────────────────────────────────────────────
	var result struct {
		Text string `json:"text"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("stt: parse response: %w (body: %s)", err, truncate(string(body), 200))
	}
	if result.Text == "" {
		return "", fmt.Errorf("stt: empty transcript returned")
	}

	return result.Text, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
