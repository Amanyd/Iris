package api

import (
	"fmt"
	"net/http"

	"github.com/eulerbutcooler/iris/services/core/internal/ai"
	"github.com/eulerbutcooler/iris/services/core/internal/models"
	"github.com/eulerbutcooler/iris/services/core/internal/store"
)

// GenerateRelay handles POST /api/v1/ai/relay.
//
// Flow:
//  1. Fetch secret names + all user relay names/IDs → inject into system prompt
//  2. If relay_id in request, load that relay and inject current config as context
//  3. Call LLM; validate; retry once on failure
//  4. Resolve edit target: prefer relay_id from AI response, fall back to request relay_id
//  5. Return AIRelayResponse with relay_id set when updating
func (h *Handler) GenerateRelay(w http.ResponseWriter, r *http.Request) {
	var req models.AIRelayRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}
	if req.Message == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "message is required")
		return
	}

	userID := GetUserID(r.Context())

	// ── Fetch secret names ────────────────────────────────────────────────────
	secrets, err := h.secrets.ListSecrets(r.Context(), userID)
	if err != nil {
		h.log.Warn("ai: list secrets failed", "user_id", userID, "err", err)
	}
	secretNames := make([]string, len(secrets))
	for i, s := range secrets {
		secretNames[i] = s.Name
	}

	// ── Fetch all user relays (names + IDs for AI reference) ─────────────────
	allRelays, err := h.relays.GetAllRelays(r.Context(), userID)
	if err != nil {
		h.log.Warn("ai: list relays failed", "user_id", userID, "err", err)
	}
	relayInfos := make([]ai.RelayInfo, len(allRelays))
	for i, rel := range allRelays {
		relayInfos[i] = ai.RelayInfo{ID: rel.ID, Name: rel.Name}
	}

	// ── Optionally load relay for explicit edit (relay_id in request) ─────────
	var editRelayID string
	var editContext string
	if req.RelayID != "" {
		relay, err := h.relays.GetRelay(r.Context(), req.RelayID, userID)
		if err != nil {
			if err == store.ErrRelayNotFound {
				writeError(w, http.StatusNotFound, "NOT_FOUND", "relay not found")
			} else {
				h.log.Error("ai: load relay for edit", "relay_id", req.RelayID, "err", err)
				writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to load relay")
			}
			return
		}
		editRelayID = req.RelayID
		snap := relayToSnapshot(relay)
		editContext = ai.BuildRelayEditContext(snap)
	}

	// ── Build conversation + call LLM ─────────────────────────────────────────
	messages := buildConversation(req, secretNames, relayInfos, editContext)

	raw, err := h.llm.Chat(r.Context(), messages)
	if err != nil {
		h.log.Error("ai: llm chat", "err", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "LLM request failed")
		return
	}

	parsed, err := ai.ParseResponse(raw)
	if err != nil {
		h.log.Warn("ai: parse failed", "raw", raw[:min(len(raw), 200)], "err", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to parse LLM response")
		return
	}

	// Validate; retry once on failure
	if parsed.Ready && parsed.Relay != nil {
		if validErr := h.validateRelaySpec(parsed.Relay); validErr != "" {
			messages = append(messages,
				models.AIMessage{Role: "assistant", Content: raw},
				models.AIMessage{Role: "user", Content: ai.CorrectivePrompt(validErr)},
			)
			raw2, err := h.llm.Chat(r.Context(), messages)
			if err != nil {
				h.log.Error("ai: retry llm chat", "err", err)
				writeJSON(w, http.StatusOK, toAIRelayResponse(parsed, editRelayID))
				return
			}
			if parsed2, err := ai.ParseResponse(raw2); err == nil && parsed2.Ready && parsed2.Relay != nil {
				if h.validateRelaySpec(parsed2.Relay) == "" {
					parsed = parsed2
				}
			}
		}
	}

	// ── Resolve the final edit target ─────────────────────────────────────────
	// Priority: AI returned relay_id > explicit relay_id in request
	resolvedRelayID := editRelayID
	if parsed.RelayID != "" {
		// AI resolved the target by name — verify it belongs to this user
		for _, rel := range allRelays {
			if rel.ID == parsed.RelayID {
				resolvedRelayID = parsed.RelayID
				break
			}
		}
	}

	writeJSON(w, http.StatusOK, toAIRelayResponse(parsed, resolvedRelayID))
}

// buildConversation builds the messages slice:
//
//	system prompt (with relay list) → optional edit context → history → user message
func buildConversation(req models.AIRelayRequest, secretNames []string, relayInfos []ai.RelayInfo, editContext string) []models.AIMessage {
	messages := []models.AIMessage{
		{Role: "system", Content: ai.BuildSystemPrompt(secretNames, relayInfos)},
	}
	if editContext != "" {
		messages = append(messages,
			models.AIMessage{Role: "user", Content: editContext},
			models.AIMessage{Role: "assistant", Content: `{"ready":false,"message":"Got it, I have the relay config loaded. What changes would you like to make?"}`},
		)
	}
	messages = append(messages, req.Conversation...)
	messages = append(messages, models.AIMessage{Role: "user", Content: req.Message})
	return messages
}

func relayToSnapshot(relay *models.RelayWithActions) *ai.RelaySnapshot {
	snap := &ai.RelaySnapshot{
		Name:          relay.Name,
		TriggerType:   relay.TriggerType,
		TriggerConfig: relay.TriggerConfig,
	}
	for _, a := range relay.Actions {
		snap.Actions = append(snap.Actions, ai.RelaySnapshotAction{
			NodeID:     a.NodeID,
			ActionType: a.ActionType,
			Config:     a.Config,
		})
	}
	for _, e := range relay.Edges {
		snap.Edges = append(snap.Edges, ai.RelaySnapshotEdge{
			ParentNodeID: e.ParentNodeID,
			ChildNodeID:  e.ChildNodeID,
			Condition:    e.Condition,
		})
	}
	return snap
}

func (h *Handler) validateRelaySpec(req *models.CreateRelayRequest) string {
	for _, a := range req.Actions {
		if err := validateActionConfig(a); err != nil {
			return err.Error()
		}
	}
	if err := validateDAG(req.Actions, req.Edges); err != nil {
		return fmt.Sprintf("invalid DAG: %s", err.Error())
	}
	return ""
}

func validateActionConfig(_ models.CreateRelayActionInput) error { return nil }

func toAIRelayResponse(p *ai.ParsedResponse, relayID string) models.AIRelayResponse {
	resp := models.AIRelayResponse{
		Ready:     p.Ready,
		Questions: p.Questions,
		Message:   p.Message,
		RelayID:   relayID,
	}
	if p.Ready {
		resp.Relay = p.Relay
	}
	return resp
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
