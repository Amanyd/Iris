import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Zap, Clock, Play } from "lucide-react";
import type { IrisNodeData } from "@/lib/workflow/converters";

const TRIGGER_ICONS: Record<string, React.ReactNode> = {
  trigger_webhook: <Zap className="w-4 h-4 text-iris-accent-sub" />,
  trigger_cron: <Clock className="w-4 h-4 text-iris-accent-sub" />,
  trigger_manual: <Play className="w-4 h-4 text-iris-accent-sub" />,
};

const TRIGGER_LABELS: Record<string, string> = {
  trigger_webhook: "Webhook",
  trigger_cron: "Cron Schedule",
  trigger_manual: "Manual",
};

function TriggerNodeComponent({ data, selected }: { data: IrisNodeData; selected?: boolean }) {
  const icon = TRIGGER_ICONS[data.nodeType] ?? <Zap className="w-4 h-4 text-iris-accent-sub" />;
  const label = TRIGGER_LABELS[data.nodeType] ?? data.label;

  return (
    <div
      className={`w-48 bg-iris-surface border-2 transition-all duration-150 shadow-lg ${
        selected ? "border-iris-accent-sub shadow-[0_0_20px_rgba(245,158,11,0.25)]" : "border-iris-accent-sub/60 hover:border-iris-accent-sub"
      }`}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-iris-accent-sub/10 border-b border-iris-accent-sub/30 flex items-center justify-between">
        <span className="text-[9px] font-black tracking-widest text-iris-accent-sub uppercase">Trigger</span>
        <div className="w-1.5 h-1.5 bg-iris-accent-sub rounded-full animate-pulse" />
      </div>

      {/* Body */}
      <div className="px-3 py-3 flex items-center gap-2">
        {icon}
        <div>
          <div className="text-xs font-bold text-white tracking-wide">{label}</div>
          {data.nodeType === "trigger_cron" && typeof data.config?.cron === "string" && (
            <div className="text-[10px] text-iris-secondary font-mono mt-0.5 truncate max-w-[120px]">
              {data.config.cron}
            </div>
          )}

          {data.nodeType === "trigger_webhook" && (
            <div className="text-[10px] text-iris-secondary font-mono mt-0.5">POST /hooks/…</div>
          )}
        </div>
      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="out"
        style={{ bottom: -5 }}
      />
    </div>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);
