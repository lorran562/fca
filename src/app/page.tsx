// src/app/page.tsx — Página principal: orquestra todas as telas do jogo
'use client';

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useGame } from '@/hooks/useGame';

import LoginScreen from '@/components/game/LoginScreen';
import LobbyScreen from '@/components/game/LobbyScreen';
import QueueScreen from '@/components/game/QueueScreen';
import CountdownScreen from '@/components/game/CountdownScreen';
import RaceScreen from '@/components/game/RaceScreen';
import ResultScreen from '@/components/game/ResultScreen';
import LoadingScreen from '@/components/ui/LoadingScreen';

export default function Home() {
  const auth = useAuth();
  const game = useGame(auth.user);

  // Após resultado, atualiza coins do servidor
  useEffect(() => {
    if (game.phase === 'finished' && game.result && auth.user) {
      const newCoins = auth.user.coins + game.result.coinsChange;
      auth.updateCoins(newCoins);
      // Revalida do servidor após 1s
      setTimeout(() => auth.refreshCoins(), 1000);
    }
  }, [game.phase, game.result]);

  // Loading inicial
  if (auth.loading) return <LoadingScreen />;

  // Login
  if (!auth.user) {
    return (
      <LoginScreen
        onLoginAnonymous={auth.loginAnonymous}
        onLoginEmail={auth.loginEmail}
        error={auth.error}
        loading={auth.loading}
      />
    );
  }

  // Roteamento por fase do jogo
  switch (game.phase) {
    case 'idle':
      return (
        <LobbyScreen
          user={auth.user}
          onPlay={game.joinQueue}
          onLogout={auth.logout}
        />
      );

    case 'queuing':
      return (
        <QueueScreen
          position={game.queuePosition}
          onCancel={game.leaveQueue}
        />
      );

    case 'countdown':
      return (
        <CountdownScreen
          countdown={game.countdown}
          room={game.room}
          userId={auth.user.id}
        />
      );

    case 'racing':
      return (
        <RaceScreen
          room={game.room!}
          progress={game.progress}
          userId={auth.user.id}
          onClick={game.sendClick}
        />
      );

    case 'finished':
      return (
        <ResultScreen
          result={game.result!}
          userId={auth.user.id}
          coins={auth.user.coins}
          onPlayAgain={() => {
            game.playAgain();
          }}
        />
      );

    default:
      return <LoadingScreen />;
  }
}
