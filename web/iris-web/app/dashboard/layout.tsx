import { CheckCircle2, Bot } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { AIChat } from "@/components/chat/AIChat";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-iris-base text-iris-text font-mono overflow-hidden selection:bg-iris-accent selection:text-white">
      
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-iris-base">
        
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#1F1F1F_1px,transparent_1px),linear-gradient(to_bottom,#1F1F1F_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none opacity-20" />
        
        {/* Top Bar Readout */}
        <header className="h-12 border-b border-iris-border-strong bg-iris-surface/50 backdrop-blur-md flex items-center px-6 justify-between relative z-10">
          <div className="flex items-center gap-4 text-[10px] uppercase font-bold tracking-widest text-iris-secondary">
            <span className="text-iris-accent">ENV:</span> PRODUCTION
            <span className="text-iris-border-strong">|</span>
            <span className="text-iris-success flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> SYS_OK</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-[10px] text-iris-border-strong font-black uppercase tracking-[0.3em]">
              RESTRICTED ACCESS
            </div>
            
            {/* Toggle AI Chat (Desktop Only) */}
            <div className="hidden lg:flex items-center gap-2 text-iris-accent-sub text-xs tracking-widest uppercase font-bold border border-iris-border-strong px-3 py-1 bg-iris-surface cursor-help group">
              <Bot className="w-4 h-4 group-hover:animate-pulse" />
              Iris Online
            </div>
          </div>
        </header>

        <div className="flex-1 flex relative z-10 overflow-hidden">
          {/* Render Page Content */}
          <div className="flex-1 overflow-auto p-6 md:p-10">
            {children}
          </div>

          {/* AI Chat Right Panel (Fixed width on desktop) */}
          <div className="hidden lg:block w-80 border-l border-iris-border-strong flex-shrink-0">
            <AIChat />
          </div>
        </div>

      </main>

    </div>
  );
}
