"use client";

import { useState } from "react";
import { Zap, Clock, Play, Globe, MessageSquare, Hash, Mail, Terminal, GitBranch, ChevronDown } from "lucide-react";
import { TRIGGER_TYPES, ACTION_TYPES, CONDITION_TYPES, type NodeTypeDef } from "@/lib/workflow/node-types";

const ICON_MAP: Record<string, React.ReactNode> = {
  Zap: <Zap className="w-3.5 h-3.5" />,
  Clock: <Clock className="w-3.5 h-3.5" />,
  Play: <Play className="w-3.5 h-3.5" />,
  Globe: <Globe className="w-3.5 h-3.5" />,
  MessageSquare: <MessageSquare className="w-3.5 h-3.5" />,
  Hash: <Hash className="w-3.5 h-3.5" />,
  Mail: <Mail className="w-3.5 h-3.5" />,
  Terminal: <Terminal className="w-3.5 h-3.5" />,
  GitBranch: <GitBranch className="w-3.5 h-3.5" />,
};

interface PaletteItemProps {
  node: NodeTypeDef;
  colorClass: string;
}

function PaletteItem({ node, colorClass }: PaletteItemProps) {
  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("application/iris-node-type", node.type);
    e.dataTransfer.setData("application/iris-node-label", node.label);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`flex items-center gap-2 px-3 py-2.5 border border-transparent hover:border-iris-border-strong hover:bg-iris-elevated cursor-grab active:cursor-grabbing transition-all group ${colorClass}`}
    >
      <div className="shrink-0">{ICON_MAP[node.icon] ?? <Globe className="w-3.5 h-3.5" />}</div>
      <div className="min-w-0">
        <div className="text-xs font-bold text-white tracking-wide truncate">{node.label}</div>
        <div className="text-[10px] text-iris-secondary truncate max-w-[130px] leading-tight">{node.description}</div>
      </div>
      <div className="ml-auto text-[10px] text-iris-border-strong group-hover:text-iris-secondary transition-colors shrink-0">⠿</div>
    </div>
  );
}

interface SectionProps {
  title: string;
  badge: string;
  badgeColor: string;
  nodes: NodeTypeDef[];
  colorClass: string;
  defaultOpen?: boolean;
}

function Section({ title, badge, badgeColor, nodes, colorClass, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-iris-border-strong">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-iris-elevated transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-black tracking-widest uppercase ${badgeColor}`}>{badge}</span>
          <span className="text-[10px] text-iris-secondary font-bold tracking-wider uppercase">{title}</span>
        </div>
        <ChevronDown className={`w-3 h-3 text-iris-border-strong transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && (
        <div className="pb-1">
          {nodes.map((n) => (
            <PaletteItem key={n.type} node={n} colorClass={colorClass} />
          ))}
        </div>
      )}
    </div>
  );
}

export function NodePalette() {
  return (
    <aside className="w-52 bg-iris-surface border-r border-iris-border-strong flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 border-b border-iris-border-strong bg-iris-base shrink-0">
        <div className="text-[10px] font-black tracking-[0.2em] uppercase text-iris-secondary">Node Palette</div>
        <div className="text-[9px] text-iris-border-strong mt-0.5 tracking-widest">Drag to canvas</div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <Section
          title="Triggers"
          badge="ENTRY"
          badgeColor="text-iris-accent-sub"
          nodes={TRIGGER_TYPES}
          colorClass="text-iris-accent-sub"
          defaultOpen={true}
        />
        <Section
          title="Actions"
          badge="EXEC"
          badgeColor="text-iris-accent"
          nodes={ACTION_TYPES}
          colorClass="text-iris-accent"
          defaultOpen={true}
        />
        <Section
          title="Conditions"
          badge="BRANCH"
          badgeColor="text-iris-error"
          nodes={CONDITION_TYPES}
          colorClass="text-iris-error"
          defaultOpen={true}
        />
      </div>

      <div className="px-3 py-2 border-t border-iris-border-strong bg-iris-base shrink-0">
        <div className="text-[9px] text-iris-border-strong tracking-widest text-center">
          Del / Backspace to remove selected
        </div>
      </div>
    </aside>
  );
}
