import { Plug, Plus, Database, Cloud, Link as LinkIcon, AlertTriangle } from "lucide-react";

export default function ConnectionsPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center border-b border-iris-border-strong pb-4">
        <div>
          <h1 className="text-xl font-black tracking-widest text-white uppercase flex items-center gap-3">
            <Plug className="w-5 h-5 text-iris-accent-sub" />
            Connections
          </h1>
          <p className="text-xs text-iris-secondary font-mono mt-1">External endpoints and authorized platforms</p>
        </div>
        
        <button className="bg-iris-accent-sub/10 text-iris-accent-sub border border-iris-accent-sub px-4 py-2 text-xs font-bold tracking-widest uppercase hover:bg-iris-accent-sub hover:text-black transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Source
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ConnectionCard name="PostgreSQL_Main DB" type="Database" status="CONNECTED" icon={<Database className="w-6 h-6 text-iris-secondary" />} />
        <ConnectionCard name="AWS_S3_Bucket_Raw" type="Storage" status="CONNECTED" icon={<Cloud className="w-6 h-6 text-iris-secondary" />} />
        <ConnectionCard name="Discord_Webhook_Ops" type="API" status="DEGRADED" icon={<LinkIcon className="w-6 h-6 text-iris-warning" />} />
      </div>
    </div>
  );
}

function ConnectionCard({ name, type, status, icon }: { name: string, type: string, status: string, icon: React.ReactNode }) {
  const isHealthy = status === 'CONNECTED';
  
  return (
    <div className="border border-iris-border-strong bg-iris-surface p-5 flex flex-col group hover:border-iris-accent-sub/50 transition-colors">
      <div className="flex justify-between items-start mb-6">
        <div className="p-3 bg-iris-base border border-iris-border-strong rounded-sm inline-block">
          {icon}
        </div>
        <div className={`text-[10px] font-bold tracking-widest uppercase flex items-center gap-1 ${isHealthy ? 'text-iris-success' : 'text-iris-warning'}`}>
          {!isHealthy && <AlertTriangle className="w-3 h-3" />}
          {status}
        </div>
      </div>
      
      <div className="flex-1">
        <h3 className="font-mono font-bold text-white text-base mb-1 truncate" title={name}>{name}</h3>
        <p className="text-xs text-iris-secondary uppercase tracking-widest">{type}</p>
      </div>
      
      <div className="mt-6 pt-4 border-t border-iris-border-strong">
        <button className="text-xs font-mono text-iris-secondary hover:text-white uppercase tracking-widest flex items-center gap-2 transition-colors">
          Configure <span className="text-iris-accent-sub">→</span>
        </button>
      </div>
    </div>
  );
}
