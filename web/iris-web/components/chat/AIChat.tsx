"use client";

import {
  Terminal, Send, Cpu, User, Loader2, Rocket, RefreshCw,
  GitBranch, Zap, Clock, Play, CheckCircle2,
  ChevronDown, ChevronUp, X, Pencil, Mic, MicOff, Copy, CheckCircle, Link,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import * as api from "@/lib/api";

// ─── Web Speech API types (not in lib.dom.d.ts for older TS targets) ──────────
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

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


// ─── Webhook URL box ─────────────────────────────────────────────────────────

function WebhookUrlBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="border border-iris-accent/30 bg-iris-accent/5 p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-iris-accent">
          <Link className="w-2.5 h-2.5" /> Webhook URL
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 border transition-colors"
          style={{
            color: copied ? "var(--iris-success)" : "var(--iris-accent-core)",
            borderColor: "rgba(16,185,129,0.3)",
            background: copied ? "rgba(16,185,129,0.1)" : "transparent",
          }}
        >
          {copied ? <CheckCircle className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <code className="block text-[9px] font-mono text-iris-accent break-all select-all leading-relaxed">
        {url}
      </code>
      <div className="text-[8px] text-iris-muted">POST to this URL to trigger the relay.</div>
    </div>
  );
}

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
    const webhookUrl = spec.trigger_type === "webhook" && deployedRelayId
      ? `http://localhost:8080/hooks/${deployedRelayId}`
      : null;

    return (
      <div className="mt-3 border border-iris-success/40 bg-iris-success/5 p-3 space-y-2">
        <div className="flex items-center gap-2 text-iris-success text-[10px] font-black uppercase tracking-widest">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {isUpdate ? "Relay updated" : "Relay deployed"}
        </div>
        {deployedRelayId && (
          <div className="text-[9px] font-mono text-iris-secondary">
            ID: <span className="text-white">{deployedRelayId}</span>
          </div>
        )}
        {webhookUrl && (
          <WebhookUrlBox url={webhookUrl} />
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


// ─── Default messages ─────────────────────────────────────────────────────────

const DEFAULT_MESSAGES: ChatMessage[] = [{
  role: "assistant",
  content: "System initialized. Describe the workflow you want to automate.\n\nTo edit an existing relay, select it from the dropdown — or just ask me by name.",
}];

// ─── Voice input hook ─────────────────────────────────────────────────────────

type VoiceState = "idle" | "listening" | "transcribing";

function useVoiceInput(onResult: (text: string) => void) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  // interimText: what the recogniser is still processing (unsettled)
  const [interimText, setInterimText] = useState("");
  // transcriptSoFar: words the recogniser has committed this session
  const [transcriptSoFar, setTranscriptSoFar] = useState("");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const shouldRestartRef = useRef(false); // keeps recognition alive through silence

  const hasSpeechAPI = typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const stopAll = useCallback(() => {
    shouldRestartRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current?.stop();
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setInterimText("");
    setTranscriptSoFar("");
    setVoiceState("idle");
  }, []);

  const startRecognition = useCallback((accumulatedSoFar: string) => {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) return;
    const SpeechRec = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const rec = new SpeechRec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      let finalChunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalChunk += t;
        else interim += t;
      }
      if (interim) setInterimText(interim);
      if (finalChunk) {
        const newAccum = (accumulatedSoFar + " " + finalChunk).trim();
        accumulatedSoFar = newAccum; // update local var for closure
        setTranscriptSoFar(newAccum);
        setInterimText("");
      }
    };

    rec.onerror = (e: Event) => {
      // "no-speech" is normal — just let onend restart it
      const err = (e as Event & { error?: string }).error;
      if (err === "not-allowed" || err === "service-not-allowed") {
        shouldRestartRef.current = false;
        setVoiceState("idle");
      }
    };

    rec.onend = () => {
      // If user hasn't manually stopped, restart to keep listening through silences
      if (shouldRestartRef.current) {
        startRecognition(accumulatedSoFar);
      } else {
        // User stopped — commit whatever we have
        if (accumulatedSoFar) onResult(accumulatedSoFar.trim());
        setInterimText("");
        setTranscriptSoFar("");
        setVoiceState("idle");
      }
    };

    recognitionRef.current = rec;
    rec.start();
  }, [onResult]);

  const startListening = useCallback(async () => {
    if (voiceState !== "idle") {
      // Stop and commit
      shouldRestartRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      return;
    }

    setTranscriptSoFar("");
    setInterimText("");

    // ── Strategy 1: Web Speech API ────────────────────────────────────────
    if (hasSpeechAPI) {
      shouldRestartRef.current = true;
      setVoiceState("listening");
      startRecognition("");
      return;
    }

    // ── Strategy 2: MediaRecorder → ElevenLabs ────────────────────────────
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      chunksRef.current = [];

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setVoiceState("transcribing");
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const text = await api.transcribeAudio(blob);
          if (text) onResult(text.trim());
        } catch { /* silent */ }
        finally { setVoiceState("idle"); setInterimText(""); setTranscriptSoFar(""); }
      };

      mr.start();
      mediaRecorderRef.current = mr;
      setVoiceState("listening");
    } catch {
      setVoiceState("idle");
    }
  }, [voiceState, hasSpeechAPI, startRecognition, onResult]);

  // Clean up on unmount
  useEffect(() => () => { shouldRestartRef.current = false; stopAll(); }, [stopAll]);

  return { voiceState, interimText, transcriptSoFar, startListening, stopAll, hasSpeechAPI };
}

