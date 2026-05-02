"use client";

import {
  Plug, Send, Copy, CheckCircle2, ExternalLink,
  MessageCircle, Loader2, Link2Off, RefreshCw, Info,
  ShieldCheck, Zap, Bot,
} from "lucide-react";
import { useState, useEffect } from "react";

// ─── API helpers ──────────────────────────────────────────────────────────────

async function saveSetting(key: string, value: string): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("iris_token") : null;
  const res = await fetch("/api/v1/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ key, value }),
  });
  if (!res.ok) throw new Error("Failed to save setting");
}

async function loadSettings(): Promise<Record<string, string>> {
  const token = typeof window !== "undefined" ? localStorage.getItem("iris_token") : null;
  const res = await fetch("/api/v1/settings", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) return {};
  return res.json();
}

// ─── Config ───────────────────────────────────────────────────────────────────

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "IrisRelayBot";

// ─── Telegram card ────────────────────────────────────────────────────────────

function TelegramCard() {
  const [botToken, setBotToken] = useState("");
  const [savedToken, setSavedToken] = useState(""); // masked value from backend
  const [irisToken, setIrisToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showSteps, setShowSteps] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false); // prevents SSR/client disabled mismatch

  const isConfigured = mounted && savedToken !== "";
  const telegramDeepLink = `https://t.me/${BOT_USERNAME}?start=link`;

  useEffect(() => {
    setMounted(true);
    setIrisToken(localStorage.getItem("iris_token"));
    loadSettings().then(s => {
      setSavedToken(s["telegram_bot_token"] ?? "");
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!botToken.trim()) return;
    setSaving(true);
    setSaveError("");
    try {
      await saveSetting("telegram_bot_token", botToken.trim());
      setSavedToken(botToken.slice(0, 8) + "…");
      setBotToken("");
    } catch {
      setSaveError("Failed to save. Make sure you're logged in and iris-core is running.");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setSaving(true);
    try {
      await saveSetting("telegram_bot_token", "");
      setSavedToken("");
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const copyIrisToken = async () => {
    if (!irisToken) return;
    await navigator.clipboard.writeText(irisToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`border bg-iris-surface transition-colors ${isConfigured ? "border-iris-success/40" : "border-iris-border-strong"}`}>

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="p-5 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 border ${isConfigured ? "border-iris-success/30 bg-iris-success/5" : "border-iris-border-strong bg-iris-base"}`}>
            <Send className={`w-5 h-5 ${isConfigured ? "text-iris-success" : "text-[#229ED9]"}`} />
          </div>
          <div>
            <h3 className="font-mono font-bold text-white text-sm tracking-wide">Telegram Bot</h3>
            <p className="text-[10px] text-iris-secondary mt-0.5 font-mono">@{BOT_USERNAME}</p>
          </div>
        </div>
        <div className={`text-[9px] font-black tracking-widest uppercase flex items-center gap-1.5 ${isConfigured ? "text-iris-success" : "text-iris-border-strong"}`}>
          {loading
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : isConfigured
              ? <><CheckCircle2 className="w-3 h-3" />Configured</>
              : <><Link2Off className="w-3 h-3" />Not configured</>
          }
        </div>
      </div>

      {/* ── Bot token input ───────────────────────────────────────────────────── */}
      <div className="px-5 pb-4 border-t border-iris-border-strong/60 pt-4 space-y-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-iris-secondary mb-2 flex items-center gap-1.5">
            <Bot className="w-3 h-3" /> Bot Token
          </p>

          {isConfigured ? (
            <div className="flex gap-2 items-center">
              <div className="flex-1 bg-black/40 border border-iris-success/30 px-3 py-2 font-mono text-[10px] text-iris-success">
                {savedToken} <span className="text-iris-secondary">· token saved</span>
              </div>
              <button
                onClick={handleDisconnect}
                disabled={saving}
                title="Remove token"
                className="shrink-0 px-3 py-2 border border-iris-border-strong text-iris-secondary hover:text-red-400 hover:border-red-400/40 text-[9px] transition-colors disabled:opacity-30"
              >
                <Link2Off className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="password"
                  value={botToken}
                  onChange={e => setBotToken(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSave()}
                  placeholder="7123456789:AAHxxxxxxxxxxxxx"
                  className="flex-1 bg-iris-base border border-iris-border-strong text-white text-[10px] font-mono px-3 py-2 focus:outline-none focus:border-iris-accent transition-colors placeholder:text-iris-muted"
                />
                <button
                  onClick={handleSave}
                  disabled={!mounted || saving || !botToken.trim()}
                  className="shrink-0 px-4 py-2 bg-iris-accent/10 border border-iris-accent text-iris-accent text-[9px] font-black uppercase tracking-widest hover:bg-iris-accent/20 transition-colors disabled:opacity-30 flex items-center gap-1.5"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                  Save
                </button>
              </div>
              {saveError && <p className="text-[9px] text-red-400 font-mono">{saveError}</p>}
              <p className="text-[9px] text-iris-muted font-mono">
                Get your token from <span className="text-iris-accent">@BotFather</span> on Telegram → /newbot
              </p>
            </div>
          )}
        </div>

        {/* Feature grid when configured */}
        {isConfigured && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: <MessageCircle className="w-3.5 h-3.5" />, label: "Text & Voice", desc: "Create relays by talking" },
              { icon: <Zap className="w-3.5 h-3.5" />, label: "Trigger Relays", desc: "/trigger <id>" },
              { icon: <ShieldCheck className="w-3.5 h-3.5" />, label: "Secure", desc: "JWT-authenticated" },
            ].map(f => (
              <div key={f.label} className="border border-iris-border-strong/60 bg-iris-base p-2 text-center">
                <div className="text-iris-accent flex justify-center mb-1">{f.icon}</div>
                <div className="text-[9px] font-black text-white uppercase tracking-widest">{f.label}</div>
                <div className="text-[8px] text-iris-secondary mt-0.5">{f.desc}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── User /login steps ─────────────────────────────────────────────────── */}
      <div className="px-5 pb-5 space-y-3">
        <button
          onClick={() => setShowSteps(v => !v)}
          className="w-full flex items-center justify-between text-[10px] font-mono text-iris-secondary hover:text-white transition-colors py-1"
        >
          <span className="flex items-center gap-1.5"><Info className="w-3 h-3" />How to link your account on Telegram</span>
          <span>{showSteps ? "▲" : "▼"}</span>
        </button>

        {showSteps && (
          <div className="border border-iris-border-strong/50 bg-iris-base p-3 space-y-4">
            {/* Step 1 */}
            <div className="flex gap-3">
              <span className="w-5 h-5 shrink-0 flex items-center justify-center border border-iris-accent text-iris-accent text-[9px] font-black">1</span>
              <div>
                <p className="text-[10px] font-mono text-white font-bold">Open the bot on Telegram</p>
                <a href={telegramDeepLink} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1 text-[10px] font-mono text-[#229ED9] hover:text-white transition-colors">
                  <ExternalLink className="w-2.5 h-2.5" />t.me/{BOT_USERNAME}
                </a>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-3">
              <span className="w-5 h-5 shrink-0 flex items-center justify-center border border-iris-accent text-iris-accent text-[9px] font-black">2</span>
              <div className="flex-1">
                <p className="text-[10px] font-mono text-white font-bold">Copy your Iris token</p>
                <p className="text-[9px] text-iris-secondary mt-0.5">Proves your identity to the bot</p>
                {irisToken ? (
                  <div className="mt-2 flex gap-2">
                    <div className="flex-1 bg-black/40 border border-iris-border-strong px-2 py-1.5 font-mono text-[8px] text-iris-secondary truncate">
                      {irisToken.slice(0, 32)}…
                    </div>
                    <button
                      onClick={copyIrisToken}
                      className={`shrink-0 px-2 py-1 text-[9px] font-black uppercase border transition-colors flex items-center gap-1 ${
                        copied ? "border-iris-success/40 text-iris-success" : "border-iris-border-strong text-iris-secondary hover:text-white"
                      }`}
                    >
                      {copied ? <><CheckCircle2 className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                    </button>
                  </div>
                ) : (
                  <p className="text-[9px] text-iris-warning mt-1">Log in first to see your token</p>
                )}
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-3">
              <span className="w-5 h-5 shrink-0 flex items-center justify-center border border-iris-accent text-iris-accent text-[9px] font-black">3</span>
              <div>
                <p className="text-[10px] font-mono text-white font-bold">Send the login command to the bot</p>
                <div className="mt-1 bg-black/40 border border-iris-border-strong px-2 py-1.5 font-mono text-[9px] text-iris-accent">
                  /login &lt;paste-token-here&gt;
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Open bot + copy token CTA */}
        <div className="flex gap-2">
          <a
            href={telegramDeepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#229ED9] hover:bg-[#1a8bc2] text-white text-[10px] font-black uppercase tracking-widest transition-colors"
          >
            <Bot className="w-3.5 h-3.5" />
            Open Telegram Bot
          </a>
          <button
            onClick={copyIrisToken}
            disabled={!mounted || !irisToken}
            title="Copy Iris token"
            className="px-3 py-2.5 border border-iris-border-strong text-iris-secondary hover:text-white hover:border-white text-[10px] transition-colors disabled:opacity-30"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-iris-success" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Coming soon card ─────────────────────────────────────────────────────────

function ComingSoonCard({ name, icon }: { name: string; icon: React.ReactNode }) {
  return (
    <div className="border border-iris-border-strong/40 bg-iris-surface/50 p-5 opacity-50">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2.5 border border-iris-border-strong/40 bg-iris-base">{icon}</div>
        <div>
          <h3 className="font-mono font-bold text-iris-secondary text-sm">{name}</h3>
          <p className="text-[9px] text-iris-muted mt-0.5 font-black uppercase tracking-widest">Coming soon</p>
        </div>
      </div>
      <div className="h-px bg-iris-border-strong/30 mb-3" />
      <div className="flex items-center gap-1.5 text-[9px] font-mono text-iris-muted">
        <Loader2 className="w-3 h-3" />
        Integration in development
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConnectionsPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex justify-between items-center border-b border-iris-border-strong pb-4">
        <div>
          <h1 className="text-xl font-black tracking-widest text-white uppercase flex items-center gap-3">
            <Plug className="w-5 h-5 text-iris-accent-sub" />
            Connections
          </h1>
          <p className="text-xs text-iris-secondary font-mono mt-1">
            Link external platforms and messaging apps to your Iris account
          </p>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="text-iris-border-strong hover:text-iris-secondary transition-colors p-2"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messaging */}
      <div>
        <h2 className="text-[9px] font-black uppercase tracking-widest text-iris-secondary mb-3 flex items-center gap-2">
          <MessageCircle className="w-3 h-3" />
          Messaging Platforms
        </h2>
        <div key={refreshKey} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <TelegramCard />
          <ComingSoonCard name="WhatsApp" icon={<MessageCircle className="w-5 h-5 text-iris-border-strong" />} />
          <ComingSoonCard name="Slack Bot" icon={<Zap className="w-5 h-5 text-iris-border-strong" />} />
        </div>
      </div>

      {/* Webhook info */}
      <div className="border border-iris-border-strong/40 bg-iris-surface/30 p-4">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-iris-accent-sub shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-iris-accent-sub mb-1">
              Webhook Relays
            </p>
            <p className="text-xs font-mono text-iris-secondary leading-relaxed">
              To receive external events (GitHub, Stripe, etc.), create a relay with trigger type{" "}
              <span className="text-iris-accent font-bold">webhook</span>. Each relay gets its own unique endpoint.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
