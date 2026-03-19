// src/types/index.ts — Tipos globais do projeto

export type GamePhase =
  | 'idle'        // Tela inicial
  | 'queuing'     // Na fila de matchmaking
  | 'countdown'   // Contagem regressiva (3-2-1)
  | 'racing'      // Corrida em andamento
  | 'finished';   // Partida encerrada

export interface Player {
  id: string;
  socketId: string;
  displayName: string;
  progress: number;     // 0-100 (percentual)
  clicks: number;       // Total de cliques válidos
  isReady: boolean;
  finishedAt?: number;  // timestamp
}

export interface GameRoom {
  id: string;
  players: Player[];
  phase: GamePhase;
  startedAt?: number;
  finishedAt?: number;
  winnerId?: string;
  entryFee: number;
  totalPot: number;
  clicksToWin: number;
}

export interface UserProfile {
  id: string;
  displayName: string;
  coins: number;
  createdAt: string;
}

export interface MatchResult {
  matchId: string;
  winnerId: string;
  winnerName: string;
  players: Array<{
    id: string;
    name: string;
    clicks: number;
    progress: number;
    position: number;
  }>;
  prize: number;
  entryFee: number;
  isWinner: boolean;
  coinsChange: number;
}

// Eventos Socket.io — Client → Server
export interface ClientToServerEvents {
  'queue:join': (data: { userId: string; displayName: string }) => void;
  'queue:leave': () => void;
  'game:click': (data: { roomId: string; userId: string }) => void;
  'game:ready': (data: { roomId: string; userId: string }) => void;
}

// Eventos Socket.io — Server → Client
export interface ServerToClientEvents {
  'queue:position': (data: { position: number; total: number }) => void;
  'room:joined': (data: { room: GameRoom }) => void;
  'room:updated': (data: { room: GameRoom }) => void;
  'game:countdown': (data: { count: number }) => void;
  'game:start': (data: { room: GameRoom }) => void;
  'game:progress': (data: { playerId: string; progress: number; clicks: number }) => void;
  'game:finished': (data: { result: MatchResult }) => void;
  'error': (data: { message: string }) => void;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'win' | 'loss' | 'entry' | 'initial';
  createdAt: string;
}
