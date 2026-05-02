package bot

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"github.com/eulerbutcooler/iris/services/iris-telegram/internal/ai"
	irisClient "github.com/eulerbutcooler/iris/services/iris-telegram/internal/iris"
	"github.com/eulerbutcooler/iris/services/iris-telegram/internal/stt"
	"github.com/eulerbutcooler/iris/services/iris-telegram/internal/store"
)

// Bot is the main Telegram bot struct.
type Bot struct {
	api      *tgbotapi.BotAPI
	sessions *SessionManager
	ai       *ai.Client
	iris     *irisClient.Client
	store    *store.Store
	stt      *stt.Client // nil when ElevenLabs key is not configured
	log      *slog.Logger
}

// New creates a Bot with all dependencies.
// sttClient may be nil — voice notes are then rejected with a friendly message.
func New(
	botToken string,
	sessions *SessionManager,
	aiClient *ai.Client,
	iris *irisClient.Client,
	store *store.Store,
	sttClient *stt.Client,
	log *slog.Logger,
) (*Bot, error) {
	api, err := tgbotapi.NewBotAPI(botToken)
	if err != nil {
		return nil, fmt.Errorf("bot: init telegram api: %w", err)
	}

	log.Info("telegram bot authorized", "username", api.Self.UserName)
	return &Bot{api: api, sessions: sessions, ai: aiClient, iris: iris, store: store, stt: sttClient, log: log}, nil
}

// Start begins polling for Telegram updates until ctx is cancelled.
func (b *Bot) Start(ctx context.Context) {
	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60

	updates := b.api.GetUpdatesChan(u)

	b.log.Info("bot polling started")
	for {
		select {
		case <-ctx.Done():
			b.api.StopReceivingUpdates()
			return
		case update, ok := <-updates:
			if !ok {
				return
			}
			go b.handleUpdate(ctx, update)
		}
	}
}

// Send sends a message to a chat, using Markdown parse mode.
func (b *Bot) Send(chatID int64, text string) {
	msg := tgbotapi.NewMessage(chatID, text)
	msg.ParseMode = tgbotapi.ModeMarkdown
	if _, err := b.api.Send(msg); err != nil {
		b.log.Error("send message failed", "chat_id", chatID, "err", err)
	}
}

// SendRaw sends a plain (no parse mode) message.
func (b *Bot) SendRaw(chatID int64, text string) {
	if _, err := b.api.Send(tgbotapi.NewMessage(chatID, text)); err != nil {
		b.log.Error("send raw message failed", "chat_id", chatID, "err", err)
	}
}

// handleUpdate routes an incoming update to the correct handler.
func (b *Bot) handleUpdate(ctx context.Context, update tgbotapi.Update) {
	if update.Message == nil {
		return
	}

	msg := update.Message
	userID := msg.From.ID
	chatID := msg.Chat.ID

	// ── Voice note → STT ──────────────────────────────────────────────────────
	if msg.Voice != nil {
		b.handleVoice(ctx, chatID, userID, msg.Voice)
		return
	}

	text := strings.TrimSpace(msg.Text)
	if text == "" {
		return
	}

	b.log.Debug("incoming message", "user_id", userID, "text", text[:min(len(text), 80)])

	if msg.IsCommand() {
		b.dispatchCommand(ctx, chatID, userID, msg.Command(), msg.CommandArguments())
	} else {
		b.dispatchMessage(ctx, chatID, userID, text)
	}
}

