package models

import "time"

// ─── Auth ────────────────────────────────────────────────────────────────────

// RegisterRequest is the body for POST /api/v1/auth/register.
type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginRequest is the body for POST /api/v1/auth/login.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// User is the public representation of a user (no password hash).
type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
}

// AuthResponse is returned by Register and Login.
type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

// ─── Relay ───────────────────────────────────────────────────────────────────

// Relay is the top-level relay record (no actions/edges).
type Relay struct {
	ID            string         `json:"id"`
	UserID        string         `json:"user_id"`
	Name          string         `json:"name"`
	Description   string         `json:"description"`
	IsActive      bool           `json:"is_active"`
	TriggerType   string         `json:"trigger_type"`
	TriggerConfig map[string]any `json:"trigger_config,omitempty"`
	NextRunAt     *time.Time     `json:"next_run_at,omitempty"`
	LastRunAt     *time.Time     `json:"last_run_at,omitempty"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
}

// RelayAction is a single action node in the relay's DAG.
type RelayAction struct {
	ID          string         `json:"id"`
	RelayID     string         `json:"relay_id"`
	NodeID      string         `json:"node_id"`
	ActionType  string         `json:"action_type"`
	Config      map[string]any `json:"config"`
	OrderIndex  int            `json:"order_index"`
}

// RelayEdge is a directed connection between two action nodes.
type RelayEdge struct {
	ID            string         `json:"id"`
	RelayID       string         `json:"relay_id"`
	ParentNodeID  string         `json:"parent_node_id"`
	ChildNodeID   string         `json:"child_node_id"`
	Condition     map[string]any `json:"condition,omitempty"`
}

// RelayWithActions bundles a relay with its full DAG (actions + edges).
type RelayWithActions struct {
	Relay
	Actions []RelayAction `json:"actions"`
	Edges   []RelayEdge   `json:"edges"`
}

// ─── Relay Requests ──────────────────────────────────────────────────────────

// CreateRelayActionInput is one action node within a CreateRelayRequest.
type CreateRelayActionInput struct {
	NodeID     string         `json:"node_id"`
	ActionType string         `json:"action_type"`
	Config     map[string]any `json:"config"`
	OrderIndex int            `json:"order_index"`
}

// CreateRelayEdgeInput is one edge within a CreateRelayRequest.
type CreateRelayEdgeInput struct {
	ParentNodeID string         `json:"parent_node_id"`
	ChildNodeID  string         `json:"child_node_id"`
	Condition    map[string]any `json:"condition,omitempty"`
}

// CreateRelayRequest is the body for POST /api/v1/relays.
type CreateRelayRequest struct {
	Name          string                   `json:"name"`
	Description   string                   `json:"description"`
	TriggerType   string                   `json:"trigger_type"`
	TriggerConfig map[string]any           `json:"trigger_config,omitempty"`
	Actions       []CreateRelayActionInput `json:"actions"`
	Edges         []CreateRelayEdgeInput   `json:"edges"`
}

// UpdateRelayRequest is the body for PUT /api/v1/relays/{id}.
// Only top-level relay fields (name, description, active, trigger).
type UpdateRelayRequest struct {
	Name          string         `json:"name"`
	Description   string         `json:"description"`
	IsActive      *bool          `json:"is_active,omitempty"`
	TriggerType   string         `json:"trigger_type,omitempty"`
	TriggerConfig map[string]any `json:"trigger_config,omitempty"`
}

// UpdateRelayActionsRequest is the body for PUT /api/v1/relays/{id}/actions.
// Replaces all actions and edges atomically.
type UpdateRelayActionsRequest struct {
	Actions []CreateRelayActionInput `json:"actions"`
	Edges   []CreateRelayEdgeInput   `json:"edges"`
}

// ─── Secrets ─────────────────────────────────────────────────────────────────

// Secret is the public representation of a secret (value is always omitted).
type Secret struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CreateSecretRequest is the body for POST /api/v1/secrets.
type CreateSecretRequest struct {
	Name  string `json:"name"`
	Value string `json:"value"` // plaintext — handler encrypts before store write
}

// ─── Executions ──────────────────────────────────────────────────────────────

// Execution is a single relay run record.
type Execution struct {
	ID             string         `json:"id"`
	RelayID        string         `json:"relay_id"`
	EventID        string         `json:"event_id,omitempty"`
	Status         string         `json:"status"`
	TriggerPayload map[string]any `json:"trigger_payload,omitempty"`
	ErrorMessage   string         `json:"error_message,omitempty"`
	StartedAt      time.Time      `json:"started_at"`
	FinishedAt     *time.Time     `json:"finished_at,omitempty"`
}

// ExecutionStep is a per-node audit record within an execution.
type ExecutionStep struct {
	ID           string         `json:"id"`
	ExecutionID  string         `json:"execution_id"`
	NodeID       string         `json:"node_id,omitempty"`
	ActionType   string         `json:"action_type"`
	Status       string         `json:"status"`
	Input        map[string]any `json:"input,omitempty"`
	Output       map[string]any `json:"output,omitempty"`
	ErrorMessage string         `json:"error_message,omitempty"`
	StartedAt    time.Time      `json:"started_at"`
	FinishedAt   *time.Time     `json:"finished_at,omitempty"`
}

// ─── AI Relay Generation ─────────────────────────────────────────────────────

// AIMessage is one turn in an LLM conversation.
type AIMessage struct {
	Role    string `json:"role"`    // "user" | "assistant" | "system"
	Content string `json:"content"`
}

// AIRelayRequest is the body for POST /api/v1/ai/relay.
type AIRelayRequest struct {
	Message      string      `json:"message"`
	Conversation []AIMessage `json:"conversation"`
	RelayID      string      `json:"relay_id,omitempty"` // optional: if set, AI is editing this relay
}

// AIRelayResponse is the response from the LLM relay generation endpoint.
type AIRelayResponse struct {
	Ready     bool                `json:"ready"`
	Questions []string            `json:"questions,omitempty"`
	Relay     *CreateRelayRequest `json:"relay,omitempty"`
	Message   string              `json:"message,omitempty"`
	RelayID   string              `json:"relay_id,omitempty"` // if set, means update this relay (not create)
}

// ─── Errors ───────────────────────────────────────────────────────────────────

// ErrorResponse is the standard JSON error envelope.
// Code is machine-readable: VALIDATION_ERROR, CYCLE_DETECTED, UNAUTHORIZED,
// NOT_FOUND, INTERNAL_ERROR, DUPLICATE_SECRET.
type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}
