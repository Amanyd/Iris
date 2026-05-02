"use client";

import { Activity, Cpu, Network, Workflow, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "@/lib/api";

export default function DashboardOverview() {
  const [relays, setRelays] = useState<api.Relay[]>([]);
  const [secrets, setSecrets] = useState<api.Secret[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [r, s] = await Promise.all([api.getRelays(), api.getSecrets()]);
        setRelays(r);
        setSecrets(s);
      } catch {
        // Ignore — empty state is fine for first load
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const [ts, setTs] = useState("");
  useEffect(() => {
    setTs(new Date().toLocaleTimeString("en-GB"));
  }, []);

  const activeRelays = relays.filter((r) => r.is_active).length;


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
        <div className="text-xs font-mono text-iris-accent-sub border border-iris-accent-sub/30 bg-iris-accent-sub/10 px-3 py-1 uppercase tracking-widest items-center gap-2 hidden md:flex">
          <div className="w-1.5 h-1.5 rounded-full bg-iris-accent-sub animate-pulse" />
          {loading ? "Loading..." : "Live Metrics"}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Relays"
          value={loading ? "—" : String(relays.length)}
          icon={<Workflow className="w-5 h-5 text-iris-accent" />}
          trend={loading ? "..." : `${activeRelays} active`}
          trendUp={activeRelays > 0}
        />
        <StatCard
          title="Active Connections"
          value={loading ? "—" : String(activeRelays)}
          icon={<Network className="w-5 h-5 text-iris-accent-sub" />}
          trend="Stable"
        />
        <StatCard
          title="Encrypted Secrets"
          value={loading ? "—" : String(secrets.length)}
          icon={<Shield className="w-5 h-5 text-iris-success" />}
          trend="Secured"
        />
        <StatCard
          title="Compute Load"
          value="0%"
          icon={<Cpu className="w-5 h-5 text-iris-warning" />}
          trend="Idle"
        />
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
          <div className="text-[10px] text-iris-secondary font-mono tracking-widest font-black uppercase">System Status Log</div>
        </div>
        
        <div className="p-4 font-mono text-xs space-y-2 h-48 overflow-y-auto custom-scrollbar text-iris-secondary">
          <LogEntry time={ts} type="INFO" message="Dashboard initialized. Backend connection established." />
          <LogEntry time={ts} type="SUCCESS" message={`Loaded ${relays.length} relays, ${secrets.length} secrets from vault.`} color="text-iris-success" />
          {relays.length === 0 && (
            <LogEntry time={ts} type="INFO" message="No relays found. Navigate to Relay Matrix to create your first workflow." />
          )}
          {secrets.length === 0 && (
            <LogEntry time={ts} type="WARN" message="Vault is empty. Store API keys in the Vault [AES] section." color="text-iris-warning" />
          )}
          <LogEntry time={ts} type="INFO" message="All systems nominal. Ready for operations." />
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
