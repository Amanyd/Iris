import { ArrowRight, Bot, Command, Workflow, Shield, Terminal, Settings2 } from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-iris-base text-iris-text selection:bg-iris-accent selection:text-white font-mono relative overflow-hidden">
      
      {/* Schematic Background */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#1F1F1F_1px,transparent_1px),linear-gradient(to_bottom,#1F1F1F_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none opacity-50" />
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_10%,transparent_20%,#050505_100%)] pointer-events-none" />

      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-iris-border-strong bg-iris-base/80 backdrop-blur-md">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8  flex items-center justify-center relative overflow-hidden group">
              <div className="absolute inset-0 w-full h-full bg-black/20 group-hover:translate-y-full transition-transform duration-300"></div>
              <Command className="w-4 h-4 text-white relative z-10" />
            </div>
            <span className="font-bold text-xl tracking-[0.2em] text-white">I R I S <span className="text-iris-accent-sub">_</span></span>
          </div>

          <nav className="hidden md:flex items-center gap-10 text-xs font-bold text-iris-secondary tracking-[0.1em] uppercase">
            <Link href="#features" className="hover:text-iris-accent transition-colors flex items-center gap-2">
              <span className="text-iris-border-strong">01</span> Features
            </Link>
            <Link href="#architecture" className="hover:text-iris-accent transition-colors flex items-center gap-2">
              <span className="text-iris-border-strong">02</span> Architecture
            </Link>
            <Link href="#docs" className="hover:text-iris-accent transition-colors flex items-center gap-2">
              <span className="text-iris-border-strong">03</span> Docs
            </Link>
          </nav>

          <div className="flex items-center gap-6">
            <Link href="/login" className="text-xs font-bold text-iris-secondary hover:text-white transition-colors uppercase tracking-[0.1em]">
              Login
            </Link>
            <Link href="/register" className="text-xs font-bold px-4 py-2 bg-white text-black hover:bg-iris-accent hover:text-white transition-all uppercase tracking-[0.1em] flex items-center gap-2">
              Deploy <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        
        {/* Hero Section */}
        <section className="relative pt-24 pb-20 flex flex-col items-center">
          <div className="container mx-auto px-6 relative z-10 flex flex-col items-center max-w-5xl">
            
            {/* Minimal Technical Header */}
            <div className="w-full flex justify-between items-end border-b border-iris-border-strong pb-4 mb-16">
              <div className="flex items-center gap-4 text-xs font-bold text-iris-secondary tracking-widest uppercase">
                <span className="w-2 h-2 bg-iris-accent animate-pulse block"></span>
                System Core Active
              </div>
              <div className="text-xs font-bold text-iris-border-strong tracking-widest">
                VER 1.0.0
              </div>
            </div>

            {/* Ascii Banner */}
            <div className="mb-12 w-full flex justify-center text-iris-text font-bold leading-none tracking-tighter opacity-90 drop-shadow-[0_0_10px_rgba(255,51,102,0.3)]">
              <pre className="text-[8px] md:text-[16px] lg:text-[22px] text-center">
{`
 ___  ____   ___  ____  
|_ _||  _ \\ |_ _|/ ___| 
 | | | |_) |  | |\\___ \\ 
 | | |  _ <   | | ___) |
|___||_| \\_\\ |___|____/ 
`}
              </pre>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter mb-8 text-center leading-[1.1] uppercase max-w-4xl text-white font-sans">
              Mechani<span className=" text-[#F59E0B] ">z</span>ed <br />
              <span >
                Auto<span className=" text-[#10B981] ">m</span>ation   Matrix.
              </span>
            </h1>
            
            <p className="max-w-2xl mx-auto text-sm md:text-base text-iris-secondary mb-14 text-center border-x border-iris-border-strong px-8 py-2">
              The self-hosted, unyielding workflow engine. 
              Wire up complex visual DAGs, ingest webhooks on native infrastructure, and let the integrated LLM construct your pipelines via pure structural logic.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full">
              <Link href="/dashboard" className="w-full sm:w-auto px-8 py-4 bg-iris-accent text-white font-bold text-sm tracking-widest flex items-center justify-between gap-6 hover:bg-white hover:text-black transition-all uppercase group">
                Initialize Console
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="https://github.com" target="_blank" className="w-full sm:w-auto px-8 py-4 bg-transparent text-white font-bold text-sm tracking-widest border border-iris-border-strong hover:border-white transition-all uppercase flex items-center justify-center gap-4">
                <Command className="w-4 h-4" />
                Source Code
              </Link>
            </div>
          </div>
        </section>

        {/* Console Readout Bar */}
        <div className="w-full border-y border-iris-border-strong bg-iris-surface flex overflow-hidden">
          <div className="px-6 py-2 bg-iris-accent text-white font-bold text-[10px] tracking-widest uppercase flex-shrink-0 flex items-center">
            SYS_LOG
          </div>
          <div className="px-6 py-2 text-[10px] tracking-widest text-iris-secondary w-full truncate flex items-center gap-4">
            <span className="text-iris-accent-sub">[14:02:44]</span> Connection stabilized. Graph nodes ready. <span className="text-iris-accent-sub">[14:02:45]</span> LLM Module synchronized.
          </div>
        </div>

        {/* Feature Grid (Technical Blueprint Style) */}
        <section id="features" className="container mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-3 border border-iris-border-strong">
            
            {/* Block 1 */}
            <div className="p-10 border-b lg:border-b-0 lg:border-r border-iris-border-strong hover:bg-iris-surface transition-colors group relative">
              <div className="absolute top-2 left-2 text-[9px] text-iris-border-strong font-black">X</div>
              <div className="absolute top-2 right-2 text-[9px] text-iris-border-strong font-black">X</div>
              <div className="absolute bottom-2 left-2 text-[9px] text-iris-border-strong font-black">X</div>
              <div className="absolute bottom-2 right-2 text-[9px] text-iris-border-strong font-black">X</div>
              
              <Workflow className="w-10 h-10  mb-8 " />
              <div className="text-[10px] font-bold text-iris-accent tracking-widest mb-4 uppercase">Spec_01</div>
              <h3 className="text-xl font-bold mb-4 text-white uppercase font-sans tracking-tight">DAG Matrix</h3>
              <p className="text-sm text-iris-secondary leading-relaxed">
                Break out of linear restrictions. Architect complex topological pipelines using directed acyclic graphs executing with wave-parallel scheduling.
              </p>
            </div>

            {/* Block 2 */}
            <div className="p-10 border-b lg:border-b-0 lg:border-r border-iris-border-strong hover:bg-iris-surface transition-colors group relative">
              <div className="absolute top-2 left-2 text-[9px] text-iris-border-strong font-black">X</div>
              <div className="absolute top-2 right-2 text-[9px] text-iris-border-strong font-black">X</div>
              <div className="absolute bottom-2 left-2 text-[9px] text-iris-border-strong font-black">X</div>
              <div className="absolute bottom-2 right-2 text-[9px] text-iris-border-strong font-black">X</div>
              
              <Bot className="w-10 h-10 text-white mb-8 " />
              <div className="text-[10px] font-bold text-iris-accent-sub tracking-widest mb-4 uppercase">Spec_02</div>
              <h3 className="text-xl font-bold mb-4 text-white uppercase font-sans tracking-tight">Embedded Oracle</h3>
              <p className="text-sm text-iris-secondary leading-relaxed">
                Command via plain text. The central LLM interprets node structures and synthesizes complex execution workflows instantly on command.
              </p>
            </div>

            {/* Block 3 */}
            <div className="p-10 hover:bg-iris-surface transition-colors group relative">
              <div className="absolute top-2 left-2 text-[9px] text-iris-border-strong font-black">X</div>
              <div className="absolute top-2 right-2 text-[9px] text-iris-border-strong font-black">X</div>
              <div className="absolute bottom-2 left-2 text-[9px] text-iris-border-strong font-black">X</div>
              <div className="absolute bottom-2 right-2 text-[9px] text-iris-border-strong font-black">X</div>
              
              <Shield className="w-10 h-10 text-iris-secondary mb-8 " />
              <div className="text-[10px] font-bold text-iris-accent  tracking-widest mb-4 uppercase">Spec_03</div>
              <h3 className="text-xl font-bold mb-4 text-white uppercase font-sans tracking-tight">AES-GCM Secure</h3>
              <p className="text-sm text-iris-secondary leading-relaxed">
                All tokens are locked with military-grade encryption, sitting dormant until exactly decrypted in-memory during worker pod execution.
              </p>
            </div>
            
          </div>
        </section>

      </main>

      {/* Footer Blueprint Layer */}
      <footer className="border-t border-iris-border-strong bg-iris-base relative z-10 font-sans">
        <div className="container mx-auto px-6 py-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg tracking-[0.2em] text-white">IRIS</span>
          </div>
          <p className="text-[10px] font-mono text-iris-muted uppercase tracking-widest text-center md:text-left">
            Strict Tolerance Platform. Validated Systems. Open source.
          </p>
          <div className="flex items-center gap-4 text-iris-muted">
            <Settings2 className="w-5 h-5 hover:text-white transition-colors cursor-pointer" />
            <Terminal className="w-5 h-5 hover:text-white transition-colors cursor-pointer" />
          </div>
        </div>
      </footer>

    </div>
  );
}
