import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';

type MyGuildResponse = { guild: null | { id: string; name: string; capacity: number; owner_user_id: string }; members?: any[] };

type InviteRow = { id: string; guild_id: string; guild_name: string; status: string; created_at: string };

export default function GuildPage() {
  const { me, refresh } = useSession();
  const [myGuild, setMyGuild] = useState<MyGuildResponse | null>(null);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createName, setCreateName] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');

  const load = async () => {
    try {
      const [g, inv] = await Promise.all([
        api.get<MyGuildResponse>('/guilds/me'),
        api.get<{ invites: InviteRow[] }>('/guilds/invites')
      ]);
      setMyGuild(g.data);
      setInvites(inv.data.invites);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'ERROR');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (!me) return null;

  const createGuild = async () => {
    setError(null);
    try {
      await api.post('/guilds', { name: createName });
      setCreateName('');
      await refresh();
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'ERROR');
    }
  };

  const sendInvite = async () => {
    setError(null);
    try {
      await api.post('/guilds/invites', { targetUsername: inviteUsername });
      setInviteUsername('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'ERROR');
    }
  };

  const approve = async (id: string) => {
    setError(null);
    try {
      await api.post(`/guilds/invites/${id}/approve`);
      await refresh();
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'ERROR');
    }
  };

  const reject = async (id: string) => {
    setError(null);
    try {
      await api.post(`/guilds/invites/${id}/reject`);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'ERROR');
    }
  };

  const leave = async () => {
    setError(null);
    try {
      await api.post('/guilds/leave');
      await refresh();
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'ERROR');
    }
  };

  return (
    <div className="space-y-6">
      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="p-4 border rounded-lg">
        <div className="font-semibold mb-2">Davetlerim</div>
        {invites.length ? (
          <div className="space-y-2">
            {invites.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded">
                <div className="text-sm">
                  <div className="font-medium">{i.guild_name}</div>
                  <div className="text-xs text-slate-500">{new Date(i.created_at).toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-2 rounded bg-emerald-600 text-white text-sm" onClick={() => approve(i.id)}>
                    Approve
                  </button>
                  <button className="px-3 py-2 rounded bg-slate-200 text-sm" onClick={() => reject(i.id)}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500">Bekleyen davet yok.</div>
        )}
      </div>

      <div className="p-4 border rounded-lg">
        <div className="font-semibold mb-2">Guild Durumu</div>

        {myGuild?.guild ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">{myGuild.guild.name}</div>
                <div className="text-sm text-slate-500">Capacity: {myGuild.guild.capacity}</div>
              </div>
              <button onClick={leave} className="px-3 py-2 rounded bg-slate-900 text-white text-sm">
                Leave
              </button>
            </div>

            <div>
              <div className="text-sm font-medium mb-1">Members</div>
              <div className="space-y-1">
                {(myGuild.members ?? []).map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                    <span>{m.username}</span>
                    <span className="text-xs text-slate-500">{m.role}</span>
                  </div>
                ))}
              </div>
            </div>

            {myGuild.guild.owner_user_id === me.user.id && (
              <div className="pt-2 border-t">
                <div className="text-sm font-medium mb-2">Owner: Invite</div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-2 border rounded"
                    placeholder="Username"
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                  />
                  <button onClick={sendInvite} className="px-3 py-2 rounded bg-emerald-600 text-white">
                    Invite
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-slate-600">Bir guild'de değilsin.</div>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 border rounded"
                placeholder="Yeni guild adı"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
              <button onClick={createGuild} className="px-3 py-2 rounded bg-slate-900 text-white">
                Create
              </button>
            </div>
            <div className="text-xs text-slate-500">Guild capacity başlangıç 5.</div>
          </div>
        )}
      </div>
    </div>
  );
}
