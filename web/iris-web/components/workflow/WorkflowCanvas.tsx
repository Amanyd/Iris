import { Database, Mail, Zap, Play, Settings2 } from "lucide-react";

export function WorkflowCanvas() {
  return (
    <div className="w-full h-[600px] border border-iris-border-strong bg-iris-base relative overflow-hidden group">
      {/* Grid Background */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#1F1F1F_1px,transparent_1px),linear-gradient(to_bottom,#1F1F1F_1px,transparent_1px)] bg-[size:2rem_2rem] pointer-events-none opacity-40" />

      {/* Canvas Header */}
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        <div className="bg-iris-surface border border-iris-border-strong px-3 py-1.5 text-[10px] font-black font-mono text-iris-secondary tracking-widest uppercase flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-iris-accent animate-pulse" />
          Canvas_Active
        </div>
        <button className="bg-iris-base border border-iris-border-strong px-3 py-1.5 text-[10px] font-bold font-mono text-white tracking-widest uppercase hover:bg-iris-surface transition-colors flex items-center gap-1">
          <Play className="w-3 h-3 text-iris-success" /> Test Run
        </button>
      </div>

      {/* Nodes Container */}
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        
        {/* Connection Line (Mock) */}
        <div className="absolute top-[50%] left-[25%] w-[50%] h-[2px] bg-iris-border-strong z-0">
          <div className="h-full bg-iris-accent w-1/3 animate-[pulse_2s_ease-in-out_infinite]" />
        </div>

        {/* Node 1: Trigger */}
        <div className="absolute left-[15%] top-[40%]">
          <NodeBlock type="Trigger" title="Webhook_In" icon={<Zap className="w-4 h-4 text-iris-accent" />} status="active" />
        </div>

        {/* Node 2: Action */}
        <div className="absolute left-[45%] top-[40%]">
          <NodeBlock type="Processing" title="Transform_Data" icon={<Settings2 className="w-4 h-4 text-iris-secondary" />} status="ready" />
        </div>

        {/* Node 3: Output */}
        <div className="absolute right-[15%] top-[25%]">
          <NodeBlock type="Output" title="Postgres_Write" icon={<Database className="w-4 h-4 text-iris-success" />} status="ready" />
        </div>

        {/* Connection Line (Mock Branch) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ zIndex: 0 }}>
           <path d="M 55% 45% C 65% 45%, 75% 70%, 85% 70%" fill="none" stroke="#333" strokeWidth="2" strokeDasharray="4 4" />
        </svg>

        {/* Node 4: Branch Output */}
        <div className="absolute right-[15%] top-[65%]">
          <NodeBlock type="Output" title="Send_Email" icon={<Mail className="w-4 h-4 text-iris-accent-sub" />} status="inactive" />
        </div>

      </div>
    </div>
  );
}

function NodeBlock({ type, title, icon, status }: { type: string, title: string, icon: React.ReactNode, status: "active" | "ready" | "inactive" }) {
  const borderColor = status === "active" ? "border-iris-accent" : status === "ready" ? "border-iris-border-strong" : "border-iris-border-strong opacity-50";
  
  return (
    <div className={`w-48 bg-iris-surface border ${borderColor} flex flex-col shadow-2xl relative group hover:border-white transition-colors cursor-crosshair z-10`}>
      {/* Port Inputs/Outputs */}
      <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-iris-base border border-iris-border-strong rounded-full z-20 group-hover:border-iris-accent transition-colors" />
      <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-iris-base border border-iris-border-strong rounded-full z-20 group-hover:border-iris-accent transition-colors" />
      
      <div className="px-3 py-2 border-b border-iris-border-strong flex items-center justify-between bg-black">
        <span className="text-[9px] font-black uppercase tracking-widest text-iris-secondary">{type}</span>
        {icon}
      </div>
      <div className="p-4 flex flex-col items-start gap-1">
        <span className="text-xs font-mono font-bold text-white tracking-wide">{title}</span>
        <div className="text-[10px] text-iris-secondary uppercase font-mono mt-2 tracking-widest">
          {status === "active" ? (
             <span className="text-iris-accent animate-pulse">Running...</span>
          ) : status === "ready" ? (
             <span>Standby</span>
          ) : (
             <span>Disabled</span>
          )}
        </div>
      </div>
    </div>
  );
}
