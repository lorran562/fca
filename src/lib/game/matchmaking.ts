// src/lib/game/matchmaking.ts — Sistema de matchmaking em memória
// Gerencia a fila global e criação de salas

import { v4 as uuidv4 } from 'uuid';
import { GameRoom, Player } from '@/types';
import { GAME_CONFIG, calculatePrize } from './config';

interface QueueEntry {
  userId: string;
  socketId: string;
  displayName: string;
  joinedAt: number;
}

// Estado em memória — em produção escalável, usar Redis
const queue: QueueEntry[] = [];
const rooms = new Map<string, GameRoom>();

// --- FILA ---

export function joinQueue(entry: QueueEntry): void {
  // Remove se já estava na fila
  leaveQueue(entry.userId);
  queue.push(entry);
  console.log(`[Matchmaking] ${entry.displayName} entrou na fila. Total: ${queue.length}`);
}

export function leaveQueue(userId: string): void {
  const idx = queue.findIndex((e) => e.userId === userId);
  if (idx !== -1) {
    queue.splice(idx, 1);
    console.log(`[Matchmaking] userId ${userId} saiu da fila.`);
  }
}

export function getQueuePosition(userId: string): number {
  return queue.findIndex((e) => e.userId === userId) + 1;
}

export function getQueueSize(): number {
  return queue.length;
}

// Tenta formar uma sala. Retorna a sala criada ou null.
export function tryFormRoom(): GameRoom | null {
  if (queue.length < GAME_CONFIG.MIN_PLAYERS_TO_START) return null;

  // Pega até MAX_PLAYERS_PER_ROOM jogadores da frente da fila
  const candidates = queue.splice(0, GAME_CONFIG.MAX_PLAYERS_PER_ROOM);

  const players: Player[] = candidates.map((c) => ({
    id: c.userId,
    socketId: c.socketId,
    displayName: c.displayName,
    progress: 0,
    clicks: 0,
    isReady: false,
  }));

  const room: GameRoom = {
    id: uuidv4(),
    players,
    phase: 'countdown',
    entryFee: GAME_CONFIG.ENTRY_FEE_COINS,
    totalPot: players.length * GAME_CONFIG.ENTRY_FEE_COINS,
    clicksToWin: GAME_CONFIG.CLICKS_TO_WIN,
  };

  rooms.set(room.id, room);
  console.log(`[Matchmaking] Sala ${room.id} criada com ${players.length} jogadores.`);
  return room;
}

// --- SALAS ---

export function getRoom(roomId: string): GameRoom | undefined {
  return rooms.get(roomId);
}

export function updateRoom(room: GameRoom): void {
  rooms.set(room.id, room);
}

export function deleteRoom(roomId: string): void {
  rooms.delete(roomId);
  console.log(`[Matchmaking] Sala ${roomId} deletada.`);
}

// Encontra a sala de um jogador pelo socketId
export function findRoomBySocketId(socketId: string): GameRoom | undefined {
  const allRooms = Array.from(rooms.values());
  return allRooms.find((room) =>
    room.players.some((p: { socketId: string }) => p.socketId === socketId)
  );
}

// Encontra a sala de um jogador pelo userId
export function findRoomByUserId(userId: string): GameRoom | undefined {
  for (const room of Array.from(rooms.values())) {
    if (room.players.some((p: Player) => p.id === userId)) {
      return room;
    }
  }
  return undefined;
}

// Retorna todos os roomIds ativos (para debug)
export function getActiveRoomsCount(): number {
  return rooms.size;
}