// handleVoice downloads the voice note OGG, transcribes it via ElevenLabs,
// and feeds the transcript into the normal message dispatch flow.
func (b *Bot) handleVoice(ctx context.Context, chatID, userID int64, voice *tgbotapi.Voice) {
	if b.stt == nil {
		b.Send(chatID, "🎤 Voice notes are not enabled. Ask your admin to set ELEVENLABS_API_KEY.")
		return
	}

	// Let the user know we're processing
	b.Send(chatID, "🎤 _Transcribing your voice note…_")

	// Get the file download URL from Telegram
	fileConfig := tgbotapi.FileConfig{FileID: voice.FileID}
	file, err := b.api.GetFile(fileConfig)
	if err != nil {
		b.log.Error("voice: get file info", "err", err)
		b.Send(chatID, "❌ Could not retrieve your voice note. Please try again.")
		return
	}

	downloadURL := file.Link(b.api.Token)
	audioBytes, err := downloadFile(ctx, downloadURL)
	if err != nil {
		b.log.Error("voice: download file", "err", err)
		b.Send(chatID, "❌ Could not download your voice note. Please try again.")
		return
	}

	// Transcribe — Telegram voice notes are always OGG/Opus
	transcript, err := b.stt.Transcribe(ctx, audioBytes, "voice.ogg")
	if err != nil {
		b.log.Error("voice: transcribe", "err", err)
		b.Send(chatID, "❌ Could not transcribe your voice note. Please type your message instead.")
		return
	}

	b.log.Info("voice: transcribed", "user_id", userID, "transcript", transcript[:min(len(transcript), 120)])

	// Echo what we heard so the user can verify
	b.Send(chatID, fmt.Sprintf("🎤 *Heard:* _%s_", transcript))

	// Feed the transcript into the normal message flow
	if strings.HasPrefix(strings.TrimSpace(transcript), "/") {
		// If the user dictated a command (unlikely but handle gracefully)
		b.Send(chatID, "ℹ️ Commands must be typed, not spoken. Please type /new, /list etc.")
		return
	}
	b.dispatchMessage(ctx, chatID, userID, transcript)
}

