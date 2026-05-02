"use client";

import {
  Terminal, Send, Cpu, User, Loader2, Rocket,
  GitBranch, Zap, Clock, Play, CheckCircle2,
  ChevronDown, ChevronUp, X,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import * as api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
  relaySpec?: api.CreateRelayRequest | null; // attached when AI is ready
  deployed?: boolean;                        // true after successful deploy
  deployedRelayId?: string;                  // relay ID after deploy
  error?: string;                            // deploy error
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TRIGGER_ICON: Record<string, React.ReactNode> = {
  webhook: <Zap className="w-3 h-3" />,
  cron:    <Clock className="w-3 h-3" />,
  manual:  <Play className="w-3 h-3" />,
};

function triggerLabel(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ─── Relay Preview Card ───────────────────────────────────────────────────────

function RelayPreviewCard({
  spec,
  deployed,
  deployedRelayId,
  deployError,
  onDeploy,
  deploying,
}: {
  spec: api.CreateRelayRequest;
  deployed: boolean;
  deployedRelayId?: string;
  deployError?: string;
  onDeploy: () => void;
  deploying: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (deployed) {
    return (
      <div className="mt-3 border border-iris-success/40 bg-iris-success/5 p-3 space-y-2">
        <div className="flex items-center gap-2 text-iris-success text-[10px] font-black uppercase tracking-widest">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Relay deployed successfully
        </div>
        {deployedRelayId && (
          <div className="text-[9px] font-mono text-iris-secondary">
            ID: <span className="text-white">{deployedRelayId}</span>
          </div>
        )}
        <div className="text-[9px] text-iris-muted">
          Navigate to <span className="text-iris-accent">Relay Matrix</span> to view and trigger it.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 border border-iris-accent/30 bg-iris-accent/5">
      {/* Card header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-iris-accent/20">
        <div className="flex items-center gap-2">
          <GitBranch className="w-3.5 h-3.5 text-iris-accent" />
          <span className="text-[10px] font-black text-white uppercase tracking-widest truncate max-w-[120px]" title={spec.name}>
            {spec.name}
          </span>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-iris-border-strong hover:text-iris-secondary transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Summary row */}
      <div className="px-3 py-2 flex items-center gap-3 text-[9px] font-mono text-iris-secondary">
        <span className="flex items-center gap-1 text-iris-accent-sub">
          {TRIGGER_ICON[spec.trigger_type] ?? <Play className="w-3 h-3" />}
          {triggerLabel(spec.trigger_type)}
        </span>
        <span>·</span>
        <span>{spec.actions.length} action{spec.actions.length !== 1 ? "s" : ""}</span>
        {spec.edges.length > 0 && (
          <>
            <span>·</span>
            <span>{spec.edges.length} edge{spec.edges.length !== 1 ? "s" : ""}</span>
          </>
        )}
      </div>

      {/* Expanded action list */}
      {expanded && (
        <div className="px-3 pb-2 space-y-1">
          {spec.description && (
            <div className="text-[9px] text-iris-secondary pb-1">{spec.description}</div>
          )}
          <div className="text-[8px] font-black text-iris-secondary uppercase tracking-widest mb-1">Actions</div>
          {spec.actions.map((a) => (
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
                  {e.condition && (
                    <span className="text-iris-accent-sub ml-1">
                      [{JSON.stringify(e.condition)}]
                    </span>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Error */}
      {deployError && (
        <div className="px-3 pb-2 text-[9px] font-mono text-iris-error">
          ⚠ {deployError}
        </div>
      )}

      {/* Deploy button */}
      <div className="px-3 pb-3">
        <button
          onClick={onDeploy}
          disabled={deploying}
          className="w-full flex items-center justify-center gap-2 py-2 bg-iris-accent text-black text-[10px] font-black uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-50"
        >
          {deploying ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Rocket className="w-3 h-3" />
          )}
          {deploying ? "Deploying…" : "Deploy Relay"}
        </button>
      </div>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  onDeploy,
  deploying,
}: {
  msg: ChatMessage;
  onDeploy: (spec: api.CreateRelayRequest, msgIndex: number) => void;
  deploying: boolean;
  msgIndex: number;
}) {
  const isAssistant = msg.role === "assistant";

  return (
    <div className={`flex gap-2 ${isAssistant ? "" : "flex-row-reverse"}`}>
      {/* Avatar */}
      <div
        className={`w-6 h-6 shrink-0 flex items-center justify-center border ${
          isAssistant
            ? "border-iris-accent bg-iris-accent/10 text-iris-accent"
            : "border-iris-secondary bg-iris-surface text-iris-secondary"
        }`}
      >
        {isAssistant ? <Terminal className="w-3 h-3" /> : <User className="w-3 h-3" />}
      </div>

      {/* Content */}
      <div className={`max-w-[85%] ${isAssistant ? "" : "items-end flex flex-col"}`}>
        <div
          className={`p-3 text-xs font-mono leading-relaxed border whitespace-pre-wrap ${
            isAssistant
              ? "border-iris-border-strong bg-iris-surface text-white"
              : "border-iris-border-strong bg-iris-base text-iris-secondary"
          }`}
        >
          {msg.content}
        </div>

        {/* Relay preview when AI is ready */}
        {isAssistant && msg.relaySpec && (
          <RelayPreviewCard
            spec={msg.relaySpec}
            deployed={!!msg.deployed}
            deployedRelayId={msg.deployedRelayId}
            deployError={msg.error}
            deploying={deploying}
            onDeploy={() => onDeploy(msg.relaySpec!, 0)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main AIChat Component ────────────────────────────────────────────────────

export function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "System initialized. Describe the workflow you want to automate — I'll build it for you.\n\nExample: \"Every hour fetch the Bitcoin price and send a Discord alert if it's above $80,000\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [conversation, setConversation] = useState<api.AIMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Send user message ──────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await api.generateRelay(userMsg, conversation);

      // Build assistant reply text
      let replyText = res.message || "";
      if (res.questions && res.questions.length > 0) {
        replyText +=
          "\n\nI need a bit more info:\n" +
          res.questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
      }
      if (res.ready && res.relay) {
        replyText +=
          replyText ? "\n\n" : "";
        replyText += `✅ Workflow ready! Here's what I'll deploy:\n"${res.relay.name}"`;
      }
      if (!replyText) replyText = "Ready. What would you like to automate?";

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: replyText,
        relaySpec: res.ready && res.relay ? res.relay : null,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setConversation((prev) => [
        ...prev,
        { role: "user" as const, content: userMsg },
        { role: "assistant" as const, content: replyText },
      ]);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Request failed";
      const isQuota = raw.includes("quota") || raw.includes("429") || raw.includes("RESOURCE_EXHAUSTED");
      const isUnavail = raw.includes("LLM request failed") || raw.includes("unavailable");
      let errMsg = raw;
      if (isQuota) errMsg = "⚠ The AI is temporarily rate-limited (Gemini free tier quota). Please wait a minute and try again.";
      else if (isUnavail) errMsg = "⚠ AI module unavailable — LLM_API_KEY may not be configured on the server.";
      else errMsg = `⚠ ${raw}`;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errMsg,
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, conversation]);

  // ── Deploy a relay spec ────────────────────────────────────────────────────
  const handleDeploy = useCallback(
    async (spec: api.CreateRelayRequest, _msgIndex: number) => {
      setDeploying(true);
      try {
        const created = await api.createRelay(spec);
        // Mark the message with the relay as deployed
        setMessages((prev) =>
          prev.map((m) =>
            m.relaySpec === spec
              ? { ...m, deployed: true, deployedRelayId: created.id, error: undefined }
              : m,
          ),
        );
        // Append confirmation in chat
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `🚀 "${created.name}" has been deployed! Go to Relay Matrix to run it or check its logs.`,
          },
        ]);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Deploy failed";
        setMessages((prev) =>
          prev.map((m) =>
            m.relaySpec === spec ? { ...m, error: errMsg } : m,
          ),
        );
      } finally {
        setDeploying(false);
      }
    },
    [],
  );

  // ── Clear conversation ─────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setMessages([
      {
        role: "assistant",
        content:
          "Conversation cleared. Describe the workflow you want to automate.",
      },
    ]);
    setConversation([]);
    setInput("");
  }, []);

  return (
    <div className="flex flex-col h-full border border-iris-border-strong bg-iris-base relative">
      {/* Header */}
      <div className="h-12 border-b border-iris-border-strong bg-iris-surface flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2 text-iris-accent text-xs font-bold tracking-widest uppercase">
          <Cpu className="w-4 h-4" />
          <span>Iris_AI</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-iris-success rounded-full animate-pulse" />
            <span className="text-[9px] text-iris-secondary tracking-widest uppercase">Online</span>
          </div>
          <button
            onClick={handleClear}
            title="Clear conversation"
            className="text-iris-border-strong hover:text-iris-secondary transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Message History */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/40 min-h-0"
      >
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            msg={msg}
            msgIndex={i}
            onDeploy={handleDeploy}
            deploying={deploying}
          />
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 shrink-0 flex items-center justify-center border border-iris-accent bg-iris-accent/10 text-iris-accent">
              <Loader2 className="w-3 h-3 animate-spin" />
            </div>
            <div className="p-3 text-xs font-mono border border-iris-border-strong bg-iris-surface text-iris-secondary">
              <span className="animate-pulse">Thinking…</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-iris-border-strong bg-iris-surface shrink-0">
        <div className="relative flex items-center">
          <span className="absolute left-3 text-iris-accent text-sm font-black select-none">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Describe your workflow…"
            disabled={loading}
            className="w-full bg-iris-base border border-iris-border-strong text-white text-xs font-mono tracking-wide pl-8 pr-10 py-3 focus:outline-none focus:border-iris-accent transition-colors disabled:opacity-50 placeholder:text-iris-muted"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="absolute right-3 text-iris-secondary hover:text-iris-accent transition-colors disabled:opacity-30"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-1.5 text-[9px] text-iris-muted font-mono">
          Enter to send · AI builds your relay · Click Deploy to activate
        </div>
      </div>
    </div>
  );
}
