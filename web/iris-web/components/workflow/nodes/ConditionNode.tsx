import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import type { IrisNodeData } from "@/lib/workflow/converters";

function ConditionNodeComponent({ data, selected }: { data: IrisNodeData; selected?: boolean }) {
  const left = (data.config?.left_operand as string) || "";
  const op = (data.config?.operator as string) || "==";
  const right = (data.config?.right_operand as string) || "";

  // Build a short display string from the 3 parts
  const displayLeft = left
    ? left.replace(/^steps\['([^']+)'\]\.output\./, "$1 › ") // "node › field"
    : "…";
  const displayExpr =
    op === "exists"
      ? `exists ${displayLeft}`
      : `${displayLeft} ${op} ${right || "…"}`;

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
      <div className="px-3 py-3 space-y-1">
        {/* Left operand */}
        <div className="text-[9px] text-iris-secondary uppercase tracking-widest font-bold">Value</div>
        <div className="text-[10px] text-iris-accent font-mono truncate" title={left}>
          {displayLeft}
        </div>

        {/* Operator badge */}
        <div className="flex items-center gap-1.5 py-0.5">
          <span className="text-[10px] font-black font-mono bg-iris-error/20 text-iris-error px-2 py-0.5 border border-iris-error/30">
            {op}
          </span>
          {op !== "exists" && (
            <span className="text-[10px] font-mono text-white truncate max-w-[100px]" title={right}>
              {right || <span className="text-iris-muted italic">any</span>}
            </span>
          )}
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
