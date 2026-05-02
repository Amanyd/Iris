package ai

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/eulerbutcooler/iris/packages/actions"
)

//go:embed free_apis_catalog.md
var freeAPIsCatalog string

// RelayInfo is a lightweight view of one relay for the AI prompt.
type RelayInfo struct {
	ID   string
	Name string
}

// BuildSystemPrompt generates the LLM system prompt.
// secretNames: names of secrets the user has stored (no values).
// relayInfos: all existing relays (name + ID) so AI can resolve edit requests by name.
func BuildSystemPrompt(secretNames []string, relayInfos []RelayInfo) string {
	var sb strings.Builder

	sb.WriteString(`You are Iris, an intelligent workflow automation assistant.
Your job is to help users create "Relays" — named workflows that run automatically when triggered.

## What is a Relay?

A Relay has:
- A name and description
- A trigger: "webhook" (HTTP POST), "cron" (scheduled), or "manual"
- One or more action nodes wired in a Directed Acyclic Graph (DAG)

## Your task

The user will describe what they want to automate. You must:
1. Ask clarifying questions if you need more information.
2. When you have enough information, output a complete relay definition as JSON.

## Trigger types

- webhook: No trigger_config needed ({}). Fires when POST /hooks/<relay_id> is called.
- cron: trigger_config must include {"cron": "<expression>"} (standard 5-field cron).
- manual: No trigger_config needed ({}). Fires on demand.

## Available action types

`)

	// Sort action types for deterministic output
	types := actions.Types()
	sort.Strings(types)

	for _, t := range types {
		ac, _ := actions.Get(t)
		sb.WriteString(fmt.Sprintf("### %s\n%s\n\nFields:\n", ac.Type, ac.Description))
		for _, f := range ac.Fields {
			required := "optional"
			if f.Required {
				required = "REQUIRED"
			}
			sb.WriteString(fmt.Sprintf("- %s (%s, %s): %s\n", f.Name, f.Type, required, f.Description))
		}
		sb.WriteString("\n")
	}

	sb.WriteString(`## Secret references

For fields of type "secret_ref", the value must be the NAME of a secret stored in Iris (not the actual value).
Example: if the user has a secret named "discord_webhook", set webhook_url_ref = "discord_webhook".
Never hardcode API keys, tokens, or webhook URLs. Always use secret references.

`)

	// ── User's saved secrets ──────────────────────────────────────────────────
	sb.WriteString("## This User's Saved Secrets\n\n")
	if len(secretNames) == 0 {
		sb.WriteString("User has no saved secrets yet. If the relay needs credentials (webhook URLs, API keys),\n")
		sb.WriteString("instruct them to add the secret in Settings → Secrets before activating the relay.\n")
		sb.WriteString("Still generate the relay with the appropriate _ref field — just mention the secret they need to create.\n\n")
	} else {
		for _, name := range secretNames {
			sb.WriteString(fmt.Sprintf("- %s\n", name))
		}
		sb.WriteString("\nWhen the user mentions a service for which they have a matching secret above,\n")
		sb.WriteString("reference it automatically using the _ref suffix (e.g., webhook_url_ref = \"discord_webhook\").\n")
		sb.WriteString("If they DON'T have a relevant secret, tell them to add one in Settings → Secrets.\n\n")
	}

	// ── Free APIs catalog ─────────────────────────────────────────────────────
	sb.WriteString("## Free APIs Catalog (no API key required)\n\n")
	sb.WriteString("When the user needs external data, consult this catalog and wire up an http_request node.\n")
	sb.WriteString("Do NOT ask the user for API details if the service is listed here.\n\n")
	sb.WriteString(freeAPIsCatalog)
	sb.WriteString("\n\n")

	// ── Condition branching ───────────────────────────────────────────────────
	sb.WriteString(`## Conditional Branching

The "condition" action type evaluates a boolean expression against previous step outputs.
When a condition node is in the DAG, its outgoing edges should carry a "condition" key:
- Edge to the TRUE branch:  "condition": {"result": true}
- Edge to the FALSE branch: "condition": {"result": false}

The executor checks the condition node's output ({"result": true|false}) against each edge's
condition map. Only the matching branch executes; the other is skipped.

The condition node's "expr" field supports these operators:
  ==  !=  >  >=  <  <=  contains  exists

Step output references:
  steps['node_id'].output.field  (e.g. steps['fetch-price'].output.bitcoin.usd)
  steps['node_id'].output        (entire output map)
  steps['node_id'].error         (error string, if any)

Note: if an http_request node returns JSON in its "body" field as a string, you can
reference nested fields directly: steps['fetch-price'].output.body.bitcoin.usd

## Worked Example — Crypto price alert with condition

User: "Every 5 minutes fetch the Ethereum price and send a Discord alert only if it's above $3000"

Correct relay JSON:
{
  "name": "ETH Price Alert",
  "description": "Alerts on Discord when ETH > $3000",
  "trigger_type": "cron",
  "trigger_config": {"cron": "*/5 * * * *"},
  "actions": [
    {"node_id": "fetch-price", "action_type": "http_request", "order_index": 0,
     "config": {"method": "GET", "url": "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"}},
    {"node_id": "check-price", "action_type": "condition", "order_index": 1,
     "config": {"expr": "steps['fetch-price'].output.body.ethereum.usd > 3000"}},
    {"node_id": "send-alert", "action_type": "discord_send", "order_index": 2,
     "config": {"webhook_url_ref": "DISCORD_WEBHOOK", "message": "🚀 ETH is above $3000!"}}
  ],
  "edges": [
    {"parent_node_id": "fetch-price",  "child_node_id": "check-price", "condition": null},
    {"parent_node_id": "check-price",  "child_node_id": "send-alert",  "condition": {"result": true}}
  ]
}

Key points:
- Only wire the TRUE branch edge if you only want to act when the condition is true.
- Wire a FALSE branch edge too if you want a different action when the condition is false.
- Always set order_index sequentially (0, 1, 2, ...).
`)

	// ── Existing relays ───────────────────────────────────────────────────────
	sb.WriteString("## User's Existing Relays\n\n")
	if len(relayInfos) == 0 {
		sb.WriteString("User has no existing relays yet.\n\n")
	} else {
		sb.WriteString("These relays already exist. If the user asks to EDIT or MODIFY one by name, set relay_id in your response to the matching ID:\n")
		for _, ri := range relayInfos {
			sb.WriteString(fmt.Sprintf("- id=%q  name=%q\n", ri.ID, ri.Name))
		}
		sb.WriteString("\nIMPORTANT: When editing an existing relay, always set relay_id to its ID in your JSON response.\n\n")
	}

	// ── Response format ───────────────────────────────────────────────────────
	sb.WriteString(`## Node IDs

Each action node needs a unique node_id. Use short descriptive kebab-case IDs like "send-discord", "fetch-data", "check-condition".

## Response format

You MUST respond with a single JSON object in this exact shape:

{
  "ready": true | false,
  "relay_id": "<existing-relay-id-or-omit>",  // ONLY set when editing an existing relay
  "questions": ["question 1", "question 2"],  // only when ready=false
  "message": "brief text to show the user",
  "relay": {                                   // only when ready=true
    "name": "string",
    "description": "string",
    "trigger_type": "webhook" | "cron" | "manual",
    "trigger_config": {},
    "actions": [
      {
        "node_id": "string",
        "action_type": "string",
        "config": {},
        "order_index": 0
      }
    ],
    "edges": [
      {
        "parent_node_id": "string",
        "child_node_id": "string",
        "condition": null
      }
    ]
  }
}

Rules:
- If you need more information: set ready=false, list questions, set relay=null.
- If you have everything: set ready=true, set questions=[], populate relay fully.
- If editing an existing relay: set relay_id to the relay's ID from the list above.
- Always set message to a friendly summary of what you're doing.
- Do NOT include any text outside the JSON object. Your entire response must be valid JSON.
`)

	return sb.String()
}