// downloadFile fetches a URL and returns its bytes. Used for Telegram file downloads.
func downloadFile(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("download: build request: %w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("download: http get: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download: status %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

// dispatchCommand routes bot commands.
func (b *Bot) dispatchCommand(ctx context.Context, chatID, userID int64, cmd, args string) {
	switch cmd {
	case "start":
		b.cmdStart(chatID)
	case "help":
		b.cmdHelp(chatID)
	case "login":
		b.cmdLogin(ctx, chatID, userID)
	case "logout":
		b.cmdLogout(ctx, chatID, userID)
	case "new":
		b.cmdNew(ctx, chatID, userID)
	case "list":
		b.cmdList(ctx, chatID, userID)
	case "trigger":
		b.cmdTrigger(ctx, chatID, userID, strings.TrimSpace(args))
	case "status":
		b.cmdStatus(ctx, chatID, userID, strings.TrimSpace(args))
	case "delete":
		b.cmdDelete(ctx, chatID, userID, strings.TrimSpace(args))
	case "templates":
		b.cmdTemplates(chatID)
	case "cancel":
		b.cmdCancel(chatID, userID)
	default:
		b.Send(chatID, "Unknown command. Use /help for a list of commands.")
	}
}

// dispatchMessage routes plain-text messages based on the user's current session state.
func (b *Bot) dispatchMessage(ctx context.Context, chatID, userID int64, text string) {
	sess := b.sessions.Get(userID)

	switch sess.State {
	case StateAwaitLogin:
		b.handleLogin(ctx, chatID, userID, text, sess)
	case StateDescribing, StateEditing:
		b.handleDescribe(ctx, chatID, userID, text, sess)
	case StateConfirming:
		b.handleConfirm(ctx, chatID, userID, text, sess)
	case StateAwaitDelete:
		b.handleDeleteConfirm(ctx, chatID, userID, text, sess)
	default:
		b.Send(chatID, "Use /new to create a relay, or /help to see all commands.")
	}
}

// ─── Command handlers ──────────────────────────────────────────────────────────

func (b *Bot) cmdStart(chatID int64) {
	b.Send(chatID, `✦ *Welcome to Iris!*

I help you create and manage automation workflows in plain English.

*Getting started:*
1. Link your Iris account with /login
2. Describe a workflow with /new
3. List your relays with /list

Use /help for all available commands.`)
}

func (b *Bot) cmdHelp(chatID int64) {
	b.Send(chatID, `*Iris Bot Commands*

/start — Welcome message
/login — Link your Iris account
/logout — Unlink your account
/new — Create a relay using AI
/list — List your relays
/trigger \<name or ID\> — Manually trigger a relay
/status \<name\> — Show recent executions
/delete \<name\> — Delete a relay
/templates — Quick-start template gallery
/cancel — Cancel current operation
/help — Show this message`)
}

func (b *Bot) cmdLogin(ctx context.Context, chatID, userID int64) {
	sess := b.sessions.Get(userID)
	sess.State = StateAwaitLogin
	b.sessions.Set(userID, sess)
	b.Send(chatID, `To link your account, paste your *Iris JWT token* below.

You can get it by logging in at the Iris web dashboard and copying it from settings.`)
}

func (b *Bot) cmdLogout(ctx context.Context, chatID, userID int64) {
	if err := b.store.UnlinkUser(ctx, userID); err != nil {
		b.log.Error("unlink user", "err", err)
	}
	b.sessions.Delete(userID)
	b.Send(chatID, "✅ You've been logged out. Use /login to reconnect.")
}

func (b *Bot) cmdNew(ctx context.Context, chatID, userID int64) {
	if !b.requireAuth(ctx, chatID, userID) {
		return
	}
	sess := b.sessions.Get(userID)
	sess.State = StateDescribing
	sess.DraftRelay = nil
	sess.Conversation = nil
	b.sessions.Set(userID, sess)
	b.Send(chatID, "✦ *New Relay*\n\nDescribe what you want to automate in plain English. I'll build the relay for you.")
}

func (b *Bot) cmdList(ctx context.Context, chatID, userID int64) {
	link, ok := b.getLink(ctx, chatID, userID)
	if !ok {
		return
	}

	relays, err := b.iris.ListRelays(ctx, link.Token)
	if err != nil {
		b.Send(chatID, "❌ Failed to fetch relays. Please try again.")
		return
	}

	if len(relays) == 0 {
		b.Send(chatID, "You have no relays yet. Use /new to create one!")
		return
	}

	var sb strings.Builder
	sb.WriteString("*Your Relays:*\n\n")
	for i, r := range relays {
		status := "🟢"
		if !r.IsActive {
			status = "🔴"
		}
		sb.WriteString(fmt.Sprintf("%d. %s *%s* — `%s`\n   ID: `%s`\n\n",
			i+1, status, r.Name, r.TriggerType, r.ID))
	}
	b.Send(chatID, sb.String())
}

func (b *Bot) cmdTrigger(ctx context.Context, chatID, userID int64, relayID string) {
	link, ok := b.getLink(ctx, chatID, userID)
	if !ok {
		return
	}
	if relayID == "" {
		b.Send(chatID, "Usage: /trigger <relay ID>")
		return
	}

	if err := b.iris.TriggerRelay(ctx, link.Token, relayID); err != nil {
		b.Send(chatID, "❌ Failed to trigger relay: "+err.Error())
		return
	}
	b.Send(chatID, fmt.Sprintf("✅ Relay `%s` triggered successfully!", relayID))
}

func (b *Bot) cmdStatus(ctx context.Context, chatID, userID int64, relayID string) {
	link, ok := b.getLink(ctx, chatID, userID)
	if !ok {
		return
	}
	if relayID == "" {
		b.Send(chatID, "Usage: /status <relay ID>")
		return
	}

	execs, err := b.iris.GetExecutions(ctx, link.Token, relayID)
	if err != nil {
		b.Send(chatID, "❌ Failed to get executions: "+err.Error())
		return
	}
	if len(execs) == 0 {
		b.Send(chatID, "No executions found for this relay yet.")
		return
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("*Last executions for* `%s`:\n\n", relayID))
	limit := 5
	if len(execs) < limit {
		limit = len(execs)
	}
	for _, e := range execs[:limit] {
		icon := "✅"
		if e.Status == "failed" {
			icon = "❌"
		} else if e.Status == "running" {
			icon = "🔄"
		}
		sb.WriteString(fmt.Sprintf("%s `%s` — %s\n   Started: %s\n\n",
			icon, e.ID[:8], e.Status, e.StartedAt))
	}
	b.Send(chatID, sb.String())
}

func (b *Bot) cmdDelete(ctx context.Context, chatID, userID int64, relayID string) {
	if !b.requireAuth(ctx, chatID, userID) {
		return
	}
	if relayID == "" {
		b.Send(chatID, "Usage: /delete <relay ID>")
		return
	}

	sess := b.sessions.Get(userID)
	sess.State = StateAwaitDelete
	sess.DraftRelayID = relayID
	b.sessions.Set(userID, sess)

	b.Send(chatID, fmt.Sprintf("⚠️ Are you sure you want to delete relay `%s`?\n\nReply *yes* to confirm or *no* to cancel.", relayID))
}

func (b *Bot) cmdTemplates(chatID int64) {
	b.Send(chatID, `*Quick-Start Templates*

Tap a template name to load it:

📋 *Webhook → Discord*
Reply: _"Create a relay that sends a Discord message when it receives a webhook"_

📋 *Cron → Email*
Reply: _"Create a relay that sends me a daily summary email at 9am"_

📋 *Webhook → Slack + Discord*
Reply: _"Create a relay that sends a Slack and Discord notification when triggered by a webhook"_

📋 *HTTP Fetch → Discord*
Reply: _"Create a relay triggered every hour that fetches a URL and sends the response to Discord"_

Just copy one of the italic descriptions above and send it as your next message after /new!`)
}

func (b *Bot) cmdCancel(chatID, userID int64) {
	sess := b.sessions.Get(userID)
	sess.State = StateIdle
	sess.DraftRelay = nil
	sess.Conversation = nil
	b.sessions.Set(userID, sess)
	b.Send(chatID, "✅ Operation cancelled. Use /help for available commands.")
}

// ─── Message state handlers ───────────────────────────────────────────────────

func (b *Bot) handleLogin(ctx context.Context, chatID, userID int64, token string, sess *Session) {
	// Validate the token against iris-core
	valid, err := b.iris.ValidateToken(ctx, token)
	if err != nil || !valid {
		b.Send(chatID, "❌ That token doesn't look right. Please paste a valid Iris JWT token.")
		return
	}

	// Get user info from token (we just store the raw token; iris-core validates it per-request)
	if err := b.store.LinkUser(ctx, userID, "unknown", token, ""); err != nil {
		b.log.Error("link user", "err", err)
		b.Send(chatID, "❌ Failed to save your account link. Please try again.")
		return
	}

	sess.State = StateIdle
	sess.Token = token
	b.sessions.Set(userID, sess)

	b.Send(chatID, "✅ *Account linked!*\n\nYou're all set. Use /new to create a relay or /list to see your existing ones.")
}

func (b *Bot) handleDescribe(ctx context.Context, chatID, userID int64, text string, sess *Session) {
	// Build conversation: system + history + new user message
	messages := []ai.Message{{Role: "system", Content: ai.BuildSystemPrompt()}}
	messages = append(messages, sess.Conversation...)
	messages = append(messages, ai.Message{Role: "user", Content: text})

	b.Send(chatID, "🤔 _Thinking..._")

	raw, err := b.ai.Chat(ctx, messages)
	if err != nil {
		b.log.Error("ai chat", "err", err)
		b.Send(chatID, "❌ AI request failed. Please try again.")
		return
	}

	resp, err := ai.ParseResponse(raw)
	if err != nil {
		b.log.Warn("parse ai response", "raw", raw[:min(len(raw), 200)], "err", err)
		b.Send(chatID, "❌ Couldn't understand the AI response. Please rephrase your request.")
		return
	}

	// Update conversation history
	sess.Conversation = append(sess.Conversation,
		ai.Message{Role: "user", Content: text},
		ai.Message{Role: "assistant", Content: raw},
	)

	if resp.Message != "" {
		b.Send(chatID, resp.Message)
	}

	if !resp.Ready {
		// Ask clarifying questions
		if len(resp.Questions) > 0 {
			var sb strings.Builder
			sb.WriteString("I have a few questions:\n\n")
			for i, q := range resp.Questions {
				sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, q))
			}
			b.Send(chatID, sb.String())
		}
		sess.State = StateDescribing
		b.sessions.Set(userID, sess)
		return
	}

	// Relay ready — show summary and ask for confirmation
	sess.DraftRelay = resp.Relay
	sess.State = StateConfirming
	b.sessions.Set(userID, sess)

	b.Send(chatID, formatRelayDraft(resp.Relay))
	b.Send(chatID, "Reply *confirm* to create, *edit* to modify, or *cancel* to discard.")
}

