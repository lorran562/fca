// src/lib/socket/socketClient.ts — Singleton do cliente Socket.io no browser

import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@/types';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_APP_URL || '', {
      path: '/api/socketio',
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log('[Socket] Conectado ao servidor:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Desconectado:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Erro de conexão:', err.message);
    });
  }

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