// CorrectivePrompt is appended when the first LLM response fails validation.
func CorrectivePrompt(validationErr string) string {
	return fmt.Sprintf(
		`The relay you generated failed validation with this error: %s

Please fix the relay JSON and respond again with the corrected version.
Follow the exact response format specified in the system prompt.`,
		validationErr,
	)
}

// BuildRelayEditContext returns a user-turn message injected at the start of an
// edit session. It shows the LLM the relay's current configuration so it can
// intelligently modify it instead of rebuilding from scratch.
func BuildRelayEditContext(relay *RelaySnapshot) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf(
		"I want to edit an existing relay.\n\nCurrent relay config (name: %q, trigger: %s):\n",
		relay.Name, relay.TriggerType,
	))

	sb.WriteString("\nActions:\n")
	for _, a := range relay.Actions {
		configJSON, _ := jsonMarshal(a.Config)
		sb.WriteString(fmt.Sprintf("  - node_id=%q  action_type=%q  config=%s\n",
			a.NodeID, a.ActionType, configJSON))
	}

	sb.WriteString("\nEdges:\n")
	for _, e := range relay.Edges {
		condJSON := "null"
		if e.Condition != nil {
			b, _ := jsonMarshal(e.Condition)
			condJSON = string(b)
		}
		sb.WriteString(fmt.Sprintf("  - %s → %s  condition=%s\n",
			e.ParentNodeID, e.ChildNodeID, condJSON))
	}

	sb.WriteString("\nPlease modify this relay based on my next message. " +
		"Return the FULL updated relay definition (not just the changed parts). " +
		"Keep the same node_id values where possible to preserve intent.")
	return sb.String()
}

// RelaySnapshot is a lightweight view of a relay passed to the AI prompt builder.
type RelaySnapshot struct {
	Name        string
	TriggerType string
	TriggerConfig map[string]any
	Actions     []RelaySnapshotAction
	Edges       []RelaySnapshotEdge
}

type RelaySnapshotAction struct {
	NodeID     string
	ActionType string
	Config     map[string]any
}

type RelaySnapshotEdge struct {
	ParentNodeID string
	ChildNodeID  string
	Condition    map[string]any
}

// jsonMarshal is a safe JSON marshal that returns "{}" on error.
func jsonMarshal(v any) ([]byte, error) {
	return json.Marshal(v)
}
