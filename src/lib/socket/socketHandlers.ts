// src/lib/socket/socketHandlers.ts — Handlers do Socket.io
// Toda a lógica de jogo crítica roda aqui no servidor

import { Server, Socket } from 'socket.io';
import {
  joinQueue,
  leaveQueue,
  getQueuePosition,
  getQueueSize,
  tryFormRoom,
  getRoom,
  updateRoom,
  deleteRoom,
  findRoomBySocketId,
} from '../game/matchmaking';
import { validateClick, calculateClickProgress, clearClickRecord } from '../game/antiCheat';
import { GAME_CONFIG, calculatePrize } from '../game/config';
import { GameRoom, MatchResult } from '@/types';
import { createServiceClient } from '../supabase/server';

// Intervalo do matchmaking — tenta formar salas a cada 2s
const MATCHMAKING_INTERVAL_MS = 2000;

export function setupSocketHandlers(io: Server): void {
  // Loop de matchmaking: roda no servidor, independente de conexões
  setInterval(() => {
    const room = tryFormRoom();
    if (room) {
      startRoom(io, room);
    }
  }, MATCHMAKING_INTERVAL_MS);

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Conectado: ${socket.id}`);

    // --- ENTRAR NA FILA ---
    socket.on('queue:join', ({ userId, displayName }) => {
      if (!userId || !displayName) {
        socket.emit('error', { message: 'Dados inválidos para entrar na fila.' });
        return;
      }

      joinQueue({ userId, socketId: socket.id, displayName, joinedAt: Date.now() });

      const position = getQueuePosition(userId);
      const total = getQueueSize();
      socket.emit('queue:position', { position, total });

      console.log(`[Queue] ${displayName} (#${position} de ${total})`);
    });

    // --- SAIR DA FILA ---
    socket.on('queue:leave', () => {
      const room = findRoomBySocketId(socket.id);
      if (!room) {
        // Não está em sala, remove da fila
        leaveQueue(socket.id);
      }
    });

    // --- CLIQUE NA CORRIDA ---
    socket.on('game:click', ({ roomId, userId }) => {
      const room = getRoom(roomId);
      if (!room || room.phase !== 'racing') return;

      // Valida anti-cheat
      if (!validateClick(socket.id)) return;

      // Encontra o jogador
      const playerIdx = room.players.findIndex((p) => p.id === userId);
      if (playerIdx === -1) return;

      // Calcula progresso com variação randômica
      const progressGain = calculateClickProgress(room.clicksToWin);
      const player = room.players[playerIdx];

      player.clicks += 1;
      player.progress = Math.min(100, player.progress + progressGain);

      updateRoom(room);

      // Emite atualização para toda a sala
      io.to(roomId).emit('game:progress', {
        playerId: userId,
        progress: player.progress,
        clicks: player.clicks,
      });

      // Verifica se o jogador venceu
      if (player.progress >= 100 && !room.winnerId) {
        player.finishedAt = Date.now();
        room.winnerId = userId;
        room.phase = 'finished';
        room.finishedAt = Date.now();
        updateRoom(room);

        finishGame(io, room);
      }
    });

    // --- DESCONEXÃO ---
    socket.on('disconnect', () => {
      console.log(`[Socket] Desconectado: ${socket.id}`);
      clearClickRecord(socket.id);

      // Se estava em sala ativa, remove o jogador
      const room = findRoomBySocketId(socket.id);
      if (room && room.phase === 'racing') {
        // Remove o jogador da sala
        room.players = room.players.filter((p) => p.socketId !== socket.id);
        updateRoom(room);

        // Se sobrou apenas 1 jogador, ele vence por W.O.
        if (room.players.length === 1 && !room.winnerId) {
          room.winnerId = room.players[0].id;
          room.phase = 'finished';
          room.finishedAt = Date.now();
          updateRoom(room);
          finishGame(io, room);
        } else if (room.players.length === 0) {
          deleteRoom(room.id);
        } else {
          io.to(room.id).emit('room:updated', { room });
        }
      }
    });
  });
}

