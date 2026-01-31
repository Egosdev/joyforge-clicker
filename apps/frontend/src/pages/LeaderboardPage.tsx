import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import type {
  LeaderboardSnapshotPayload,
  PlayersLeaderboardItem,
  GuildsLeaderboardItem,
  SubscribePayload
} from '@joyforge/shared';

type Tab = 'players' | 'guilds';

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>('players');
  const [players, setPlayers] = useState<PlayersLeaderboardItem[]>([]);
  const [guilds, setGuilds] = useState<GuildsLeaderboardItem[]>([]);

  useEffect(() => {
    // initial load via REST
    void api.get('/leaderboard/players?limit=100').then((r) => setPlayers(r.data.items));
    void api.get('/leaderboard/guilds?limit=100').then((r) => setGuilds(r.data.items));

    const socket = getSocket();
    const onSnapshot = (p: LeaderboardSnapshotPayload) => {
      if (p.channel === 'lb:players') setPlayers(p.items);
      if (p.channel === 'lb:guilds') setGuilds(p.items);
    };
    socket.on('lb:snapshot', onSnapshot);

    // subscribe both (small payload, simplest)
    const subPlayers: SubscribePayload = { channel: 'lb:players' };
    const subGuilds: SubscribePayload = { channel: 'lb:guilds' };
    socket.emit('subscribe', subPlayers);
    socket.emit('subscribe', subGuilds);

    return () => {
      socket.off('lb:snapshot', onSnapshot);
    };
  }, []);

  const items = tab === 'players' ? players : guilds;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          className={`px-3 py-2 rounded ${tab === 'players' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}
          onClick={() => setTab('players')}
        >
          Players
        </button>
        <button
          className={`px-3 py-2 rounded ${tab === 'guilds' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}
          onClick={() => setTab('guilds')}
        >
          Guilds
        </button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 text-xs text-slate-600">
          <div className="col-span-2">#</div>
          <div className="col-span-7">Name</div>
          <div className="col-span-3 text-right">Score</div>
        </div>

        <div className="divide-y">
          {items.map((it: any) => (
            <div key={tab === 'players' ? it.userId : it.guildId} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm">
              <div className="col-span-2 font-medium">{it.rank}</div>
              <div className="col-span-7 truncate">{tab === 'players' ? it.username : it.guildName}</div>
              <div className="col-span-3 text-right font-semibold">{tab === 'players' ? it.totalUsd : it.goalScore}</div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-500">WebSocket snapshot ~1 sn.</p>
    </div>
  );
}
