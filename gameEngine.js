// gameEngine.js — Lógica do jogo em JS puro para o servidor customizado
// Separado do TypeScript para garantir compatibilidade em produção (Railway/Render)

const { v4: uuidv4 } = require('uuid');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  ENTRY_FEE_COINS:       parseInt(process.env.ENTRY_FEE_COINS        || '100'),
  PLATFORM_FEE_PERCENT:  parseInt(process.env.PLATFORM_FEE_PERCENT   || '10'),
  MAX_PLAYERS_PER_ROOM:  parseInt(process.env.MAX_PLAYERS_PER_ROOM   || '4'),
  MIN_PLAYERS_TO_START:  parseInt(process.env.MIN_PLAYERS_TO_START   || '2'),
  CLICKS_TO_WIN:         parseInt(process.env.CLICKS_TO_WIN          || '100'),
  COUNTDOWN_SECONDS:     3,
  MAX_GAME_DURATION_MS:  60_000,
  MAX_CPS:               parseInt(process.env.MAX_CPS                || '10'),
  RANDOM_VARIATION_PCT:  5,
  MATCHMAKING_INTERVAL:  2000,
};

function calculatePrize(numPlayers, entryFee) {
  const pot = numPlayers * entryFee;
  return pot - Math.floor(pot * (CONFIG.PLATFORM_FEE_PERCENT / 100));
}

// ─── STATE ────────────────────────────────────────────────────────────────────
const queue      = [];           // { userId, socketId, displayName, joinedAt }
const rooms      = new Map();    // roomId → room
const clickMap   = new Map();    // socketId → [timestamps]

// ─── QUEUE ────────────────────────────────────────────────────────────────────
function joinQueue(entry) {
  leaveQueue(entry.userId);
  queue.push(entry);
}
function leaveQueue(userId) {
  const i = queue.findIndex(e => e.userId === userId);
  if (i !== -1) queue.splice(i, 1);
}
function tryFormRoom() {
  if (queue.length < CONFIG.MIN_PLAYERS_TO_START) return null;
  const candidates = queue.splice(0, CONFIG.MAX_PLAYERS_PER_ROOM);
  const players = candidates.map(c => ({
    id: c.userId, socketId: c.socketId, displayName: c.displayName,
    progress: 0, clicks: 0, isReady: false,
  }));
  const room = {
    id: uuidv4(), players, phase: 'countdown',
    entryFee: CONFIG.ENTRY_FEE_COINS,
    totalPot: players.length * CONFIG.ENTRY_FEE_COINS,
    clicksToWin: CONFIG.CLICKS_TO_WIN,
  };
  rooms.set(room.id, room);
  return room;
}
function findRoomBySocketId(socketId) {
  for (const r of rooms.values())
    if (r.players.some(p => p.socketId === socketId)) return r;
}

// ─── ANTI-CHEAT ───────────────────────────────────────────────────────────────
function validateClick(socketId) {
  const now = Date.now();
  if (!clickMap.has(socketId)) clickMap.set(socketId, []);
  const ts = clickMap.get(socketId).filter(t => now - t < 1000);
  if (ts.length >= CONFIG.MAX_CPS) return false;
  ts.push(now);
  clickMap.set(socketId, ts);
  return true;
}
function clickProgress() {
  const base = 100 / CONFIG.CLICKS_TO_WIN;
  const v    = CONFIG.RANDOM_VARIATION_PCT / 100;
  return base * (1 + (Math.random() * 2 - 1) * v);
}

// ─── SUPABASE (optional — silently skipped if keys missing) ───────────────────
let supabase = null;
try {
  const { createClient } = require('@supabase/supabase-js');
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
} catch {}

async function persistMatch(room, prize) {
  if (!supabase) return;
  try {
    await supabase.from('matches').insert({
      id: room.id,
      players: room.players.map(p => ({ id: p.id, name: p.displayName })),
      winner_id: room.winnerId,
      total_pot: room.totalPot,
    });
    if (room.winnerId) {
      await supabase.rpc('add_coins', { p_user_id: room.winnerId, p_amount: prize });
      await supabase.from('transactions').insert({ user_id: room.winnerId, amount: prize, type: 'win' });
    }
  } catch (e) { console.error('[DB] persistMatch error:', e.message); }
}

async function deductEntryFees(room) {
  if (!supabase) return;
  for (const p of room.players) {
    try {
      await supabase.rpc('deduct_coins', { p_user_id: p.id, p_amount: room.entryFee });
      await supabase.from('transactions').insert({ user_id: p.id, amount: -room.entryFee, type: 'entry' });
    } catch {}
  }
}

