"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Play,
  ChevronDown,
  ChevronRight,
  Terminal,
} from "lucide-react";
import * as api from "@/lib/api";

interface RelayLogsProps {
  relay: api.Relay;
  onBack: () => void;
}

const STATUS_STYLE: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  success: {
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    color: "text-iris-success",
    bg: "bg-iris-success/10",
    border: "border-iris-success/30",
  },
  failed: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    color: "text-iris-error",
    bg: "bg-iris-error/10",
    border: "border-iris-error/30",
  },
  running: {
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    color: "text-iris-accent-sub",
    bg: "bg-iris-accent-sub/10",
    border: "border-iris-accent-sub/30",
  },
  pending: {
    icon: <Clock className="w-3.5 h-3.5" />,
    color: "text-iris-secondary",
    bg: "bg-iris-border-strong/20",
    border: "border-iris-border-strong",
  },
};

function duration(start: string, end?: string): string {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const ms = e - s;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function timestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { hour12: false });
}

// ─── Execution Step Row ───────────────────────────────────────────────────────

function StepRow({ step }: { step: api.ExecutionStep }) {
  const [open, setOpen] = useState(false);
  const s = STATUS_STYLE[step.status] ?? STATUS_STYLE.pending;

  return (
    <div className="border border-iris-border-strong bg-iris-base">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-iris-elevated transition-colors text-left"
      >
        <span className={`${s.color} shrink-0`}>{s.icon}</span>
        <span className="text-xs font-mono font-bold text-white flex-1 truncate">
          {step.action_type}
        </span>
        {step.node_id && (
          <span className="text-[10px] font-mono text-iris-secondary bg-iris-surface px-2 py-0.5 border border-iris-border-strong shrink-0">
            {step.node_id}
          </span>
        )}
        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border ${s.color} ${s.bg} ${s.border} shrink-0`}>
          {step.status}
        </span>
        <span className="text-[10px] text-iris-secondary font-mono shrink-0">
          {duration(step.started_at, step.finished_at)}
        </span>
        {open ? (
          <ChevronDown className="w-3 h-3 text-iris-border-strong shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-iris-border-strong shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-iris-border-strong space-y-3">
          {step.error_message && (
            <div className="bg-iris-error/10 border border-iris-error/30 p-3 text-xs font-mono text-iris-error">
              {step.error_message}
            </div>
          )}

          {step.input && Object.keys(step.input).length > 0 && (
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-iris-secondary mb-1">Input</div>
              <pre className="text-[11px] font-mono text-iris-secondary bg-iris-surface border border-iris-border-strong p-3 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(step.input, null, 2)}
              </pre>
            </div>
          )}

          {step.output && Object.keys(step.output).length > 0 && (
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-iris-secondary mb-1">Output</div>
              <pre className="text-[11px] font-mono text-iris-accent bg-iris-surface border border-iris-accent/20 p-3 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(step.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Execution Row ────────────────────────────────────────────────────────────

function ExecutionRow({ exec, relayId }: { exec: api.Execution; relayId: string }) {
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<api.ExecutionStep[] | null>(null);
  const [loadingSteps, setLoadingSteps] = useState(false);
  const s = STATUS_STYLE[exec.status] ?? STATUS_STYLE.pending;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && steps === null) {
      setLoadingSteps(true);
      try {
        const result = await api.getExecutionSteps(exec.id);
        setSteps(result);
      } catch {
        setSteps([]);
      } finally {
        setLoadingSteps(false);
      }
    }
  }

  return (
    <div className="border border-iris-border-strong bg-iris-surface">
      {/* Summary row */}
      <button
        onClick={toggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-iris-elevated transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-iris-border-strong shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-iris-border-strong shrink-0" />
        )}

        <span className={`shrink-0 ${s.color}`}>{s.icon}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border ${s.color} ${s.bg} ${s.border}`}>
              {exec.status}
            </span>
            <span className="text-[10px] font-mono text-iris-secondary truncate">{exec.id}</span>
          </div>
          <div className="text-[10px] text-iris-muted mt-0.5">{timestamp(exec.started_at)}</div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-xs font-mono text-iris-secondary">
            {duration(exec.started_at, exec.finished_at ?? undefined)}
          </div>
          {exec.event_id && (
            <div className="text-[9px] text-iris-muted font-mono mt-0.5 truncate max-w-[120px]">
              evt: {exec.event_id.slice(0, 8)}…
            </div>
          )}
        </div>
      </button>

      {/* Error at execution level */}
      {exec.error_message && (
        <div className="mx-4 mb-2 bg-iris-error/10 border border-iris-error/30 p-2 text-xs font-mono text-iris-error">
          {exec.error_message}
        </div>
      )}

      {/* Steps */}
      {open && (
        <div className="border-t border-iris-border-strong px-4 py-3 space-y-2">
          <div className="text-[9px] font-black uppercase tracking-widest text-iris-secondary mb-2 flex items-center gap-2">
            <Terminal className="w-3 h-3" /> Execution Steps
          </div>
          {loadingSteps ? (
            <div className="flex items-center gap-2 text-iris-secondary text-xs py-3">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading steps…
            </div>
          ) : steps && steps.length === 0 ? (
            <div className="text-xs text-iris-muted py-2">No steps recorded.</div>
          ) : (
            steps?.map((step) => <StepRow key={step.id} step={step} />)
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Logs Panel ──────────────────────────────────────────────────────────

export function RelayLogs({ relay, onBack }: RelayLogsProps) {
  const [executions, setExecutions] = useState<api.Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api.getExecutions(relay.id);
      setExecutions(result ?? []);
    } catch {
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  }, [relay.id]);

  useEffect(() => {
    load();
    // Poll every 5s so running executions auto-update
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function triggerNow() {
    setTriggering(true);
    try {
      await api.triggerRelay(relay.id);
      setTimeout(load, 800);
    } catch { /* silent */ } finally {
      setTriggering(false);
    }
  }

  const successCount = executions.filter((e) => e.status === "success").length;
  const failedCount = executions.filter((e) => e.status === "failed").length;
  const runningCount = executions.filter((e) => e.status === "running").length;

  return (
    <div className="flex flex-col h-full space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div className="border-b border-iris-border-strong pb-4 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-iris-secondary hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Relay Matrix
          </button>
          <div className="w-px h-5 bg-iris-border-strong" />
          <div>
            <h1 className="text-lg font-black tracking-widest text-white uppercase">{relay.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] font-mono text-iris-secondary uppercase tracking-widest">
                {relay.trigger_type}
              </span>
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border ${
                relay.is_active
                  ? "text-iris-success bg-iris-success/10 border-iris-success/30"
                  : "text-iris-warning bg-iris-warning/10 border-iris-warning/30"
              }`}>
                {relay.is_active ? "ACTIVE" : "IDLE"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 border border-iris-border-strong text-iris-secondary text-xs font-bold hover:border-iris-accent hover:text-iris-accent transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={triggerNow}
            disabled={triggering}
            className="flex items-center gap-1.5 px-3 py-2 bg-iris-accent text-black text-xs font-black uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-50"
          >
            {triggering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Run Now
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Runs", value: executions.length, color: "text-white" },
          { label: "Success", value: successCount, color: "text-iris-success" },
          { label: "Failed", value: failedCount, color: "text-iris-error" },
          { label: "Running", value: runningCount, color: "text-iris-accent-sub" },
        ].map(({ label, value, color }) => (
          <div key={label} className="border border-iris-border-strong bg-iris-surface p-3">
            <div className={`text-xl font-black font-mono ${color}`}>{value}</div>
            <div className="text-[9px] font-black uppercase tracking-widest text-iris-secondary mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Execution list */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2">
        {loading ? (
          <div className="flex items-center gap-3 text-iris-secondary text-sm py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading executions…
          </div>
        ) : executions.length === 0 ? (
          <div className="text-center py-16 border border-iris-border-strong bg-iris-surface">
            <Terminal className="w-10 h-10 text-iris-border-strong mx-auto mb-3" />
            <p className="text-sm text-iris-secondary mb-4">No executions yet.</p>
            <p className="text-xs text-iris-muted">
              {relay.trigger_type === "cron"
                ? "The cron scheduler will fire this relay on its next scheduled run."
                : 'Click "Run Now" to trigger a test execution.'}
            </p>
          </div>
        ) : (
          executions.map((exec) => (
            <ExecutionRow key={exec.id} exec={exec} relayId={relay.id} />
          ))
        )}
      </div>
    </div>
  );
}
