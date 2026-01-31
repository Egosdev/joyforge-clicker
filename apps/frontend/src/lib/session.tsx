import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

export type MeResponse = {
  user: { id: string; username: string; totalUsd: number; totalClicks: number };
  guild: null | {
    guildId: string;
    vaultTotal: number;
    goal: { progress: number; target: number; score: number };
  };
};

type SessionCtx = {
  me: MeResponse | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setMe: React.Dispatch<React.SetStateAction<MeResponse | null>>;
};

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const r = await api.get<MeResponse>('/me');
      setMe(r.data);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo(() => ({ me, loading, refresh, setMe }), [me, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