// --- Inicia uma sala (countdown → racing) ---
async function startRoom(io: Server, room: GameRoom): Promise<void> {
  // Coloca todos na sala Socket.io
  for (const player of room.players) {
    const socket = io.sockets.sockets.get(player.socketId);
    if (socket) {
      socket.join(room.id);
    }
  }

  // Notifica todos que entraram na sala
  io.to(room.id).emit('room:joined', { room });

  // Deduz entry fee de cada jogador no banco
  await deductEntryFees(room);

  // Countdown: 3, 2, 1
  for (let count = GAME_CONFIG.COUNTDOWN_SECONDS; count >= 1; count--) {
    io.to(room.id).emit('game:countdown', { count });
    await sleep(1000);
  }

  // Inicia a corrida
  room.phase = 'racing';
  room.startedAt = Date.now();
  updateRoom(room);

  io.to(room.id).emit('game:start', { room });
  console.log(`[Game] Sala ${room.id} iniciada! Fase: racing`);

  // Timeout de segurança: encerra partidas que durarem demais
  setTimeout(() => {
    const currentRoom = getRoom(room.id);
    if (currentRoom && currentRoom.phase === 'racing') {
      console.warn(`[Game] Sala ${room.id} encerrada por timeout.`);
      // Vencedor é quem tiver mais progresso
      const sorted = [...currentRoom.players].sort((a, b) => b.progress - a.progress);
      if (sorted.length > 0) {
        currentRoom.winnerId = sorted[0].id;
        currentRoom.phase = 'finished';
        currentRoom.finishedAt = Date.now();
        updateRoom(currentRoom);
        finishGame(io, currentRoom);
      }
    }
  }, GAME_CONFIG.MAX_GAME_DURATION_MS);
}

// --- Finaliza o jogo e distribui prêmios ---
async function finishGame(io: Server, room: GameRoom): Promise<void> {
  const winner = room.players.find((p) => p.id === room.winnerId);
  if (!winner) return;

  const prize = calculatePrize(room.players.length, room.entryFee);

  // Ordena jogadores por progresso para ranking
  const sortedPlayers = [...room.players].sort((a, b) => b.progress - a.progress);

  const result: MatchResult = {
    matchId: room.id,
    winnerId: room.winnerId!,
    winnerName: winner.displayName,
    players: sortedPlayers.map((p, idx) => ({
      id: p.id,
      name: p.displayName,
      clicks: p.clicks,
      progress: Math.round(p.progress),
      position: idx + 1,
    })),
    prize,
    entryFee: room.entryFee,
    isWinner: false, // Será customizado por jogador no emit
    coinsChange: 0,
  };

  // Emite resultado customizado para cada jogador
  for (const player of room.players) {
    const socket = io.sockets.sockets.get(player.socketId);
    if (socket) {
      const isWinner = player.id === room.winnerId;
      const coinsChange = isWinner ? prize - room.entryFee : -room.entryFee;
      socket.emit('game:finished', {
        result: { ...result, isWinner, coinsChange },
      });
    }
  }

  // Persiste resultado no Supabase (async, não bloqueia)
  persistMatchResult(room, prize).catch(console.error);

  // Limpa sala após 10s
  setTimeout(() => deleteRoom(room.id), 10_000);

  console.log(`[Game] Sala ${room.id} finalizada. Vencedor: ${winner.displayName} (+${prize} coins)`);
}

// --- Persiste resultado no Supabase ---
async function persistMatchResult(room: GameRoom, prize: number): Promise<void> {
  try {
    const supabase = createServiceClient();

    // Salva a partida
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        id: room.id,
        players: room.players.map((p) => ({ id: p.id, name: p.displayName })),
        winner_id: room.winnerId,
        total_pot: room.totalPot,
      })
      .select()
      .single();

    if (matchError) {
      console.error('[DB] Erro ao salvar partida:', matchError.message);
      return;
    }

    // Credita prêmio ao vencedor
    if (room.winnerId) {
      await supabase.rpc('add_coins', {
        p_user_id: room.winnerId,
        p_amount: prize,
      });

      await supabase.from('transactions').insert({
        user_id: room.winnerId,
        amount: prize,
        type: 'win',
      });
    }

    console.log(`[DB] Partida ${room.id} salva com sucesso.`);
  } catch (err) {
    console.error('[DB] Erro inesperado ao persistir partida:', err);
  }
}

// --- Deduz entry fee de cada jogador ---
async function deductEntryFees(room: GameRoom): Promise<void> {
  try {
    const supabase = createServiceClient();

    for (const player of room.players) {
      await supabase.rpc('deduct_coins', {
        p_user_id: player.id,
        p_amount: room.entryFee,
      });

      await supabase.from('transactions').insert({
        user_id: player.id,
        amount: -room.entryFee,
        type: 'entry',
      });
    }
  } catch (err) {
    console.error('[DB] Erro ao deduzir entry fees:', err);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
