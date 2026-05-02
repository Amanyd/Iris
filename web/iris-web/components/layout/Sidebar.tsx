"use client";

import Link from "next/link";
import { Command, Workflow, Shield, Plug, LayoutDashboard, Terminal, ChevronRight, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  
  return (
    <aside className="w-64 border-r border-iris-border-strong bg-iris-surface flex flex-col relative z-20 flex-shrink-0 h-screen">
      
      {/* Brand / Logo */}
      <div className="h-16 border-b border-iris-border-strong flex items-center px-6 bg-iris-base shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-iris-accent flex items-center justify-center">
            <Command className="w-3 h-3 text-white" />
          </div>
          <span className="font-black tracking-[0.2em] text-white">IRIS<span className="text-iris-accent-sub">_</span></span>
        </div>
      </div>

      {/* User Status */}
      <div className="px-6 py-4 border-b border-iris-border-strong bg-iris-elevated shrink-0">
        <div className="text-[10px] font-bold text-iris-secondary tracking-widest uppercase mb-1 flex items-center gap-2">
          <Terminal className="w-3 h-3 text-iris-accent-sub" /> Operative Status
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="w-2 h-2 bg-iris-success rounded-sm animate-pulse" />
          <span className="text-xs font-bold text-white tracking-widest uppercase truncate max-w-[160px]" title={user?.email}>
            {user?.email || "Loading..."}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 custom-scrollbar">
        <NavItem href="/dashboard" icon={<LayoutDashboard className="w-4 h-4" />} label="Overview" active={pathname === "/dashboard"} />
        <div className="my-4" /> {/* Spacer */}
        <div className="px-2 text-[9px] font-black text-iris-border-strong tracking-[0.2em] uppercase mb-2">Systems</div>
        <NavItem href="/dashboard/relays" icon={<Workflow className="w-4 h-4" />} label="Relay Matrix" active={pathname?.startsWith("/dashboard/relays")} />
        <NavItem href="/dashboard/connections" icon={<Plug className="w-4 h-4" />} label="Connections" active={pathname?.startsWith("/dashboard/connections")} />
        <NavItem href="/dashboard/secrets" icon={<Shield className="w-4 h-4" />} label="Vault [AES]" active={pathname?.startsWith("/dashboard/secrets")} />
      </nav>

      {/* Footer Actions */}
      <div className="p-4 border-t border-iris-border-strong bg-iris-base shrink-0">
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold text-iris-error hover:bg-iris-error/10 transition-colors uppercase tracking-widest rounded-sm border border-transparent hover:border-iris-error/30"
        >
          <LogOut className="w-4 h-4" />
          Disengage
        </button>
      </div>

    </aside>
  );
}

function NavItem({ href, icon, label, active = false }: { href: string, icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <Link 
      href={href} 
      className={`flex items-center justify-between px-3 py-3 text-xs tracking-widest uppercase font-bold group border border-transparent transition-all ${
        active 
          ? 'bg-iris-accent/10 text-iris-accent border-iris-accent/50' 
          : 'text-iris-secondary hover:text-white hover:bg-iris-surface hover:border-iris-border-strong'
      }`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
      </div>
      <ChevronRight className={`w-3 h-3 transition-transform ${active ? 'text-iris-accent translate-x-1' : 'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`} />
    </Link>
  );
}
