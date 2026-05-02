import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import type { IrisNodeData } from "@/lib/workflow/converters";

function ConditionNodeComponent({ data, selected }: { data: IrisNodeData; selected?: boolean }) {
  const expr = (data.config?.expr as string) || "…";

  return (
    <div
      className={`w-52 bg-iris-surface border transition-all duration-150 shadow-lg ${
        selected ? "border-iris-error shadow-[0_0_20px_rgba(239,68,68,0.2)]" : "border-iris-error/50 hover:border-iris-error"
      }`}
    >
      {/* Input handle */}
      <Handle type="target" position={Position.Top} id="in" style={{ top: -5 }} />

      {/* Header */}
      <div className="px-3 py-2 bg-iris-error/10 border-b border-iris-error/30 flex items-center justify-between">
        <span className="text-[9px] font-black tracking-widest text-iris-error uppercase">Condition</span>
        <GitBranch className="w-4 h-4 text-iris-error" />
      </div>

      {/* Body */}
      <div className="px-3 py-3">
        <div className="text-[10px] text-iris-secondary mb-1 uppercase tracking-widest font-bold">Expression</div>
        <div className="text-xs text-white font-mono truncate max-w-[180px]" title={expr}>
          {expr}
        </div>
      </div>

      {/* Branch labels */}
      <div className="flex justify-between px-3 pb-2 text-[9px] font-black tracking-widest">
        <span className="text-iris-success">TRUE</span>
        <span className="text-iris-error">FALSE</span>
      </div>

      {/* Two output handles — true (left) and false (right) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ bottom: -5, left: "25%" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ bottom: -5, left: "75%" }}
      />
    </div>
  );
}

export const ConditionNode = memo(ConditionNodeComponent);
