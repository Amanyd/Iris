package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/eulerbutcooler/iris/packages/logger"
	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"github.com/eulerbutcooler/iris/services/iris-telegram/internal/bot"
	"github.com/eulerbutcooler/iris/services/iris-telegram/internal/config"
	irisClient "github.com/eulerbutcooler/iris/services/iris-telegram/internal/iris"
	"github.com/eulerbutcooler/iris/services/iris-telegram/internal/stt"
	"github.com/eulerbutcooler/iris/services/iris-telegram/internal/store"
)

func main() {
	// ── Config ────────────────────────────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		slog.Error("config load failed", "err", err)
		os.Exit(1)
	}

	// ── Logger ────────────────────────────────────────────────────────────────
	log := logger.New("iris-telegram", slog.LevelInfo)
	log.Info("starting iris-telegram")

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// ── Database ──────────────────────────────────────────────────────────────
	pool, err := store.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Error("db connect failed", "err", err)
		os.Exit(1)
	}
	defer pool.Close()
	log.Info("database connected")

	db := store.New(pool)

	// ── iris-core Client ──────────────────────────────────────────────────────
	// AI relay generation is delegated to iris-core (Gemini) — no local LLM needed.
	iris := irisClient.NewClient(cfg.IrisCoreURL)
	log.Info("iris-core client ready", "url", cfg.IrisCoreURL)

	// ── Session Manager ───────────────────────────────────────────────────────
	sessions := bot.NewSessionManager(cfg.SessionTTL)
	sessions.StartCleanup(ctx)

	// ── STT Client (optional) ─────────────────────────────────────────────────
	var sttClient *stt.Client
	if cfg.ElevenLabsAPIKey != "" {
		sttClient = stt.New(cfg.ElevenLabsAPIKey)
		log.Info("elevenlabs STT enabled — voice notes will be transcribed")
	} else {
		log.Warn("ELEVENLABS_API_KEY not set — voice note STT disabled")
	}

	// ── Resolve bot token (env → core settings API fallback) ─────────────────
	botToken := cfg.TelegramBotToken
	if botToken == "" {
		log.Info("TELEGRAM_BOT_TOKEN not set in env — fetching from iris-core settings...", "core_url", cfg.IrisCoreURL)
		botToken, err = fetchTokenFromCore(ctx, cfg.IrisCoreURL)
		if err != nil {
			log.Error("could not reach iris-core to fetch bot token",
				"err", err,
				"hint", "either start iris-core first, or add TELEGRAM_BOT_TOKEN=<token> to your .env file")
			os.Exit(1)
		}
		if botToken == "" {
			log.Error("bot token not found in iris-core settings",
				"hint", "go to the Connections page in the UI, paste your BotFather token, and click Save — then restart the bot")
			os.Exit(1)
		}
		log.Info("telegram bot token loaded from iris-core settings")
	}

	// ── Bot ───────────────────────────────────────────────────────────────────
	b, err := bot.New(botToken, sessions, iris, db, sttClient, log)
	if err != nil {
		log.Error("bot init failed", "err", err)
		os.Exit(1)
	}

	// ── Notification Subscriber (Phase 8) ─────────────────────────────────────
	// Directly access the underlying tgbotapi instance for notifier
	rawAPI, err := tgbotapi.NewBotAPI(botToken)
	if err != nil {
		log.Warn("notifier: second bot api init failed — notifications disabled", "err", err)
	} else {
		notifier, err := bot.NewNotifier(cfg.NATSURL, rawAPI, db, log)
		if err != nil {
			log.Warn("notification subscriber unavailable", "err", err)
		} else {
			if err := notifier.Start(ctx); err != nil {
				log.Warn("notification subscriber start failed", "err", err)
			} else {
				defer notifier.Stop()
			}
		}
	}

	// ── Run ───────────────────────────────────────────────────────────────────
	b.Start(ctx)
	log.Info("iris-telegram stopped")
}

// fetchTokenFromCore calls iris-core's settings endpoint to retrieve the
// Telegram bot token that was saved via the frontend UI.
func fetchTokenFromCore(ctx context.Context, coreURL string) (string, error) {
	url := coreURL + "/api/v1/internal/settings/telegram_bot_token"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	if svcSecret := os.Getenv("SERVICE_SECRET"); svcSecret != "" {
		req.Header.Set("Authorization", "Bearer "+svcSecret)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("core settings returned %d", resp.StatusCode)
	}
	var body struct {
		Value string `json:"value"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", err
	}
	return body.Value, nil
}
