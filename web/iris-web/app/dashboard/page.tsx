import { Activity, Cpu, Network, Zap } from "lucide-react";

export default function DashboardOverview() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex justify-between items-end border-b border-iris-border-strong pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-widest text-white uppercase flex items-center gap-3">
            <Activity className="w-6 h-6 text-iris-accent" />
            System Overview
          </h1>
          <p className="text-xs text-iris-secondary font-mono mt-2 tracking-wider">PRIMARY DASHBOARD // V 1.0.4</p>
        </div>
        <div className="text-xs font-mono text-iris-accent-sub border border-iris-accent-sub/30 bg-iris-accent-sub/10 px-3 py-1 uppercase tracking-widest flex items-center gap-2 hidden md:flex">
          <div className="w-1.5 h-1.5 rounded-full bg-iris-accent-sub animate-pulse" />
          Live Metrics
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Relays" value="24" icon={<Workflow className="w-5 h-5 text-iris-accent" />} trend="+3 active" trendUp />
        <StatCard title="Active Connections" value="12" icon={<Network className="w-5 h-5 text-iris-accent-sub" />} trend="Stable" />
        <StatCard title="Encrypted Secrets" value="8" icon={<Shield className="w-5 h-5 text-iris-success" />} trend="Secured" />
        <StatCard title="Compute Load" value="42%" icon={<Cpu className="w-5 h-5 text-iris-warning" />} trend="+12% usage" trendUp />
      </div>

      {/* Visual Terminal Block */}
      <div className="border border-iris-border-strong bg-black relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-iris-accent" />
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-iris-accent" />
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-iris-accent" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-iris-accent" />
        
        <div className="bg-iris-surface p-2 border-b border-iris-border-strong flex items-center justify-between">
          <div className="flex gap-2">
            <div className="w-3 h-3 bg-iris-error rounded-full" />
            <div className="w-3 h-3 bg-iris-warning rounded-full" />
            <div className="w-3 h-3 bg-iris-success rounded-full" />
          </div>
          <div className="text-[10px] text-iris-secondary font-mono tracking-widest font-black uppercase">Recent Activity Log</div>
        </div>
        
        <div className="p-4 font-mono text-xs space-y-2 h-48 overflow-y-auto custom-scrollbar text-iris-secondary">
          <LogEntry time="08:42:11" type="INFO" message="Relay 'Alpha_Core' connection established." />
          <LogEntry time="08:45:03" type="WARN" message="Latency spike detected on Connection_Gateway_7." color="text-iris-warning" />
          <LogEntry time="09:01:22" type="SUCCESS" message="New secret 'API_KEY_STRIPE' successfully encrypted and stored." color="text-iris-success" />
          <LogEntry time="09:15:44" type="ERROR" message="Failed to authenticate to relay 'Beta_Node'. Retrying..." color="text-iris-error" />
          <LogEntry time="09:16:05" type="INFO" message="Relay 'Beta_Node' connection established on retry." />
          <LogEntry time="10:00:00" type="INFO" message="Scheduled system diagnostic complete. All systems nominal." />
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, trend, trendUp }: { title: string, value: string, icon: React.ReactNode, trend: string, trendUp?: boolean }) {
  return (
    <div className="bg-iris-surface border border-iris-border-strong p-4 relative group hover:border-iris-accent/50 transition-colors">
      <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-transparent group-hover:border-iris-accent transition-colors" />
      
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-[10px] font-bold tracking-widest uppercase text-iris-secondary">{title}</h3>
        {icon}
      </div>
      
      <div className="flex items-end justify-between">
        <div className="text-3xl font-black font-mono text-white tracking-wider">{value}</div>
        <div className={`text-[10px] uppercase tracking-widest font-bold ${trendUp ? 'text-iris-accent' : 'text-iris-secondary'}`}>
          {trend}
        </div>
      </div>
    </div>
  );
}

function LogEntry({ time, type, message, color = "text-iris-secondary" }: { time: string, type: string, message: string, color?: string }) {
  return (
    <div className="flex items-start gap-4">
      <span className="text-iris-border-strong shrink-0">[{time}]</span>
      <span className={`shrink-0 w-16 font-bold ${color}`}>{type}</span>
      <span className="text-white opacity-80">{message}</span>
    </div>
  );
}

import { Workflow, Shield, Plug } from "lucide-react"; // Imported for StatCard icons
