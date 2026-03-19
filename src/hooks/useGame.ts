// src/hooks/useGame.ts — Hook principal de estado do jogo
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GamePhase, GameRoom, MatchResult, UserProfile } from '@/types';
import { getSocket } from '@/lib/socket/socketClient';

interface PlayerProgress {
  [playerId: string]: {
    progress: number;
    clicks: number;
    displayName: string;
  };
}

interface GameState {
  phase: GamePhase;
  room: GameRoom | null;
  countdown: number;
  progress: PlayerProgress;
  result: MatchResult | null;
  queuePosition: number;
  error: string | null;
}

const initialState: GameState = {
  phase: 'idle',
  room: null,
  countdown: 0,
  progress: {},
  result: null,
  queuePosition: 0,
  error: null,
};

export function useGame(user: UserProfile | null) {
  const [state, setState] = useState<GameState>(initialState);
  const clickCooldown = useRef(false);

  useEffect(() => {
    if (!user) return;

    const socket = getSocket();

    // Posição na fila
    socket.on('queue:position', ({ position, total }) => {
      setState((s) => ({ ...s, queuePosition: position, phase: 'queuing' }));
    });

    // Entrou na sala
    socket.on('room:joined', ({ room }) => {
      const progress: PlayerProgress = {};
      room.players.forEach((p) => {
        progress[p.id] = {
          progress: 0,
          clicks: 0,
          displayName: p.displayName,
        };
      });
      setState((s) => ({ ...s, room, progress, phase: 'countdown' }));
    });

    // Sala atualizada (ex: jogador saiu)
    socket.on('room:updated', ({ room }) => {
      setState((s) => ({ ...s, room }));
    });

    // Countdown
    socket.on('game:countdown', ({ count }) => {
      setState((s) => ({ ...s, countdown: count, phase: 'countdown' }));
    });

    // Corrida iniciada
    socket.on('game:start', ({ room }) => {
      setState((s) => ({ ...s, room, phase: 'racing', countdown: 0 }));
    });

    // Progresso em tempo real
    socket.on('game:progress', ({ playerId, progress, clicks }) => {
      setState((s) => ({
        ...s,
        progress: {
          ...s.progress,
          [playerId]: {
            ...(s.progress[playerId] || {}),
            progress,
            clicks,
          },
        },
      }));
    });

    // Partida encerrada
    socket.on('game:finished', ({ result }) => {
      setState((s) => ({ ...s, result, phase: 'finished' }));
    });

    // Erros
    socket.on('error', ({ message }) => {
      setState((s) => ({ ...s, error: message }));
    });

    return () => {
      socket.off('queue:position');
      socket.off('room:joined');
      socket.off('room:updated');
      socket.off('game:countdown');
      socket.off('game:start');
      socket.off('game:progress');
      socket.off('game:finished');
      socket.off('error');
    };
  }, [user]);

  // Entra na fila
  const joinQueue = useCallback(() => {
    if (!user) return;
    const socket = getSocket();
    socket.emit('queue:join', {
      userId: user.id,
      displayName: user.displayName,
    });
    setState((s) => ({ ...s, phase: 'queuing', error: null }));
  }, [user]);

  // Sai da fila
  const leaveQueue = useCallback(() => {
    const socket = getSocket();
    socket.emit('queue:leave');
    setState(initialState);
  }, []);

  // Clique na corrida — com debounce visual leve
  const sendClick = useCallback(() => {
    if (!user || !state.room || state.phase !== 'racing') return;
    if (clickCooldown.current) return;

    const socket = getSocket();
    socket.emit('game:click', {
      roomId: state.room.id,
      userId: user.id,
    });

    // Cooldown visual mínimo (não é anti-cheat, apenas feedback)
    clickCooldown.current = true;
    setTimeout(() => { clickCooldown.current = false; }, 30);
  }, [user, state.room, state.phase]);

  // Reinicia para jogar novamente
  const playAgain = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    ...state,
    joinQueue,
    leaveQueue,
    sendClick,
    playAgain,
  };
}
