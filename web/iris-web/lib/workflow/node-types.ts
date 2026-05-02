// ─── Workflow Node Type Definitions ──────────────────────────────────────────
// Mirrors the backend actions registry (packages/actions/actions.go).
// Each entry describes a node the user can drag onto the canvas.

export type NodeCategory = "trigger" | "action" | "condition";

export interface ConfigField {
  name: string;
  label: string;
  type: "string" | "int" | "bool" | "map" | "secret_ref" | "select" | "condition_left";
  required: boolean;
  description: string;
  options?: string[]; // for "select" type
  placeholder?: string;
}

export interface NodeTypeDef {
  type: string;
  label: string;
  category: NodeCategory;
  description: string;
  icon: string; // emoji/lucide name for display
  defaultConfig: Record<string, unknown>;
  configFields: ConfigField[];
}

export const NODE_TYPES: NodeTypeDef[] = [
  // ── Triggers ──────────────────────────────────────────────────────────────
  {
    type: "trigger_webhook",
    label: "Webhook",
    category: "trigger",
    description: "Fires when an HTTP POST hits /hooks/{relay_id}",
    icon: "Zap",
    defaultConfig: {},
    configFields: [],
  },
  {
    type: "trigger_cron",
    label: "Cron Schedule",
    category: "trigger",
    description: "Fires on a recurring schedule (cron expression)",
    icon: "Clock",
    defaultConfig: { cron: "0 * * * *" },
    configFields: [
      {
        name: "cron",
        label: "Cron Expression",
        type: "string",
        required: true,
        description: "Standard 5-field cron (e.g. '0 9 * * 1-5' = 9am weekdays)",
        placeholder: "0 * * * *",
      },
    ],
  },
  {
    type: "trigger_manual",
    label: "Manual",
    category: "trigger",
    description: "Triggered manually via the dashboard or API",
    icon: "Play",
    defaultConfig: {},
    configFields: [],
  },

  // ── Actions ───────────────────────────────────────────────────────────────
  {
    type: "http_request",
    label: "HTTP Request",
    category: "action",
    description: "Makes an HTTP request to any URL",
    icon: "Globe",
    defaultConfig: { method: "GET", url: "", headers: {}, body: "" },
    configFields: [
      {
        name: "url",
        label: "URL",
        type: "string",
        required: true,
        description: "Target URL (template expressions supported)",
        placeholder: "https://api.example.com/endpoint",
      },
      {
        name: "method",
        label: "Method",
        type: "select",
        required: true,
        description: "HTTP method",
        options: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      },
      {
        name: "body",
        label: "Body",
        type: "string",
        required: false,
        description: "Request body (JSON or plain text)",
        placeholder: '{"key": "value"}',
      },
    ],
  },
  {
    type: "discord_send",
    label: "Discord",
    category: "action",
    description: "Sends a message to a Discord channel via webhook",
    icon: "MessageSquare",
    defaultConfig: { webhook_url_ref: "", message: "" },
    configFields: [
      {
        name: "webhook_url_ref",
        label: "Webhook Secret",
        type: "secret_ref",
        required: true,
        description: "Secret name holding the Discord webhook URL",
        placeholder: "DISCORD_WEBHOOK",
      },
      {
        name: "message",
        label: "Message",
        type: "string",
        required: true,
        description: "Message content (template expressions supported)",
        placeholder: "Hello from Iris!",
      },
    ],
  },
  {
    type: "slack_send",
    label: "Slack",
    category: "action",
    description: "Sends a message to a Slack channel via webhook",
    icon: "Hash",
    defaultConfig: { webhook_url_ref: "", message: "" },
    configFields: [
      {
        name: "webhook_url_ref",
        label: "Webhook Secret",
        type: "secret_ref",
        required: true,
        description: "Secret name holding the Slack webhook URL",
        placeholder: "SLACK_WEBHOOK",
      },
      {
        name: "message",
        label: "Message",
        type: "string",
        required: true,
        description: "Message content (template expressions supported)",
        placeholder: "Hello from Iris!",
      },
    ],
  },
  {
    type: "email_send",
    label: "Email",
    category: "action",
    description: "Sends an email via transactional email API",
    icon: "Mail",
    defaultConfig: { to: "", subject: "", body: "" },
    configFields: [
      {
        name: "to",
        label: "To",
        type: "string",
        required: true,
        description: "Recipient email address",
        placeholder: "user@example.com",
      },
      {
        name: "subject",
        label: "Subject",
        type: "string",
        required: true,
        description: "Email subject line",
        placeholder: "Notification from Iris",
      },
      {
        name: "body",
        label: "Body",
        type: "string",
        required: true,
        description: "Email body (plain text or HTML)",
        placeholder: "Your relay executed successfully.",
      },
    ],
  },
  {
    type: "debug_log",
    label: "Debug Log",
    category: "action",
    description: "Logs a message to the server console",
    icon: "Terminal",
    defaultConfig: { message: "" },
    configFields: [
      {
        name: "message",
        label: "Message",
        type: "string",
        required: true,
        description: "Message to log",
        placeholder: "Debug: relay executed",
      },
    ],
  },

  // ── Conditions ────────────────────────────────────────────────────────────
  {
    type: "condition",
    label: "Condition",
    category: "condition",
    description: "Evaluates a boolean expression to branch the flow",
    icon: "GitBranch",
    defaultConfig: { left_operand: "", operator: ">=", right_operand: "", expr: "" },
    configFields: [
      {
        name: "left_operand",
        label: "Value to Check",
        type: "condition_left",
        required: true,
        description: "Reference a value from a previous step, e.g. steps['fetch'].output.bitcoin.usd",
        placeholder: "steps['fetch'].output.bitcoin.usd",
      },
      {
        name: "operator",
        label: "Operator",
        type: "select",
        required: true,
        description: "",
        options: [">=", "<=", ">", "<", "==", "!=", "contains", "exists"],
      },
      {
        name: "right_operand",
        label: "Compare Against",
        type: "string",
        required: false,
        description: "The value to compare against (number or text). Leave blank when using \"exists\".",
        placeholder: "70000",
      },
    ],
  },
];

// Helpers
export const NODE_TYPES_BY_TYPE = Object.fromEntries(NODE_TYPES.map((n) => [n.type, n]));

export const TRIGGER_TYPES = NODE_TYPES.filter((n) => n.category === "trigger");
export const ACTION_TYPES = NODE_TYPES.filter((n) => n.category === "action");
export const CONDITION_TYPES = NODE_TYPES.filter((n) => n.category === "condition");

// Maps a canvas node type to the backend action_type string.
// Trigger nodes are stored as relay trigger_type, not as actions.
export function canvasTypeToActionType(canvasType: string): string {
  // Triggers are not actions — handled separately
  return canvasType.replace("trigger_", "");
}

export function getTriggerTypeFromNodes(nodes: { type?: string; data: { nodeType: string } }[]): string {
  const trigger = nodes.find((n) => n.data.nodeType?.startsWith("trigger_"));
  if (!trigger) return "manual";
  const t = trigger.data.nodeType.replace("trigger_", "");
  return t; // "webhook" | "cron" | "manual"
}
