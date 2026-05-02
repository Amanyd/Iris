import { Workflow, Plus, Play, Square, Settings2 } from "lucide-react";
import { WorkflowCanvas } from "@/components/workflow/WorkflowCanvas";

export default function RelaysPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center border-b border-iris-border-strong pb-4">
        <div>
          <h1 className="text-xl font-black tracking-widest text-white uppercase flex items-center gap-3">
            <Workflow className="w-5 h-5 text-iris-accent" />
            Relay Editor
          </h1>
          <p className="text-xs text-iris-secondary font-mono mt-1">Design and configure autonomous node sequences</p>
        </div>
        
        <div className="flex gap-4">
          <button className="bg-iris-surface text-white border border-iris-border-strong px-4 py-2 text-xs font-bold tracking-widest uppercase hover:bg-iris-border-strong transition-colors flex items-center gap-2">
            Load Template
          </button>
          <button className="bg-iris-accent/10 text-iris-accent border border-iris-accent px-4 py-2 text-xs font-bold tracking-widest uppercase hover:bg-iris-accent hover:text-black transition-colors flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Node
          </button>
        </div>
      </div>

      {/* Embedded Component */}
      <div className="shadow-2xl">
        <WorkflowCanvas />
      </div>

      <div className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-iris-border-strong">
        <div className="md:col-span-3 text-sm font-black font-mono tracking-widest uppercase text-white mb-2">Deployed Instances</div>
        <RelayCard name="System_Crawler" status="ACTIVE" trigger="WEBHOOK" executes={1402} />
        <RelayCard name="Data_ETL_Primary" status="IDLE" trigger="SCHEDULE" executes={56} />
        <RelayCard name="Alert_Router" status="ACTIVE" trigger="EVENT" executes={8933} />
      </div>
    </div>
  );
}

function RelayCard({ name, status, trigger, executes }: { name: string, status: string, trigger: string, executes: number }) {
  const statusColors: Record<string, string> = {
    ACTIVE: "text-iris-success bg-iris-success/10 border-iris-success/30",
    IDLE: "text-iris-warning bg-iris-warning/10 border-iris-warning/30",
    ERROR: "text-iris-error bg-iris-error/10 border-iris-error/30",
  };

  return (
    <div className="border border-iris-border-strong bg-iris-surface p-5 relative group">
      <div className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center border-l border-b border-iris-border-strong bg-iris-base text-iris-secondary group-hover:text-white transition-colors cursor-pointer">
        <Settings2 className="w-4 h-4" />
      </div>
      
      <div className="mb-4">
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-black tracking-widest border ${statusColors[status] || "text-white"}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${status === 'ACTIVE' ? 'bg-iris-success animate-pulse' : status === 'ERROR' ? 'bg-iris-error' : 'bg-iris-warning'}`} />
          {status}
        </div>
      </div>

      <h3 className="font-mono font-bold text-white text-lg mb-2 truncate" title={name}>{name}</h3>
      
      <div className="space-y-2 mb-6 text-xs font-mono text-iris-secondary">
        <div className="flex justify-between">
          <span className="uppercase opacity-50">Trigger</span>
          <span className="text-white">{trigger}</span>
        </div>
        <div className="flex justify-between">
          <span className="uppercase opacity-50">Executions</span>
          <span className="text-white">{executes.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex gap-2 border-t border-iris-border-strong pt-4">
        <button className="flex-1 flex items-center justify-center gap-2 p-2 bg-iris-base border border-iris-border-strong text-xs font-bold text-white hover:border-iris-success hover:text-iris-success transition-colors">
          <Play className="w-3 h-3" /> Start
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 p-2 bg-iris-base border border-iris-border-strong text-xs font-bold text-white hover:border-iris-error hover:text-iris-error transition-colors">
          <Square className="w-3 h-3" /> Stop
        </button>
      </div>
    </div>
  );
}
