import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Globe, MessageSquare, Hash, Mail, Terminal } from "lucide-react";
import type { IrisNodeData } from "@/lib/workflow/converters";

const ACTION_ICONS: Record<string, React.ReactNode> = {
  http_request: <Globe className="w-4 h-4 text-iris-accent" />,
  discord_send: <MessageSquare className="w-4 h-4 text-[#5865F2]" />,
  slack_send: <Hash className="w-4 h-4 text-[#E01E5A]" />,
  email_send: <Mail className="w-4 h-4 text-iris-accent" />,
  debug_log: <Terminal className="w-4 h-4 text-iris-secondary" />,
};

const ACTION_PREVIEW: Record<string, (config: Record<string, unknown>) => string> = {
  http_request: (c) => `${c.method ?? "GET"} ${(c.url as string)?.slice(0, 30) ?? "…"}`,
  discord_send: (c) => `→ ${c.webhook_url_ref || "no secret"}`,
  slack_send: (c) => `→ ${c.webhook_url_ref || "no secret"}`,
  email_send: (c) => `→ ${(c.to as string) || "no recipient"}`,
  debug_log: (c) => (c.message as string)?.slice(0, 30) || "…",
};

function ActionNodeComponent({ data, selected }: { data: IrisNodeData; selected?: boolean }) {
  const icon = ACTION_ICONS[data.nodeType] ?? <Globe className="w-4 h-4 text-iris-accent" />;
  const previewFn = ACTION_PREVIEW[data.nodeType];
  const preview = previewFn ? previewFn(data.config) : "";

  const label = data.label || data.nodeType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div
      className={`w-48 bg-iris-surface border transition-all duration-150 shadow-lg ${
        selected ? "border-iris-accent shadow-[0_0_20px_rgba(16,185,129,0.25)]" : "border-iris-border-strong hover:border-iris-accent/60"
      }`}
    >
      {/* Input handle */}
      <Handle type="target" position={Position.Top} id="in" style={{ top: -5 }} />

      {/* Header */}
      <div className="px-3 py-2 bg-iris-base border-b border-iris-border-strong flex items-center justify-between">
        <span className="text-[9px] font-black tracking-widest text-iris-secondary uppercase">Action</span>
        {icon}
      </div>

      {/* Body */}
      <div className="px-3 py-3">
        <div className="text-xs font-bold text-white tracking-wide mb-1">{label}</div>
        {preview && (
          <div className="text-[10px] text-iris-secondary font-mono truncate max-w-[140px]">
            {preview}
          </div>
        )}
      </div>

      {/* Output handle */}
      <Handle type="source" position={Position.Bottom} id="out" style={{ bottom: -5 }} />
    </div>
  );
}

export const ActionNode = memo(ActionNodeComponent);