// ─── Main AIChat ──────────────────────────────────────────────────────────────

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

  // ── Voice input ───────────────────────────────────────────────────────────
  const handleVoiceResult = useCallback((text: string) => {
    setInput(prev => (prev ? prev + " " + text : text));
    inputRef.current?.focus();
  }, []);

  const { voiceState, interimText, transcriptSoFar, startListening, stopAll, hasSpeechAPI } = useVoiceInput(handleVoiceResult);

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
      ? { role: "assistant", content: `Editing mode: "${relay?.name ?? relayId}"\n\nWhat would you like to change?` }
      : { role: "assistant", content: "Switched to create mode. Describe the workflow you want to automate." };
    setMessages([newMsg]);
  }, [relays]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;
    stopAll(); // stop any active recording before sending
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
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

      const targetRelayId = res.relay_id || selectedRelayId || undefined;
      const assistantMsg: ChatMessage = {
        role: "assistant", content: replyText,
        relaySpec: res.ready && res.relay ? res.relay : null, targetRelayId,
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
      setMessages(prev => [...prev, { role: "assistant", content: isQuota
        ? "⚠ AI is temporarily rate-limited. Please wait a minute and try again."
        : `⚠ ${raw}` }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, conversation, selectedRelayId, stopAll]);

  // ── Deploy / Update ────────────────────────────────────────────────────────
  const handleDeploy = useCallback(async (msg: ChatMessage) => {
    if (!msg.relaySpec) return;
    setDeploying(true);
    try {
      let resultId: string;
      if (msg.targetRelayId) {
        await api.updateRelay(msg.targetRelayId, {
          name: msg.relaySpec.name, description: msg.relaySpec.description,
          trigger_type: msg.relaySpec.trigger_type, trigger_config: msg.relaySpec.trigger_config,
        });
        await api.updateRelayActions(msg.targetRelayId, msg.relaySpec.actions, msg.relaySpec.edges);
        resultId = msg.targetRelayId;
        const updateLines = [`🔄 "${msg.relaySpec!.name}" updated successfully!`];
        if (msg.relaySpec.trigger_type === "webhook") {
          updateLines.push(`🔗 Webhook URL: http://localhost:8080/hooks/${resultId}`);
          updateLines.push(`Point your external service to this URL.`);
        }
        setMessages(prev => [...prev, {
          role: "assistant",
          content: updateLines.join("\n"),
        }]);
      } else {
        const created = await api.createRelay(msg.relaySpec);
        resultId = created.id;
        const createLines = [`🚀 "${created.name}" deployed!`];
        if (created.trigger_type === "webhook") {
          createLines.push(``);
          createLines.push(`🔗 Webhook URL:`);
          createLines.push(`http://localhost:8080/hooks/${resultId}`);
          createLines.push(``);
          createLines.push(`👆 Copy this URL and paste it into your external service (GitHub → Settings → Webhooks, Stripe → Developers → Webhooks, etc.)`);
        } else {
          createLines.push(`Find it in Relay Matrix.`);
        }
        setMessages(prev => [...prev, {
          role: "assistant",
          content: createLines.join("\n"),
        }]);
      }
      setMessages(prev => prev.map(m => m === msg ? { ...m, deployed: true, deployedRelayId: resultId, error: undefined } : m));
      window.dispatchEvent(new CustomEvent("iris:relay-changed"));
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
    stopAll();
    setConversation([]);
    setSelectedRelayId("");
    setMessages(DEFAULT_MESSAGES);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ok */ }
  }, [stopAll]);

  const selectedRelay = relays.find(r => r.id === selectedRelayId);
  const isRecording = voiceState === "listening";
  const isTranscribing = voiceState === "transcribing";
  // The live display text: committed words + italic interim
  const liveTranscript = transcriptSoFar
    ? interimText ? `${transcriptSoFar} ${interimText}` : transcriptSoFar
    : interimText;

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

        {/* ── Voice streaming panel ─────────────────────────────────── */}
        {isRecording && (
          <div className="mb-2 border border-red-500/50 bg-red-500/5">
            {/* Header row */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-red-500/30">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-red-400">
                  {hasSpeechAPI ? "Live Transcription" : "Recording"}
                </span>
              </div>
              <button
                onClick={stopAll}
                className="text-[9px] font-mono text-red-400/70 hover:text-red-300 transition-colors"
              >
                stop & use ↵
              </button>
            </div>
            {/* Transcript area */}
            <div className="px-3 py-2.5 min-h-[40px] max-h-[120px] overflow-y-auto">
              {liveTranscript ? (
                <p className="text-sm font-mono text-white leading-relaxed">
                  {/* committed words */}
                  <span>{transcriptSoFar}</span>
                  {/* interim words — dimmer */}
                  {interimText && (
                    <span className="text-white/50"> {interimText}</span>
                  )}
                  {/* blinking cursor */}
                  <span className="inline-block w-[2px] h-[1em] bg-red-400 ml-0.5 align-middle animate-pulse" />
                </p>
              ) : (
                <p className="text-xs font-mono text-red-400/60 italic">
                  {hasSpeechAPI ? "Speak now — text will appear here…" : "Recording in progress…"}
                </p>
              )}
            </div>
          </div>
        )}

        {isTranscribing && (
          <div className="mb-2 border border-iris-accent/40 bg-iris-accent/5 px-3 py-2 flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin text-iris-accent shrink-0" />
            <span className="text-[10px] font-mono text-iris-accent">Sending to ElevenLabs for transcription…</span>
          </div>
        )}

        <div className="relative flex items-center gap-2">
          <span className="absolute left-3 text-iris-accent text-sm font-black select-none z-10">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={
              isRecording
                ? liveTranscript ? "(recording — see panel above)" : "Speak now…"
                : isTranscribing ? "Transcribing…"
                : selectedRelayId ? "What would you like to change?"
                : "Describe your workflow…"
            }
            disabled={loading || isTranscribing || isRecording}
            className={`w-full bg-iris-base border text-white text-xs font-mono tracking-wide pl-8 pr-20 py-3 focus:outline-none transition-colors disabled:opacity-60 placeholder:text-iris-muted ${
              isRecording ? "border-red-500/60 opacity-60 cursor-not-allowed" : "border-iris-border-strong focus:border-iris-accent"
            }`}
          />
          {/* Mic button */}
          <button
            onClick={isRecording ? stopAll : startListening}
            disabled={loading || isTranscribing}
            title={isRecording ? "Stop recording" : "Record voice (streaming)"}
            className={`absolute right-9 transition-colors disabled:opacity-30 ${
              isRecording
                ? "text-red-400 hover:text-red-300"
                : "text-iris-border-strong hover:text-iris-accent"
            }`}
          >
            {isRecording
              ? <MicOff className="w-3.5 h-3.5" />
              : <Mic className="w-3.5 h-3.5" />
            }
          </button>
          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={loading || !input.trim() || isTranscribing}
            className="absolute right-3 text-iris-secondary hover:text-iris-accent transition-colors disabled:opacity-30"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-1.5 text-[9px] text-iris-muted font-mono">
          {isRecording
            ? hasSpeechAPI
              ? "🔴 Live STT — words stream above · click mic or ↵ to confirm"
              : "🔴 Recording · click mic to stop and transcribe"
            : isTranscribing
              ? "⏳ ElevenLabs processing…"
              : selectedRelayId
                ? "Edit mode · AI will update the selected relay"
                : "Create mode · AI builds and deploys your relay"}
        </div>
      </div>
    </div>
  );
}

