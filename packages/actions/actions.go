package actions

import "fmt"

// FieldType enumerates the supported config field types.
type FieldType string

const (
	FieldTypeString    FieldType = "string"
	FieldTypeInt       FieldType = "int"
	FieldTypeBool      FieldType = "bool"
	FieldTypeMap       FieldType = "map"
	FieldTypeSecretRef FieldType = "secret_ref" // value is a secret name, not the secret itself
)

// FieldSpec describes one field within an action's configuration.
type FieldSpec struct {
	Name        string
	Type        FieldType
	Required    bool
	Description string
}

// ActionConfig is the metadata + validation spec for one action type.
type ActionConfig struct {
	Type        string
	Description string
	Fields      []FieldSpec
}

// registry holds all registered action types.
var registry = map[string]ActionConfig{}

func init() {
	register(ActionConfig{
		Type:        "debug_log",
		Description: "Logs a message to stdout. Useful for testing relay flows.",
		Fields: []FieldSpec{
			{Name: "message", Type: FieldTypeString, Required: true, Description: "Message to log"},
		},
	})

	register(ActionConfig{
		Type:        "discord_send",
		Description: "Sends a message to a Discord channel via an incoming webhook.",
		Fields: []FieldSpec{
			{Name: "webhook_url_ref", Type: FieldTypeSecretRef, Required: true, Description: "Secret name holding the Discord webhook URL"},
			{Name: "message", Type: FieldTypeString, Required: true, Description: "Message content to send"},
		},
	})

	register(ActionConfig{
		Type:        "slack_send",
		Description: "Sends a message to a Slack channel via an incoming webhook.",
		Fields: []FieldSpec{
			{Name: "webhook_url_ref", Type: FieldTypeSecretRef, Required: true, Description: "Secret name holding the Slack webhook URL"},
			{Name: "message", Type: FieldTypeString, Required: true, Description: "Message content to send"},
		},
	})

	register(ActionConfig{
		Type:        "http_request",
		Description: "Makes an HTTP request to any URL. Supports custom headers and body.",
		Fields: []FieldSpec{
			{Name: "url", Type: FieldTypeString, Required: true, Description: "Target URL"},
			{Name: "method", Type: FieldTypeString, Required: true, Description: "HTTP method: GET | POST | PUT | PATCH | DELETE"},
			{Name: "headers", Type: FieldTypeMap, Required: false, Description: "Key-value pairs added as request headers"},
			{Name: "body", Type: FieldTypeString, Required: false, Description: "Raw request body (template expressions supported)"},
		},
	})

	register(ActionConfig{
		Type:        "email_send",
		Description: "Sends an email via SMTP or a transactional email API (API key stored as a secret).",
		Fields: []FieldSpec{
			{Name: "to", Type: FieldTypeString, Required: true, Description: "Recipient email address"},
			{Name: "subject", Type: FieldTypeString, Required: true, Description: "Email subject line"},
			{Name: "body", Type: FieldTypeString, Required: true, Description: "Email body (plain text or HTML)"},
		},
	})

	register(ActionConfig{
		Type:        "condition",
		Description: "Evaluates a boolean expression against step outputs. Use this to branch the DAG based on data values.",
		Fields: []FieldSpec{
			{Name: "expr", Type: FieldTypeString, Required: true, Description: `Boolean expression. Supported operators: == != > >= < <= contains exists. ` +
				`Values can be literals or step references (steps['node_id'].output.field). ` +
				`Examples: "steps['fetch'].output.bitcoin.usd >= 70000", ` +
				`"steps['get'].output.status == 200", ` +
				`"steps['fetch'].output.body contains error", ` +
				`"exists steps['fetch'].output.data"`,
			},
		},
	})
}

func register(ac ActionConfig) {
	registry[ac.Type] = ac
}

// Types returns all registered action type names.
func Types() []string {
	out := make([]string, 0, len(registry))
	for k := range registry {
		out = append(out, k)
	}
	return out
}

// Get returns the ActionConfig for a given type, or false if not found.
func Get(actionType string) (ActionConfig, bool) {
	ac, ok := registry[actionType]
	return ac, ok
}

// ValidateConfig checks that config satisfies the required fields of actionType.
// Returns a descriptive error listing all violations.
func ValidateConfig(actionType string, config map[string]any) error {
	ac, ok := registry[actionType]
	if !ok {
		return fmt.Errorf("actions: unknown action type %q", actionType)
	}

	var errs []string
	for _, f := range ac.Fields {
		if !f.Required {
			continue
		}
		val, present := config[f.Name]
		if !present || val == nil {
			errs = append(errs, fmt.Sprintf("field %q is required", f.Name))
			continue
		}
		if s, ok := val.(string); ok && s == "" {
			errs = append(errs, fmt.Sprintf("field %q must not be empty", f.Name))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("actions: invalid config for %q: %v", actionType, errs)
	}
	return nil
}
