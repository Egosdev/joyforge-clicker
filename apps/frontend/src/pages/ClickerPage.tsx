import { useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import type { ClickResponse } from '@joyforge/shared';

export default function ClickerPage() {
  const { me, setMe } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!me) return null;

  const click = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<ClickResponse>('/click');
      const data = r.data;
      setMe((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          user: { ...prev.user, totalUsd: data.user.totalUsd, totalClicks: data.user.totalClicks },
          guild: data.guild
            ? {
                guildId: data.guild.guildId,
                vaultTotal: data.guild.vaultTotal,
                goal: { ...data.guild.goal }
              }
            : prev.guild
        };
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'ERROR');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 border rounded-lg">
          <div className="text-sm text-slate-500">Toplam $</div>
          <div className="text-3xl font-semibold">{me.user.totalUsd}</div>
          <div className="text-sm text-slate-500 mt-1">Toplam click: {me.user.totalClicks}</div>
        </div>

        <div className="p-4 border rounded-lg">
          <div className="text-sm text-slate-500">Guild</div>
          {me.guild ? (
            <div className="space-y-1">
              <div className="text-sm">Vault: <span className="font-semibold">{me.guild.vaultTotal}</span></div>
              <div className="text-sm">Goal Score: <span className="font-semibold">{me.guild.goal.score}</span></div>
              <div className="text-sm">Goal Progress: <span className="font-semibold">{me.guild.goal.progress}/{me.guild.goal.target}</span></div>
              <div className="w-full bg-slate-100 rounded h-2 overflow-hidden">
                <div
                  className="h-2 bg-emerald-500"
                  style={{ width: `${Math.floor((me.guild.goal.progress / me.guild.goal.target) * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-600">Bir guild'e katılmadın.</div>
          )}
        </div>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <button
        onClick={click}
        disabled={busy}
        className="w-full sm:w-auto px-6 py-4 rounded-lg bg-slate-900 text-white text-lg disabled:opacity-60"
      >
        {busy ? '...' : 'CLICK (+$1)'}
      </button>

      <p className="text-xs text-slate-500">
        Limit: saniyede max 20 click.
      </p>
    </div>
  );
}
