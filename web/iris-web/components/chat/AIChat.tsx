"use client";

import { Terminal, Send, Cpu, User, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import * as api from "@/lib/api";

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "system", content: "System initialized. How can I assist with your workflow orchestration today?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversation, setConversation] = useState<api.AIMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await api.generateRelay(userMsg, conversation);
      
      let reply = res.message || "";
      if (res.questions && res.questions.length > 0) {
        reply += "\n\nI need some clarification:\n" + res.questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
      }
      if (res.ready && res.relay) {
        reply += `\n\n✅ Relay "${res.relay.name}" is ready to deploy with ${res.relay.actions.length} action(s).`;
      }

      if (!reply) reply = "I received your message but couldn't generate a response. Please try again.";

      setMessages((prev) => [...prev, { role: "system", content: reply }]);
      setConversation((prev) => [
        ...prev,
        { role: "user" as const, content: userMsg },
        { role: "assistant" as const, content: reply },
      ]);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Request failed";
      setMessages((prev) => [
        ...prev,
        { role: "system", content: `⚠ Error: ${errMsg}. The AI module may be unavailable (LLM_API_KEY not configured).` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full border border-iris-border-strong bg-iris-base relative">
      {/* Header */}
      <div className="h-12 border-b border-iris-border-strong bg-iris-surface flex items-center justify-between px-4">
        <div className="flex items-center gap-2 text-iris-accent text-xs font-bold tracking-widest uppercase">
          <Cpu className="w-4 h-4" />
          <span>Iris_AI_Core</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-iris-success rounded-full animate-pulse" />
          <span className="text-[9px] text-iris-secondary tracking-widest uppercase">Online</span>
        </div>
      </div>

      {/* Message History */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/50">
        {messages.map((msg, i) => (
          <Message key={i} role={msg.role} content={msg.content} />
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-6 h-6 shrink-0 flex items-center justify-center border border-iris-accent bg-iris-accent/10 text-iris-accent">
              <Loader2 className="w-3 h-3 animate-spin" />
            </div>
            <div className="p-3 text-xs font-mono leading-relaxed border border-iris-border-strong bg-iris-surface text-iris-secondary animate-pulse">
              Processing query...
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-iris-border-strong bg-iris-surface">
        <div className="relative flex items-center">
          <span className="absolute left-3 text-iris-accent text-sm font-black">&gt;</span>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="TYPE COMMAND OR QUERY..." 
            disabled={loading}
            className="w-full bg-iris-base border border-iris-border-strong text-white text-xs font-mono tracking-wide px-8 py-3 focus:outline-none focus:border-iris-accent transition-colors disabled:opacity-50"
          />
          <button 
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="absolute right-3 text-iris-secondary hover:text-iris-accent transition-colors disabled:opacity-30"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Message({ role, content }: { role: "system" | "user", content: string }) {
  const isSystem = role === "system";
  
  return (
    <div className={`flex gap-3 ${isSystem ? "" : "flex-row-reverse"}`}>
      <div className={`w-6 h-6 shrink-0 flex items-center justify-center border ${
        isSystem 
          ? "border-iris-accent bg-iris-accent/10 text-iris-accent" 
          : "border-iris-secondary bg-iris-surface text-iris-secondary"
      }`}>
        {isSystem ? <Terminal className="w-3 h-3" /> : <User className="w-3 h-3" />}
      </div>
      
      <div className={`p-3 text-xs font-mono leading-relaxed border max-w-[85%] whitespace-pre-wrap ${
        isSystem
          ? "border-iris-border-strong bg-iris-surface text-white"
          : "border-iris-border-strong bg-iris-base text-iris-secondary"
      }`}>
        {content}
      </div>
    </div>
  );
}