// ─── GAME FLOW ────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function startRoom(io, room) {
  // Junta todos na sala Socket.io
  for (const p of room.players) {
    const s = io.sockets.sockets.get(p.socketId);
    if (s) s.join(room.id);
  }
  io.to(room.id).emit('room:joined', { room });
  await deductEntryFees(room);

  // Countdown
  for (let i = CONFIG.COUNTDOWN_SECONDS; i >= 1; i--) {
    io.to(room.id).emit('game:countdown', { count: i });
    await sleep(1000);
  }

  room.phase = 'racing';
  room.startedAt = Date.now();
  rooms.set(room.id, room);
  io.to(room.id).emit('game:start', { room });
  console.log(`[Game] Sala ${room.id} iniciada com ${room.players.length} jogadores`);

  // Timeout de segurança
  setTimeout(() => {
    const r = rooms.get(room.id);
    if (r && r.phase === 'racing') {
      const sorted = [...r.players].sort((a, b) => b.progress - a.progress);
      if (sorted.length > 0) {
        r.winnerId = sorted[0].id;
        r.phase = 'finished';
        rooms.set(r.id, r);
        finishGame(io, r);
      }
    }
  }, CONFIG.MAX_GAME_DURATION_MS);
}

async function finishGame(io, room) {
  const winner = room.players.find(p => p.id === room.winnerId);
  if (!winner) return;
  const prize = calculatePrize(room.players.length, room.entryFee);
  const sorted = [...room.players].sort((a, b) => b.progress - a.progress);

  const baseResult = {
    matchId: room.id,
    winnerId: room.winnerId,
    winnerName: winner.displayName,
    players: sorted.map((p, i) => ({
      id: p.id, name: p.displayName,
      clicks: p.clicks, progress: Math.round(p.progress), position: i + 1,
    })),
    prize,
    entryFee: room.entryFee,
  };

  for (const p of room.players) {
    const s = io.sockets.sockets.get(p.socketId);
    if (s) {
      const isWinner = p.id === room.winnerId;
      s.emit('game:finished', {
        result: { ...baseResult, isWinner, coinsChange: isWinner ? prize - room.entryFee : -room.entryFee },
      });
    }
  }

  persistMatch(room, prize).catch(console.error);
  setTimeout(() => rooms.delete(room.id), 10_000);
  console.log(`[Game] Sala ${room.id} finalizada. Vencedor: ${winner.displayName}`);
}

// ─── SOCKET SETUP (exportado para server.js) ──────────────────────────────────
function setupSocketHandlers(io) {
  // Loop de matchmaking
  setInterval(() => {
    const room = tryFormRoom();
    if (room) startRoom(io, room);
  }, CONFIG.MATCHMAKING_INTERVAL);

  io.on('connection', socket => {
    console.log(`[Socket] + ${socket.id}`);

    socket.on('queue:join', ({ userId, displayName }) => {
      if (!userId || !displayName) return socket.emit('error', { message: 'Dados inválidos.' });
      joinQueue({ userId, socketId: socket.id, displayName, joinedAt: Date.now() });
      const pos = queue.findIndex(e => e.userId === userId) + 1;
      socket.emit('queue:position', { position: pos, total: queue.length });
    });

    socket.on('queue:leave', () => leaveQueue(socket.id));

    socket.on('game:click', ({ roomId, userId }) => {
      const room = rooms.get(roomId);
      if (!room || room.phase !== 'racing') return;
      if (!validateClick(socket.id)) return;

      const p = room.players.find(p => p.id === userId);
      if (!p) return;

      p.clicks += 1;
      p.progress = Math.min(100, p.progress + clickProgress());
      rooms.set(room.id, room);

      io.to(roomId).emit('game:progress', {
        playerId: userId, progress: p.progress, clicks: p.clicks,
      });

      if (p.progress >= 100 && !room.winnerId) {
        p.finishedAt = Date.now();
        room.winnerId = userId;
        room.phase = 'finished';
        room.finishedAt = Date.now();
        rooms.set(room.id, room);
        finishGame(io, room);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] - ${socket.id}`);
      clickMap.delete(socket.id);
      const room = findRoomBySocketId(socket.id);
      if (room && room.phase === 'racing') {
        room.players = room.players.filter(p => p.socketId !== socket.id);
        if (room.players.length === 1 && !room.winnerId) {
          room.winnerId = room.players[0].id;
          room.phase = 'finished';
          room.finishedAt = Date.now();
          rooms.set(room.id, room);
          finishGame(io, room);
        } else if (room.players.length === 0) {
          rooms.delete(room.id);
        } else {
          rooms.set(room.id, room);
          io.to(room.id).emit('room:updated', { room });
        }
      }
    });
  });
}

module.exports = { setupSocketHandlers };
