import { io, Socket } from 'socket.io-client';
import { WS_URL } from './env';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      withCredentials: true,
      transports: ['websocket']
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