func (b *Bot) handleConfirm(ctx context.Context, chatID, userID int64, text string, sess *Session) {
	lower := strings.ToLower(strings.TrimSpace(text))

	switch {
	case lower == "yes" || lower == "confirm" || lower == "create" || lower == "ok":
		link, ok := b.getLink(ctx, chatID, userID)
		if !ok {
			return
		}

		relay, err := b.iris.CreateRelay(ctx, link.Token, *sess.DraftRelay)
		if err != nil {
			b.log.Error("create relay", "err", err)
			b.Send(chatID, "❌ Failed to create relay: "+err.Error())
			return
		}

		sess.State = StateIdle
		sess.DraftRelay = nil
		sess.Conversation = nil
		b.sessions.Set(userID, sess)
		_ = b.store.ClearAISession(ctx, userID)

		b.Send(chatID, fmt.Sprintf("✅ *Relay created!*\n\nName: *%s*\nID: `%s`\n\nUse /trigger %s to run it manually.",
			relay.Name, relay.ID, relay.ID))

	case lower == "edit" || lower == "change" || lower == "modify":
		sess.State = StateEditing
		b.sessions.Set(userID, sess)
		b.Send(chatID, "What would you like to change?")

	case lower == "cancel" || lower == "no" || lower == "discard":
		sess.State = StateIdle
		sess.DraftRelay = nil
		sess.Conversation = nil
		b.sessions.Set(userID, sess)
		b.Send(chatID, "❌ Relay discarded. Use /new to start again.")

	default:
		b.Send(chatID, "Please reply *confirm*, *edit*, or *cancel*.")
	}
}

