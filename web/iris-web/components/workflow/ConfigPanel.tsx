"use client";

import { X, Trash2, FlaskConical, Copy, CheckCircle, Loader2, ChevronRight, ChevronDown, Webhook } from "lucide-react";

import type { Node } from "@xyflow/react";
import { NODE_TYPES_BY_TYPE } from "@/lib/workflow/node-types";
import type { IrisNodeData } from "@/lib/workflow/converters";
import type { Secret } from "@/lib/api";
import { useState, useCallback, useRef } from "react";


// ─── HTTP Tester ──────────────────────────────────────────────────────────────

interface TestResult {
  status: number;
  ok: boolean;
  body: string;
  isJson: boolean;
  parsed: unknown;
  durationMs: number;
}

function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return [];
  return Object.keys(obj as Record<string, unknown>).flatMap((k) => {
    const full = prefix ? `${prefix}.${k}` : k;
    const child = (obj as Record<string, unknown>)[k];
    const nested = flattenKeys(child, full);
    return nested.length > 0 ? nested : [full];
  });
}

interface ConfigPanelProps {
  node: Node<IrisNodeData>;
  secrets: Secret[];
  upstreamNodes: Node<IrisNodeData>[];
  nodeTestPaths: Map<string, string[]>;
  onTestComplete: (nodeId: string, paths: string[]) => void;
  onUpdate: (nodeId: string, config: Record<string, unknown>) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

function HttpTester({
  nodeId,
  config,
  onDiscoverPaths,
}: {
  nodeId: string;
  config: Record<string, unknown>;
  onDiscoverPaths: (paths: string[]) => void;

}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const url = (config.url as string) ?? "";
  const method = (config.method as string) ?? "GET";
  const body = (config.body as string) ?? "";

  const run = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const t0 = Date.now();
    try {
      const res = await fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, method, body: method !== "GET" && method !== "HEAD" ? body : undefined }),
      });
      const data = await res.json();
      if (!res.ok && data.error) throw new Error(data.error);
      const { status, ok, body: rawBody, isJson, parsed, durationMs: dur } = data;
      const testResult = { status, ok, body: rawBody, isJson, parsed, durationMs: dur ?? Date.now() - t0 };
      setResult(testResult);
      // Propagate discovered JSON paths upward so other nodes can use them
      if (isJson && parsed) {
        onDiscoverPaths(flattenKeys(parsed));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [url, method, body, onDiscoverPaths]);

  function copy(text: string) {
    navigator.clipboard?.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  }

  const bodyExpr = `{{steps['${nodeId}'].output.body}}`;
  const statusExpr = `{{steps['${nodeId}'].output.status}}`;

  return (
    <div className="border border-iris-accent/30 bg-iris-accent/5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-black uppercase tracking-widest text-iris-accent hover:bg-iris-accent/10 transition-colors"
      >
        <span className="flex items-center gap-1.5"><FlaskConical className="w-3 h-3" /> Test Request</span>
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {!url && (
            <div className="text-[10px] text-iris-warning">Set a URL above first.</div>
          )}

          <button
            onClick={run}
            disabled={loading || !url}
            className="w-full flex items-center justify-center gap-2 py-2 bg-iris-accent text-black text-xs font-black uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-40"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {loading ? "Sending…" : `${method} ${url ? (() => { try { return new URL(url).hostname; } catch { return url; } })() : "…"}`}
          </button>

          {error && (
            <div className="bg-iris-error/10 border border-iris-error/30 p-2 text-[10px] font-mono text-iris-error">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-2">
              {/* Status */}
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-black px-2 py-0.5 border ${
                  result.ok
                    ? "text-iris-success bg-iris-success/10 border-iris-success/30"
                    : "text-iris-error bg-iris-error/10 border-iris-error/30"
                }`}>
                  {result.status}
                </span>
                <span className="text-[10px] text-iris-secondary font-mono">{result.durationMs}ms</span>
              </div>

              {/* Quick copy refs */}
              <div className="space-y-1">
                <div className="text-[9px] font-black uppercase tracking-widest text-iris-secondary">Template References</div>
                {[
                  { expr: statusExpr, label: "Status code" },
                  { expr: bodyExpr, label: "Full body" },
                  ...(result.isJson
                    ? flattenKeys(result.parsed).slice(0, 8).map((k) => ({
                        expr: `{{steps['${nodeId}'].output.body.${k}}}`,
                        label: `body.${k}`,
                      }))
                    : []),
                ].map(({ expr, label }) => (
                  <button
                    key={expr}
                    onClick={() => copy(expr)}
                    title="Click to copy"
                    className="w-full flex items-center gap-2 group"
                  >
                    <code className="flex-1 text-left text-[9px] font-mono text-iris-accent bg-iris-surface px-2 py-1 border border-iris-border-strong group-hover:border-iris-accent transition-colors truncate">
                      {expr}
                    </code>
                    {copied === expr
                      ? <CheckCircle className="w-3 h-3 text-iris-success shrink-0" />
                      : <Copy className="w-3 h-3 text-iris-border-strong group-hover:text-iris-accent shrink-0" />}
                  </button>
                ))}
              </div>

              {/* Raw body */}
              <div>
                <div className="text-[9px] font-black uppercase tracking-widest text-iris-secondary mb-1">Response Body</div>
                <pre className="text-[9px] font-mono text-iris-secondary bg-iris-surface border border-iris-border-strong p-2 overflow-auto max-h-40 whitespace-pre-wrap break-all">
                  {result.isJson ? JSON.stringify(result.parsed, null, 2) : result.body}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ─── Upstream insert dropdown ─────────────────────────────────────────────────

// Template expressions available from each upstream action node type
const OUTPUT_FIELDS: Record<string, { key: string; label: string }[]> = {
  http_request: [
    { key: "output.status", label: "HTTP status code" },
    { key: "output.body",   label: "Response body (full)" },
  ],
  discord_send: [{ key: "output.ok", label: "Success boolean" }],
  slack_send:   [{ key: "output.ok", label: "Success boolean" }],
  email_send:   [{ key: "output.ok", label: "Success boolean" }],
  debug_log:    [{ key: "output.message", label: "Echoed message" }],
  condition:    [{ key: "output.result", label: "Boolean result" }],
  // Webhook trigger — payload is passed directly, not via steps[...].output
  trigger_webhook: [
    { key: "payload",        label: "Full payload (raw)" },
    { key: "payload.action", label: "Event action type" },
  ],
};

// ─── Webhook payload templates for common services ────────────────────────────

interface ServiceTemplate {
  service: string;
  icon: string;
  color: string;
  fields: { key: string; label: string; desc: string; group?: string }[];
}

const WEBHOOK_PAYLOAD_TEMPLATES: ServiceTemplate[] = [
  {
    service: "GitHub",
    icon: "🐙",
    color: "#8B5CF6",
    fields: [
      // Common
      { group: "Common",         key: "payload.action",                  label: "action",                   desc: "Event action: opened, closed, labeled, reopened…" },
      { group: "Common",         key: "payload.repository.full_name",     label: "repository.full_name",     desc: "owner/repo (e.g. octocat/hello-world)" },
      { group: "Common",         key: "payload.repository.html_url",      label: "repository.html_url",      desc: "Repo URL" },
      { group: "Common",         key: "payload.sender.login",             label: "sender.login",             desc: "Username of the actor" },
      { group: "Common",         key: "payload.sender.avatar_url",        label: "sender.avatar_url",        desc: "Actor's avatar image URL" },
      // Issues
      { group: "Issues",         key: "payload.issue.number",             label: "issue.number",             desc: "Issue number" },
      { group: "Issues",         key: "payload.issue.title",              label: "issue.title",              desc: "Issue title" },
      { group: "Issues",         key: "payload.issue.body",               label: "issue.body",               desc: "Issue description body" },
      { group: "Issues",         key: "payload.issue.state",              label: "issue.state",              desc: "open or closed" },
      { group: "Issues",         key: "payload.issue.html_url",           label: "issue.html_url",           desc: "Link to the issue" },
      { group: "Issues",         key: "payload.issue.user.login",         label: "issue.user.login",         desc: "Issue author username" },
      { group: "Issues",         key: "payload.issue.labels",             label: "issue.labels",             desc: "Array of label objects" },
      { group: "Issues",         key: "payload.issue.assignees",          label: "issue.assignees",          desc: "Array of assigned users" },
      { group: "Issues",         key: "payload.label.name",               label: "label.name",               desc: "Label name (labeled / unlabeled events)" },
      { group: "Issues",         key: "payload.label.color",              label: "label.color",              desc: "Label hex color (labeled events)" },
      // Pull Requests
      { group: "Pull Requests",  key: "payload.pull_request.number",      label: "pull_request.number",      desc: "PR number" },
      { group: "Pull Requests",  key: "payload.pull_request.title",       label: "pull_request.title",       desc: "PR title" },
      { group: "Pull Requests",  key: "payload.pull_request.body",        label: "pull_request.body",        desc: "PR description" },
      { group: "Pull Requests",  key: "payload.pull_request.state",       label: "pull_request.state",       desc: "open or closed" },
      { group: "Pull Requests",  key: "payload.pull_request.html_url",    label: "pull_request.html_url",    desc: "PR link" },
      { group: "Pull Requests",  key: "payload.pull_request.merged",      label: "pull_request.merged",      desc: "true if the PR was merged" },
      { group: "Pull Requests",  key: "payload.pull_request.user.login",  label: "pull_request.user.login",  desc: "PR author username" },
      { group: "Pull Requests",  key: "payload.pull_request.head.ref",    label: "pull_request.head.ref",    desc: "Source branch name" },
      { group: "Pull Requests",  key: "payload.pull_request.base.ref",    label: "pull_request.base.ref",    desc: "Target branch name" },
      // Push
      { group: "Push",           key: "payload.ref",                      label: "ref",                      desc: "Git ref (e.g. refs/heads/main)" },
      { group: "Push",           key: "payload.before",                   label: "before",                   desc: "SHA before push" },
      { group: "Push",           key: "payload.after",                    label: "after",                    desc: "SHA after push" },
      { group: "Push",           key: "payload.commits.0.message",        label: "commits[0].message",       desc: "First commit message" },
      { group: "Push",           key: "payload.commits.0.author.name",    label: "commits[0].author.name",   desc: "First commit author" },
      { group: "Push",           key: "payload.pusher.name",              label: "pusher.name",              desc: "Who pushed" },
    ],
  },
  {
    service: "Stripe",
    icon: "💳",
    color: "#6366F1",
    fields: [
      { key: "payload.type",                      label: "type",                    desc: "Event type (e.g. payment_intent.succeeded)" },
      { key: "payload.data.object.id",             label: "data.object.id",           desc: "Object ID" },
      { key: "payload.data.object.amount",         label: "data.object.amount",       desc: "Amount in cents" },
      { key: "payload.data.object.currency",       label: "data.object.currency",     desc: "Currency code (usd, eur…)" },
      { key: "payload.data.object.status",         label: "data.object.status",       desc: "Object status" },
      { key: "payload.data.object.customer",       label: "data.object.customer",     desc: "Customer ID" },
      { key: "payload.data.object.description",    label: "data.object.description",  desc: "Description text" },
      { key: "payload.data.object.metadata",       label: "data.object.metadata",     desc: "Custom metadata object" },
    ],
  },
  {
    service: "Notion",
    icon: "📝",
    color: "#F59E0B",
    fields: [
      { key: "payload.type",                     label: "type",                   desc: "Event type (page.created, etc.)" },
      { key: "payload.data.id",                  label: "data.id",                desc: "Page or database ID" },
      { key: "payload.data.url",                 label: "data.url",               desc: "Page URL" },
      { key: "payload.data.properties",          label: "data.properties",        desc: "Page properties object" },
      { key: "payload.data.parent.database_id",  label: "data.parent.database_id",desc: "Parent database ID" },
      { key: "payload.data.created_by.id",       label: "data.created_by.id",     desc: "Creator user ID" },
    ],
  },
];

interface UpstreamOption {
  expr: string;
  label: string;
  nodeLabel: string;
}

// nodeTestPaths: nodeId → flat key list from last HTTP test (e.g. ["bitcoin.usd", "ethereum.usd"])
function buildUpstreamOptions(
  upstreamNodes: Node<IrisNodeData>[],
  nodeTestPaths: Map<string, string[]>,
): UpstreamOption[] {
  return upstreamNodes.flatMap((n) => {
    const isTrigger = n.data.nodeType?.startsWith("trigger_");

    // For trigger nodes, use {{payload.*}} expressions (not steps[...])
    if (isTrigger && n.data.nodeType === "trigger_webhook") {
      const staticFields = OUTPUT_FIELDS.trigger_webhook ?? [];
      return staticFields.map((f) => ({
        expr: `{{${f.key}}}`,
        label: f.label,
        nodeLabel: "⚡ Webhook Trigger",
      }));
    }

    // Other triggers (cron, manual) have no payload
    if (isTrigger) return [];

    // Regular action nodes
    const staticFields = OUTPUT_FIELDS[n.data.nodeType] ?? [];
    const staticOpts = staticFields.map((f) => ({
      expr: `{{steps['${n.id}'].${f.key}}}`,
      label: f.label,
      nodeLabel: (n.data.label as string) || n.id,
    }));

    // If this is an HTTP node with discovered paths, append them under output.body.*
    if (n.data.nodeType === "http_request") {
      const discovered = nodeTestPaths.get(n.id) ?? [];
      const discoveredOpts = discovered.map((k) => ({
        expr: `{{steps['${n.id}'].output.body.${k}}}`,
        label: `body.${k}`,
        nodeLabel: (n.data.label as string) || n.id,
      }));
      return [...staticOpts, ...discoveredOpts];
    }

    return staticOpts;
  });
}


// ─── Webhook service templates component ──────────────────────────────────────

function WebhookTemplates({ onInsert }: { onInsert: (expr: string) => void }) {
  const [openService, setOpenService] = useState<string | null>(null);

  return (
    <div className="border-t border-iris-border-strong">
      <div className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-iris-secondary bg-iris-base flex items-center gap-1.5">
        <Webhook className="w-3 h-3" />
        Service Payload Templates
      </div>

      {/* Service tabs */}
      <div className="flex border-b border-iris-border-strong">
        {WEBHOOK_PAYLOAD_TEMPLATES.map((svc) => (
          <button
            key={svc.service}
            onClick={() => setOpenService(openService === svc.service ? null : svc.service)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-colors border-r border-iris-border-strong/40 last:border-r-0"
            style={{
              color: openService === svc.service ? svc.color : "var(--iris-text-muted)",
              background: openService === svc.service ? `${svc.color}10` : "transparent",
              borderBottom: openService === svc.service ? `2px solid ${svc.color}` : "2px solid transparent",
            }}
          >
            <span>{svc.icon}</span>
            {svc.service}
          </button>
        ))}
      </div>

      {/* Selected service fields */}
      {WEBHOOK_PAYLOAD_TEMPLATES.filter((s) => s.service === openService).map((svc) => {
        // Group fields by their group label
        const groups: { name: string; fields: typeof svc.fields }[] = [];
        let currentGroup = "";
        for (const field of svc.fields) {
          const g = field.group ?? "";
          if (g !== currentGroup) {
            groups.push({ name: g, fields: [] });
            currentGroup = g;
          }
          groups[groups.length - 1].fields.push(field);
        }
        return (
          <div key={svc.service}>
            {groups.map((grp) => (
              <div key={grp.name}>
                {grp.name && (
                  <div
                    className="px-3 py-1 text-[8px] font-black uppercase tracking-widest border-b border-iris-border-strong/40"
                    style={{ color: svc.color, background: `${svc.color}08` }}
                  >
                    {grp.name}
                  </div>
                )}
                {grp.fields.map((field) => (
                  <button
                    key={field.key}
                    onClick={() => onInsert(`{{${field.key}}}`)}
                    className="w-full text-left px-3 py-2 hover:bg-iris-elevated transition-colors border-b border-iris-border-strong/40 last:border-0"
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-1 h-1 rounded-full shrink-0" style={{ background: svc.color }} />
                      <div className="text-[10px] font-mono text-white truncate">{field.label}</div>
                    </div>
                    <div className="text-[9px] text-iris-secondary truncate opacity-70 ml-2.5 mt-0.5">
                      {field.desc}
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── SmartField ───────────────────────────────────────────────────────────────

interface SmartFieldProps {
  fieldName: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onChange: (v: string) => void;
  upstreamOptions: UpstreamOption[];
  hasWebhookUpstream?: boolean;
}

function SmartField({ fieldName, value, placeholder, multiline, onChange, upstreamOptions, hasWebhookUpstream = false }: SmartFieldProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  function insertAtCursor(expr: string) {
    const el = inputRef.current;
    if (!el) {
      onChange(value + expr);
      setOpen(false);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + expr + value.slice(end);
    onChange(next);
    setOpen(false);
    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + expr.length;
      el.setSelectionRange(pos, pos);
    });
  }

  const hasOptions = upstreamOptions.length > 0 || hasWebhookUpstream;
  const inputCls = "w-full bg-iris-base border border-iris-border-strong px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-iris-accent transition-colors placeholder:text-iris-muted";

  return (
    <div className="relative">
      {/* Insert button — only shown when there are upstream nodes */}
      {hasOptions && (
        <div className="absolute right-0 -top-6 flex items-center">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-iris-accent hover:text-white transition-colors px-1 py-0.5 border border-iris-accent/30 hover:border-iris-accent bg-iris-base"
          >
            <span className="font-mono">{"{}"}</span> insert
          </button>
        </div>
      )}

      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputCls} resize-none`}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputCls}
        />
      )}

      {/* Dropdown */}
      {open && hasOptions && (
        <>
          {/* Click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-full bg-iris-surface border border-iris-accent/40 z-50 shadow-2xl max-h-80 overflow-y-auto custom-scrollbar">
            <div className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-iris-secondary border-b border-iris-border-strong bg-iris-base">
              Insert from upstream node
            </div>
            {/* Group by node */}
            {Array.from(new Set(upstreamOptions.map((o) => o.nodeLabel))).map((nodeLabel) => (
              <div key={nodeLabel}>
                <div className="px-3 py-1.5 text-[9px] font-bold text-iris-accent uppercase tracking-widest bg-iris-accent/5 border-b border-iris-border-strong">
                  {nodeLabel}
                </div>
                {upstreamOptions
                  .filter((o) => o.nodeLabel === nodeLabel)
                  .map((opt) => (
                    <button
                      key={opt.expr}
                      onClick={() => insertAtCursor(opt.expr)}
                      className="w-full text-left px-3 py-2 hover:bg-iris-elevated transition-colors border-b border-iris-border-strong/40 last:border-0"
                    >
                      <div className="text-[10px] font-mono text-white truncate">{opt.label}</div>
                      <div className="text-[9px] font-mono text-iris-secondary truncate opacity-70">
                        {opt.expr}
                      </div>
                    </button>
                  ))}
              </div>
            ))}

            {/* Webhook service templates — shown when a webhook trigger is upstream */}
            {hasWebhookUpstream && (
              <WebhookTemplates onInsert={insertAtCursor} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ConfigPanel({ node, secrets, upstreamNodes, nodeTestPaths, onTestComplete, onUpdate, onDelete, onClose }: ConfigPanelProps) {
  const typeDef = NODE_TYPES_BY_TYPE[node.data.nodeType];
  const config = node.data.config ?? {};

  function handleChange(name: string, value: unknown) {
    onUpdate(node.id, { ...config, [name]: value });
  }

  const isTrigger = node.data.nodeType?.startsWith("trigger_");
  const isLargeBody = (name: string) => name === "message" || name === "body" || name === "expr";
  const upstreamOptions = buildUpstreamOptions(upstreamNodes, nodeTestPaths);
  const hasWebhookUpstream = upstreamNodes.some((n) => n.data.nodeType === "trigger_webhook");

  return (
    <aside className="w-72 bg-iris-surface border-l border-iris-border-strong flex flex-col h-full overflow-hidden shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-iris-border-strong bg-iris-base flex items-center justify-between shrink-0">
        <div>
          <div className="text-[9px] font-black tracking-[0.2em] uppercase text-iris-secondary">Configure Node</div>
          <div className="text-sm font-bold text-white mt-0.5">{typeDef?.label ?? node.data.label}</div>
          <div className="text-[10px] text-iris-muted font-mono mt-0.5">{node.id}</div>
        </div>
        <button onClick={onClose} className="text-iris-secondary hover:text-white transition-colors p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">


        {/* HTTP request tester */}
        {node.data.nodeType === "http_request" && (
          <HttpTester
            nodeId={node.id}
            config={config}
            onDiscoverPaths={(paths) => onTestComplete(node.id, paths)}
          />
        )}

        {(!typeDef || typeDef.configFields.length === 0) && (
          <div className="text-xs text-iris-secondary text-center py-6">
            {isTrigger ? "No configuration required for this trigger." : "No configurable fields."}
          </div>
        )}

        {typeDef?.configFields.map((field) => {
          // Hide the right_operand field when operator is "exists"
          if (field.name === "right_operand" && config["operator"] === "exists") return null;

          return (
          <div key={field.name} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-iris-secondary">
                {field.label}
              </label>
              {field.required && (
                <span className="text-[9px] text-iris-error font-bold uppercase tracking-wider">required</span>
              )}
            </div>

            {field.type === "select" && (
              <select
                value={(config[field.name] as string) ?? field.options?.[0] ?? ""}
                onChange={(e) => handleChange(field.name, e.target.value)}
                className="w-full bg-iris-base border border-iris-border-strong px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-iris-accent transition-colors"
              >
                {field.options?.map((opt) => (
                  <option key={opt} value={opt} className="bg-iris-base">{opt}</option>
                ))}
              </select>
            )}

            {field.type === "secret_ref" && (
              <div className="space-y-1">
                <select
                  value={(config[field.name] as string) ?? ""}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  className="w-full bg-iris-base border border-iris-border-strong px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-iris-accent transition-colors"
                >
                  <option value="" className="bg-iris-base text-iris-secondary">— select a secret —</option>
                  {secrets.map((s) => (
                    <option key={s.id} value={s.name} className="bg-iris-base">{s.name}</option>
                  ))}
                </select>
                {secrets.length === 0 && (
                  <div className="text-[10px] text-iris-warning tracking-wide">
                    ⚠ No secrets found. Add one in Vault [AES].
                  </div>
                )}
              </div>
            )}

            {field.type === "bool" && (
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => handleChange(field.name, !config[field.name])}
                  className={`w-10 h-5 rounded-sm relative transition-colors cursor-pointer ${
                    config[field.name] ? "bg-iris-accent" : "bg-iris-border-strong"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 bg-white transition-transform ${
                      config[field.name] ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </div>
                <span className="text-xs text-iris-secondary">{config[field.name] ? "Enabled" : "Disabled"}</span>
              </label>
            )}

            {/* condition_left: SmartField that only suggests step references (no raw typing blocked) */}
            {field.type === "condition_left" && (
              <SmartField
                fieldName={field.name}
                value={(config[field.name] as string) ?? ""}
                placeholder={field.placeholder}
                multiline={false}
                onChange={(v) => handleChange(field.name, v)}
                upstreamOptions={upstreamOptions}
                hasWebhookUpstream={hasWebhookUpstream}
              />
            )}

            {field.type === "string" && (
              <SmartField
                fieldName={field.name}
                value={(config[field.name] as string) ?? ""}
                placeholder={field.placeholder}
                multiline={isLargeBody(field.name)}
                onChange={(v) => handleChange(field.name, v)}
                upstreamOptions={upstreamOptions}
                hasWebhookUpstream={hasWebhookUpstream}
              />
            )}

            {field.type === "int" && (
              <input
                type="number"
                value={(config[field.name] as number) ?? ""}
                onChange={(e) => handleChange(field.name, Number(e.target.value))}
                placeholder={field.placeholder}
                className="w-full bg-iris-base border border-iris-border-strong px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-iris-accent transition-colors placeholder:text-iris-muted"
              />
            )}

            {field.description && (
              <div className="text-[10px] text-iris-muted leading-relaxed">{field.description}</div>
            )}
          </div>
        );
        })}
      </div>

      {/* Delete */}
      <div className="p-4 border-t border-iris-border-strong bg-iris-base shrink-0">
        <button
          onClick={() => onDelete(node.id)}
          className="w-full flex items-center justify-center gap-2 py-2 border border-iris-error/40 text-iris-error text-xs font-bold uppercase tracking-widest hover:bg-iris-error/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" /> Remove Node
        </button>
      </div>
    </aside>
  );
}


