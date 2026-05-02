import { Shield, Plus, Key, Clock } from "lucide-react";

export default function SecretsPage() {
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
        
        <button className="bg-iris-success/10 text-iris-success border border-iris-success px-4 py-2 text-xs font-bold tracking-widest uppercase hover:bg-iris-success hover:text-black transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> Store Secret
        </button>
      </div>

      <div className="bg-iris-surface border border-iris-border-strong">
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-iris-border-strong bg-iris-base text-[10px] uppercase font-black tracking-[0.2em] text-iris-secondary">
          <div className="col-span-1"></div>
          <div className="col-span-5">Key Identifier</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-3">Last Rotated</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>
        
        <div className="divide-y divide-iris-border-strong">
          <SecretRow name="STRIPE_LIVE_KEY" type="API_KEY" date="2023-10-12" />
          <SecretRow name="DB_PASSWORD_PROD" type="CREDENTIAL" date="2023-09-01" />
          <SecretRow name="OPENAI_API_ORG" type="TOKEN" date="2023-11-05" />
          <SecretRow name="SLACK_BOT_WEBHOOK" type="WEBHOOK_URL" date="2023-10-28" />
        </div>
      </div>
    </div>
  );
}

function SecretRow({ name, type, date }: { name: string, type: string, date: string }) {
  return (
    <div className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-iris-base/50 transition-colors group text-sm font-mono">
      <div className="col-span-1 flex justify-center">
        <Key className="w-4 h-4 text-iris-border-strong group-hover:text-iris-success transition-colors" />
      </div>
      <div className="col-span-5 font-bold text-white tracking-wide">
        {name}
      </div>
      <div className="col-span-2 text-xs text-iris-success tracking-widest">
        {type}
      </div>
      <div className="col-span-3 text-xs text-iris-secondary flex items-center gap-2">
        <Clock className="w-3 h-3" /> {date}
      </div>
      <div className="col-span-1 flex justify-end">
        <button className="text-[10px] border border-iris-border-strong px-2 py-1 text-iris-secondary hover:text-white hover:border-iris-success transition-colors uppercase tracking-widest">
          Edit
        </button>
      </div>
    </div>
  );
}
