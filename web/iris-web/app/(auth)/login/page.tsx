import Link from "next/link";
import { Command, Terminal, ChevronRight, Lock } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-iris-base text-iris-text font-mono selection:bg-iris-accent selection:text-white">
      
      {/* Background Grid */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#1F1F1F_1px,transparent_1px),linear-gradient(to_bottom,#1F1F1F_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none opacity-40" />

      {/* Decorative Target Reticles */}
      <div className="absolute top-10 left-10 w-8 h-8 border-t-2 border-l-2 border-iris-border-strong hidden md:block"></div>
      <div className="absolute top-10 right-10 w-8 h-8 border-t-2 border-r-2 border-iris-border-strong hidden md:block"></div>
      <div className="absolute bottom-10 left-10 w-8 h-8 border-b-2 border-l-2 border-iris-border-strong hidden md:block"></div>
      <div className="absolute bottom-10 right-10 w-8 h-8 border-b-2 border-r-2 border-iris-border-strong hidden md:block"></div>

      <div className="w-full max-w-md relative z-10 px-6">
        
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-iris-accent flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 w-full h-full bg-black/20 group-hover:translate-y-full transition-transform duration-300"></div>
              <Command className="w-5 h-5 text-white relative z-10" />
            </div>
            <span className="font-bold text-2xl tracking-[0.2em] text-white">IRIS</span>
          </Link>
        </div>

        <div className="border border-iris-border-strong bg-iris-surface relative shadow-[0_0_40px_rgba(0,0,0,0.8)] backdrop-blur-sm">
          
          {/* Box Reticles */}
          <div className="absolute top-2 left-2 text-[9px] text-iris-border-strong font-black">X</div>
          <div className="absolute top-2 right-2 text-[9px] text-iris-border-strong font-black">X</div>
          <div className="absolute bottom-2 left-2 text-[9px] text-iris-border-strong font-black">X</div>
          <div className="absolute bottom-2 right-2 text-[9px] text-iris-border-strong font-black">X</div>

          <div className="p-8 sm:p-10">
            <div className="mb-8">
              <h1 className="text-2xl font-black text-white uppercase tracking-widest flex items-center gap-3">
                <Lock className="w-5 h-5 text-iris-accent" />
                Auth_Proto
              </h1>
              <p className="text-xs text-iris-secondary mt-2 tracking-widest uppercase">
                Provide credentials for protocol entry
              </p>
            </div>

            <form className="space-y-6">
              <div className="space-y-2">
                <label className="flex text-[10px] text-iris-secondary uppercase tracking-widest font-bold">
                  <Terminal className="w-3 h-3 mr-2 text-iris-accent-sub" />
                  Identifier [Email]
                </label>
                <input 
                  type="email" 
                  autoComplete="email"
                  className="w-full bg-iris-base border border-iris-border-strong px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-iris-accent focus:shadow-[0_0_15px_rgba(255,51,102,0.2)] transition-all placeholder:text-iris-muted"
                  placeholder="admin@iris.core"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex text-[10px] text-iris-secondary uppercase tracking-widest font-bold">
                    <Terminal className="w-3 h-3 mr-2 text-iris-accent-sub" />
                    Passkey
                  </label>
                  <Link href="/forgot" className="text-[10px] text-iris-muted hover:text-iris-accent transition-colors uppercase tracking-widest">
                    Override?
                  </Link>
                </div>
                <input 
                  type="password" 
                  autoComplete="current-password"
                  className="w-full bg-iris-base border border-iris-border-strong px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-iris-accent focus:shadow-[0_0_15px_rgba(255,51,102,0.2)] transition-all placeholder:text-iris-muted"
                  placeholder="••••••••••••"
                  required
                />
              </div>

              <button 
                type="button" 
                className="w-full bg-iris-accent text-white font-bold text-sm tracking-[0.15em] uppercase py-4 flex items-center justify-center gap-2 hover:bg-white hover:text-black transition-colors group mt-4 border border-iris-accent hover:border-white"
              >
                Authenticate
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </form>
          </div>

          <div className="border-t border-iris-border-strong bg-iris-base/50 p-4 text-center flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-[10px] text-iris-muted tracking-widest uppercase">
              Connection encrypted: <span className="text-iris-success">SECURE</span>
            </span>
            <Link href="/register" className="text-[10px] text-white hover:text-iris-accent transition-colors uppercase tracking-widest font-bold">
              [ Create Node ]
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
