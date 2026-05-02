"use client";

import { Shield, Plus, Key, Clock, Trash2, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "@/lib/api";

export default function SecretsPage() {
  const [secrets, setSecrets] = useState<api.Secret[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [error, setError] = useState("");

  async function loadSecrets() {
    try {
      const data = await api.getSecrets();
      setSecrets(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSecrets();
  }, []);

  async function handleCreate() {
    if (!newName.trim() || !newValue.trim()) return;
    setCreating(true);
    setError("");
    try {
      await api.createSecret(newName, newValue);
      setNewName("");
      setNewValue("");
      setShowCreate(false);
      await loadSecrets();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create secret");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteSecret(id);
      await loadSecrets();
    } catch {
      // silent
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center border-b border-iris-border-strong pb-4">
        <div>
          <h1 className="text-xl font-black tracking-widest text-white uppercase flex items-center gap-3">
            <Shield className="w-5 h-5 text-iris-success" />
            Vault [AES-256]
          </h1>
          <p className="text-xs text-iris-secondary font-mono mt-1">Encrypted environmental variables and tokens</p>
        </div>
        
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-iris-success/10 text-iris-success border border-iris-success px-4 py-2 text-xs font-bold tracking-widest uppercase hover:bg-iris-success hover:text-black transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Store Secret
        </button>
      </div>

      {/* Create Secret Form */}
      {showCreate && (
        <div className="border border-iris-success/50 bg-iris-surface p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-xs font-black tracking-widest uppercase text-iris-success">Encrypt New Secret</div>
            <button onClick={() => setShowCreate(false)} className="text-iris-secondary hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="px-4 py-2 border border-iris-error/50 bg-iris-error/10 text-iris-error text-xs font-mono">
              ⚠ {error}
            </div>
          )}

          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))}
            placeholder="SECRET_NAME"
            className="w-full bg-iris-base border border-iris-border-strong px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-iris-success transition-colors placeholder:text-iris-muted"
          />
          <input
            type="password"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Secret value (will be encrypted)..."
            className="w-full bg-iris-base border border-iris-border-strong px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-iris-success transition-colors placeholder:text-iris-muted"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim() || !newValue.trim()}
            className="bg-iris-success text-black px-6 py-2 text-xs font-bold tracking-widest uppercase hover:bg-white transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Encrypt & Store
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 text-iris-secondary text-sm py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          Decrypting vault index...
        </div>
      ) : secrets.length === 0 ? (
        <div className="text-center py-12 border border-iris-border-strong bg-iris-surface">
          <Shield className="w-10 h-10 text-iris-border-strong mx-auto mb-4" />
          <p className="text-sm text-iris-secondary">Vault is empty. Store your first secret above.</p>
        </div>
      ) : (
        <div className="bg-iris-surface border border-iris-border-strong">
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-iris-border-strong bg-iris-base text-[10px] uppercase font-black tracking-[0.2em] text-iris-secondary">
            <div className="col-span-1"></div>
            <div className="col-span-5">Key Identifier</div>
            <div className="col-span-3">Created</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>
          
          <div className="divide-y divide-iris-border-strong">
            {secrets.map((secret) => (
              <SecretRow key={secret.id} secret={secret} onDelete={() => handleDelete(secret.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SecretRow({ secret, onDelete }: { secret: api.Secret; onDelete: () => void }) {
  return (
    <div className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-iris-base/50 transition-colors group text-sm font-mono">
      <div className="col-span-1 flex justify-center">
        <Key className="w-4 h-4 text-iris-border-strong group-hover:text-iris-success transition-colors" />
      </div>
      <div className="col-span-5 font-bold text-white tracking-wide">
        {secret.name}
      </div>
      <div className="col-span-3 text-xs text-iris-secondary flex items-center gap-2">
        <Clock className="w-3 h-3" /> {new Date(secret.created_at).toLocaleDateString()}
      </div>
      <div className="col-span-3 flex justify-end">
        <button
          onClick={onDelete}
          className="text-[10px] border border-iris-border-strong px-2 py-1 text-iris-secondary hover:text-iris-error hover:border-iris-error transition-colors uppercase tracking-widest flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" /> Delete
        </button>
      </div>
    </div>
  );
}
