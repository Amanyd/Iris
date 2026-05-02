"use client";

import {
  Terminal, Send, Cpu, User, Loader2, Rocket, RefreshCw,
  GitBranch, Zap, Clock, Play, CheckCircle2,
  ChevronDown, ChevronUp, X, Pencil,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import * as api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
  relaySpec?: api.CreateRelayRequest | null;
  targetRelayId?: string;
  deployed?: boolean;
  deployedRelayId?: string;
  error?: string;
}

interface PersistedState {
  messages: ChatMessage[];
  conversation: api.AIMessage[];
  selectedRelayId: string;
}

const STORAGE_KEY = "iris_ai_chat_state";

function saveState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota exceeded — ignore */ }
}

function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TRIGGER_ICON: Record<string, React.ReactNode> = {
  webhook: <Zap className="w-3 h-3" />,
  cron:    <Clock className="w-3 h-3" />,
  manual:  <Play className="w-3 h-3" />,
};

// ─── Relay Preview Card ───────────────────────────────────────────────────────

function RelayPreviewCard({
  spec, isUpdate, deployed, deployedRelayId, deployError, onDeploy, deploying,
}: {
  spec: api.CreateRelayRequest;
  isUpdate: boolean;
  deployed: boolean;
  deployedRelayId?: string;
  deployError?: string;
  onDeploy: () => void;
  deploying: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (deployed) {
    return (
      <div className="mt-3 border border-iris-success/40 bg-iris-success/5 p-3 space-y-1">
        <div className="flex items-center gap-2 text-iris-success text-[10px] font-black uppercase tracking-widest">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {isUpdate ? "Relay updated" : "Relay deployed"}
        </div>
        {deployedRelayId && (
          <div className="text-[9px] font-mono text-iris-secondary">
            ID: <span className="text-white">{deployedRelayId}</span>
          </div>
        )}
        <div className="text-[9px] text-iris-muted">Check <span className="text-iris-accent">Relay Matrix</span> to view it.</div>
      </div>
    );
  }

  return (
    <div className="mt-3 border border-iris-accent/30 bg-iris-accent/5">
      <div className="flex items-center justify-between px-3 py-2 border-b border-iris-accent/20">
        <div className="flex items-center gap-2">
          {isUpdate
            ? <Pencil className="w-3.5 h-3.5 text-iris-warning" />
            : <GitBranch className="w-3.5 h-3.5 text-iris-accent" />}
          <span className="text-[10px] font-black text-white uppercase tracking-widest truncate max-w-[120px]" title={spec.name}>
            {spec.name}
          </span>
          {isUpdate && (
            <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 border border-iris-warning/40 text-iris-warning bg-iris-warning/10">
              UPDATE
            </span>
          )}
        </div>
        <button onClick={() => setExpanded(v => !v)} className="text-iris-border-strong hover:text-iris-secondary transition-colors">
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      <div className="px-3 py-2 flex items-center gap-3 text-[9px] font-mono text-iris-secondary">
        <span className="flex items-center gap-1 text-iris-accent-sub">
          {TRIGGER_ICON[spec.trigger_type] ?? <Play className="w-3 h-3" />}
          {spec.trigger_type}
        </span>
        <span>·</span>
        <span>{spec.actions.length} action{spec.actions.length !== 1 ? "s" : ""}</span>
        {spec.edges.length > 0 && <><span>·</span><span>{spec.edges.length} edge{spec.edges.length !== 1 ? "s" : ""}</span></>}
      </div>

      {expanded && (
        <div className="px-3 pb-2 space-y-1 border-t border-iris-border-strong/40 pt-2">
          {spec.description && <div className="text-[9px] text-iris-secondary pb-1">{spec.description}</div>}
          <div className="text-[8px] font-black text-iris-secondary uppercase tracking-widest mb-1">Actions</div>
          {spec.actions.map(a => (
            <div key={a.node_id} className="flex items-center gap-2 text-[9px] font-mono">
              <span className="text-iris-border-strong shrink-0">{a.node_id}</span>
              <span className="text-iris-accent">{a.action_type}</span>
            </div>
          ))}
          {spec.edges.length > 0 && (
            <>
              <div className="text-[8px] font-black text-iris-secondary uppercase tracking-widest mt-2 mb-1">Edges</div>
              {spec.edges.map((e, i) => (
                <div key={i} className="flex items-center gap-1 text-[9px] font-mono text-iris-secondary">
                  <span className="text-white">{e.parent_node_id}</span>
                  <span>→</span>
                  <span className="text-white">{e.child_node_id}</span>
                  {e.condition && <span className="text-iris-accent-sub ml-1">[{JSON.stringify(e.condition)}]</span>}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {deployError && (
        <div className="px-3 pb-2 text-[9px] font-mono text-iris-error">⚠ {deployError}</div>
      )}

      <div className="px-3 pb-3">
        <button
          onClick={onDeploy}
          disabled={deploying}
          className={`w-full flex items-center justify-center gap-2 py-2 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-50 ${
            isUpdate ? "bg-iris-warning text-black hover:bg-white" : "bg-iris-accent text-black hover:bg-white"
          }`}
        >
          {deploying ? <Loader2 className="w-3 h-3 animate-spin" /> : isUpdate ? <Pencil className="w-3 h-3" /> : <Rocket className="w-3 h-3" />}
          {deploying ? (isUpdate ? "Updating…" : "Deploying…") : isUpdate ? "Update Relay" : "Deploy Relay"}
        </button>
      </div>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg, onDeploy, deploying,
}: {
  msg: ChatMessage;
  onDeploy: (msg: ChatMessage) => void;
  deploying: boolean;
}) {
  const isAssistant = msg.role === "assistant";
  return (
    <div className={`flex gap-2 ${isAssistant ? "" : "flex-row-reverse"}`}>
      <div className={`w-6 h-6 shrink-0 flex items-center justify-center border ${
        isAssistant ? "border-iris-accent bg-iris-accent/10 text-iris-accent" : "border-iris-secondary bg-iris-surface text-iris-secondary"
      }`}>
        {isAssistant ? <Terminal className="w-3 h-3" /> : <User className="w-3 h-3" />}
      </div>
      <div className={`max-w-[85%] ${isAssistant ? "" : "items-end flex flex-col"}`}>
        <div className={`p-3 text-xs font-mono leading-relaxed border whitespace-pre-wrap ${
          isAssistant ? "border-iris-border-strong bg-iris-surface text-white" : "border-iris-border-strong bg-iris-base text-iris-secondary"
        }`}>
          {msg.content}
        </div>
        {isAssistant && msg.relaySpec && (
          <RelayPreviewCard
            spec={msg.relaySpec}
            isUpdate={!!msg.targetRelayId}
            deployed={!!msg.deployed}
            deployedRelayId={msg.deployedRelayId}
            deployError={msg.error}
            deploying={deploying}
            onDeploy={() => onDeploy(msg)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main AIChat ──────────────────────────────────────────────────────────────

const DEFAULT_MESSAGES: ChatMessage[] = [{
  role: "assistant",
  content: "System initialized. Describe the workflow you want to automate.\n\nTo edit an existing relay, select it from the dropdown — or just ask me by name.",
}];

export function AIChat() {
  // ── State — initialised from localStorage if available ────────────────────
  const [hydrated, setHydrated] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(DEFAULT_MESSAGES);
  const [conversation, setConversation] = useState<api.AIMessage[]>([]);
  const [selectedRelayId, setSelectedRelayId] = useState("");

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [relays, setRelays] = useState<api.Relay[]>([]);
  const [loadingRelays, setLoadingRelays] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Hydrate from localStorage on first mount ───────────────────────────────
  useEffect(() => {
    const saved = loadState();
    if (saved) {
      setMessages(saved.messages);
      setConversation(saved.conversation);
      setSelectedRelayId(saved.selectedRelayId);
    }
    setHydrated(true);
  }, []);

  // ── Persist to localStorage whenever key state changes ────────────────────
  useEffect(() => {
    if (!hydrated) return;
    saveState({ messages, conversation, selectedRelayId });
  }, [hydrated, messages, conversation, selectedRelayId]);

  // ── Auto-scroll on new messages ───────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // ── Load relays for selector ───────────────────────────────────────────────
  const loadRelays = useCallback(async () => {
    setLoadingRelays(true);
    try { setRelays(await api.getRelays() ?? []); }
    catch { /* silent */ }
    finally { setLoadingRelays(false); }
  }, []);

  useEffect(() => { loadRelays(); }, [loadRelays]);

  // ── Relay selector change ─────────────────────────────────────────────────
  const handleRelaySelect = useCallback((relayId: string) => {
    setSelectedRelayId(relayId);
    setConversation([]);
    const relay = relays.find(r => r.id === relayId);
    const newMsg: ChatMessage = relayId
      ? {
          role: "assistant",
          content: `Editing mode: "${relay?.name ?? relayId}"\n\nWhat would you like to change?`,
        }
      : {
          role: "assistant",
          content: "Switched to create mode. Describe the workflow you want to automate.",
        };
    setMessages([newMsg]);
  }, [relays]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    const newUserMsg: ChatMessage = { role: "user", content: userMsg };
    setMessages(prev => [...prev, newUserMsg]);
    setLoading(true);

    try {
      const res = await api.generateRelay(userMsg, conversation, selectedRelayId || undefined);

      let replyText = res.message ?? "";
      if (res.questions?.length) {
        replyText += "\n\nI need a bit more info:\n" + res.questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
      }
      if (res.ready && res.relay) {
        const isEdit = !!(res.relay_id || selectedRelayId);
        replyText += (replyText ? "\n\n" : "") + (isEdit
          ? `✅ Here are the updated changes for "${res.relay.name}":`
          : `✅ Workflow ready!\n"${res.relay.name}"`);
      }
      if (!replyText) replyText = "Ready. What would you like to automate?";

      // Resolve final target relay id:
      // AI response relay_id > explicit selector relay_id > none (create)
      const targetRelayId = res.relay_id || selectedRelayId || undefined;

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: replyText,
        relaySpec: res.ready && res.relay ? res.relay : null,
        targetRelayId,
      };

      setMessages(prev => [...prev, assistantMsg]);
      setConversation(prev => [
        ...prev,
        { role: "user" as const, content: userMsg },
        { role: "assistant" as const, content: replyText },
      ]);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Request failed";
      const isQuota = raw.includes("quota") || raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED");
      const errMsg = isQuota
        ? "⚠ AI is temporarily rate-limited. Please wait a minute and try again."
        : `⚠ ${raw}`;
      setMessages(prev => [...prev, { role: "assistant", content: errMsg }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, conversation, selectedRelayId]);

  // ── Deploy / Update ────────────────────────────────────────────────────────
  const handleDeploy = useCallback(async (msg: ChatMessage) => {
    if (!msg.relaySpec) return;
    setDeploying(true);
    try {
      let resultId: string;

      if (msg.targetRelayId) {
        // UPDATE
        await api.updateRelay(msg.targetRelayId, {
          name: msg.relaySpec.name,
          description: msg.relaySpec.description,
          trigger_type: msg.relaySpec.trigger_type,
          trigger_config: msg.relaySpec.trigger_config,
        });
        await api.updateRelayActions(msg.targetRelayId, msg.relaySpec.actions, msg.relaySpec.edges);
        resultId = msg.targetRelayId;
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `🔄 "${msg.relaySpec!.name}" updated successfully!`,
        }]);
      } else {
        // CREATE
        const created = await api.createRelay(msg.relaySpec);
        resultId = created.id;
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `🚀 "${created.name}" deployed! Find it in Relay Matrix.`,
        }]);
      }

      setMessages(prev => prev.map(m =>
        m === msg ? { ...m, deployed: true, deployedRelayId: resultId, error: undefined } : m
      ));

      // Notify relay matrix to refresh instantly
      window.dispatchEvent(new CustomEvent("iris:relay-changed"));
      // Also refresh the selector
      loadRelays();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Operation failed";
      setMessages(prev => prev.map(m => m === msg ? { ...m, error: errMsg } : m));
    } finally {
      setDeploying(false);
    }
  }, [loadRelays]);

  // ── Clear ─────────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setConversation([]);
    setSelectedRelayId("");
    setMessages(DEFAULT_MESSAGES);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ok */ }
  }, []);

  const selectedRelay = relays.find(r => r.id === selectedRelayId);

  return (
    <div className="flex flex-col h-full border border-iris-border-strong bg-iris-base">
      {/* Header */}
      <div className="h-12 border-b border-iris-border-strong bg-iris-surface flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2 text-iris-accent text-xs font-bold tracking-widest uppercase">
          <Cpu className="w-4 h-4" />
          <span>Iris_AI</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-iris-success rounded-full animate-pulse" />
            <span className="text-[9px] text-iris-secondary tracking-widest uppercase">Online</span>
          </div>
          <button onClick={handleClear} title="Clear conversation" className="text-iris-border-strong hover:text-iris-secondary transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Relay selector */}
      <div className="px-3 py-2 border-b border-iris-border-strong bg-iris-surface/50 shrink-0">
        <div className="flex items-center gap-2">
          <Pencil className="w-3 h-3 text-iris-secondary shrink-0" />
          <select
            value={selectedRelayId}
            onChange={e => handleRelaySelect(e.target.value)}
            className="flex-1 bg-iris-base border border-iris-border-strong text-[10px] font-mono text-iris-secondary px-2 py-1.5 focus:outline-none focus:border-iris-accent transition-colors appearance-none cursor-pointer"
          >
            <option value="">✨ Create new relay…</option>
            {relays.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button onClick={loadRelays} disabled={loadingRelays} className="text-iris-border-strong hover:text-iris-secondary transition-colors shrink-0" title="Refresh">
            <RefreshCw className={`w-3 h-3 ${loadingRelays ? "animate-spin" : ""}`} />
          </button>
        </div>
        {selectedRelay && (
          <div className="mt-1 flex items-center gap-2 text-[9px] font-mono text-iris-warning">
            <Pencil className="w-2.5 h-2.5" />
            Editing: <span className="text-white">{selectedRelay.name}</span>
            <span className="text-iris-border-strong">· {selectedRelay.trigger_type}</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/40 min-h-0">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} onDeploy={handleDeploy} deploying={deploying} />
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 shrink-0 flex items-center justify-center border border-iris-accent bg-iris-accent/10 text-iris-accent">
              <Loader2 className="w-3 h-3 animate-spin" />
            </div>
            <div className="p-3 text-xs font-mono border border-iris-border-strong bg-iris-surface text-iris-secondary animate-pulse">
              Thinking…
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-iris-border-strong bg-iris-surface shrink-0">
        <div className="relative flex items-center">
          <span className="absolute left-3 text-iris-accent text-sm font-black select-none">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={selectedRelayId ? "What would you like to change?" : "Describe your workflow…"}
            disabled={loading}
            className="w-full bg-iris-base border border-iris-border-strong text-white text-xs font-mono tracking-wide pl-8 pr-10 py-3 focus:outline-none focus:border-iris-accent transition-colors disabled:opacity-50 placeholder:text-iris-muted"
          />
          <button onClick={handleSend} disabled={loading || !input.trim()} className="absolute right-3 text-iris-secondary hover:text-iris-accent transition-colors disabled:opacity-30">
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-1.5 text-[9px] text-iris-muted font-mono">
          {selectedRelayId ? "Edit mode · AI will update the selected relay" : "Create mode · AI builds and deploys your relay"}
        </div>
      </div>
    </div>
  );
}