func (b *Bot) handleDeleteConfirm(ctx context.Context, chatID, userID int64, text string, sess *Session) {
	lower := strings.ToLower(strings.TrimSpace(text))

	if lower == "yes" || lower == "confirm" {
		link, ok := b.getLink(ctx, chatID, userID)
		if !ok {
			return
		}
		if err := b.iris.DeleteRelay(ctx, link.Token, sess.DraftRelayID); err != nil {
			b.Send(chatID, "❌ Failed to delete relay: "+err.Error())
			return
		}
		sess.State = StateIdle
		sess.DraftRelayID = ""
		b.sessions.Set(userID, sess)
		b.Send(chatID, "✅ Relay deleted.")
	} else {
		sess.State = StateIdle
		sess.DraftRelayID = ""
		b.sessions.Set(userID, sess)
		b.Send(chatID, "Deletion cancelled.")
	}
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

func (b *Bot) requireAuth(ctx context.Context, chatID, userID int64) bool {
	_, ok := b.getLink(ctx, chatID, userID)
	return ok
}

func (b *Bot) getLink(ctx context.Context, chatID, userID int64) (*store.TelegramLink, bool) {
	link, err := b.store.GetLinkByTelegramID(ctx, userID)
	if err != nil {
		b.Send(chatID, "You're not linked yet. Use /login to connect your Iris account.")
		return nil, false
	}
	return link, true
}

// ─── Formatting ───────────────────────────────────────────────────────────────

func formatRelayDraft(relay *irisClient.CreateRelayRequest) string {
	if relay == nil {
		return ""
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("✦ *%s*\n_%s_\n\n", relay.Name, relay.Description))
	sb.WriteString(fmt.Sprintf("*Trigger:* %s\n\n", strings.Title(relay.TriggerType)))

	if len(relay.Actions) > 0 {
		sb.WriteString("*Actions:*\n")
		for i, a := range relay.Actions {
			sb.WriteString(fmt.Sprintf("  %d. `%s` — %s\n", i+1, a.NodeID, a.ActionType))
		}
		sb.WriteString("\n")
	}

	if len(relay.Edges) > 0 {
		sb.WriteString("*Flow:* ")
		// Build a simple linear display
		parts := make([]string, 0, len(relay.Edges)+1)
		if len(relay.Edges) > 0 {
			parts = append(parts, "`"+relay.Edges[0].ParentNodeID+"`")
			for _, e := range relay.Edges {
				parts = append(parts, "`"+e.ChildNodeID+"`")
			}
		}
		sb.WriteString(strings.Join(parts, " → "))
		sb.WriteString("\n\n")
	}

	// Warn about required secrets
	var secrets []string
	for _, a := range relay.Actions {
		for k, v := range a.Config {
			if strings.HasSuffix(k, "_ref") {
				if name, ok := v.(string); ok && name != "" {
					secrets = append(secrets, name)
				}
			}
		}
	}
	if len(secrets) > 0 {
		sb.WriteString("⚠️ *Secrets needed in Iris:*\n")
		for _, s := range secrets {
			sb.WriteString(fmt.Sprintf("  • `%s`\n", s))
		}
	}

	return sb.String()
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
