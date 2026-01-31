import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import type { SubscribePayload, LeaderboardSnapshotPayload, LeaderboardChannel } from '@joyforge/shared';
import { env } from './config';
import { redisSub } from './redis';

const ALLOWED_CHANNELS: Set<LeaderboardChannel> = new Set(['lb:players', 'lb:guilds']);

export async function attachSocket(server: HttpServer) {
  const io = new Server(server, {
    cors: {
      origin: env.PUBLIC_APP_ORIGIN,
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    socket.on('subscribe', (payload: SubscribePayload) => {
      if (!payload || !ALLOWED_CHANNELS.has(payload.channel)) {
        socket.emit('error', { error: 'INVALID_CHANNEL' });
        return;
      }
      socket.join(payload.channel);
    });
  });

  // PubSub from worker: {channel, ts, items}
  await redisSub.subscribe('pub:lb:snapshot', (message) => {
    try {
      const payload = JSON.parse(message) as LeaderboardSnapshotPayload;
      if (!payload || !ALLOWED_CHANNELS.has(payload.channel)) return;
      io.to(payload.channel).emit('lb:snapshot', payload);
    } catch (e) {
      console.error('[socket pubsub parse]', e);
    }
  });

  return io;
}
