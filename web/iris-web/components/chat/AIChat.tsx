import { Terminal, Send, Cpu, User } from "lucide-react";

export function AIChat() {
  return (
    <div className="flex flex-col h-full border border-iris-border-strong bg-iris-base relative">
      {/* Header */}
      <div className="h-12 border-b border-iris-border-strong bg-iris-surface flex items-center justify-between px-4">
        <div className="flex items-center gap-2 text-iris-accent text-xs font-bold tracking-widest uppercase">
          <Cpu className="w-4 h-4" />
          <span>Iris_Assistance_Core</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-iris-success rounded-full animate-pulse" />
          <span className="text-[9px] text-iris-secondary tracking-widest uppercase">Online</span>
        </div>
      </div>

      {/* Message History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/50">
        <Message 
          role="system" 
          content="System initialized. How can I assist with your workflow orchestration today?" 
        />
        <Message 
          role="user" 
          content="Analyze the failure in Relay 'Legacy_Sync' and suggest a patch." 
        />
        <Message 
          role="system" 
          content="Analyzing... Target 'Legacy_Sync' failed at node 4 (Database Sync). The timeout was reached due to heavy load. I suggest increasing the timeout threshold and adding a retry block. Should I apply this patch?" 
        />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-iris-border-strong bg-iris-surface">
        <div className="relative flex items-center">
          <span className="absolute left-3 text-iris-accent text-sm font-black">&gt;</span>
          <input 
            type="text" 
            placeholder="TYPE COMMAND OR QUERY..." 
            className="w-full bg-iris-base border border-iris-border-strong text-white text-xs font-mono tracking-wide px-8 py-3 focus:outline-none focus:border-iris-accent transition-colors"
          />
          <button className="absolute right-3 text-iris-secondary hover:text-iris-accent transition-colors">
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
      
      <div className={`p-3 text-xs font-mono leading-relaxed border max-w-[85%] ${
        isSystem
          ? "border-iris-border-strong bg-iris-surface text-white"
          : "border-iris-border-strong bg-iris-base text-iris-secondary"
      }`}>
        {content}
      </div>
    </div>
  );
}
