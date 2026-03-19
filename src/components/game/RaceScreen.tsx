// src/components/game/RaceScreen.tsx
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { GameRoom } from '@/types';

interface PlayerProgress {
  [playerId: string]: {
    progress: number;
    clicks: number;
    displayName: string;
  };
}

interface Props {
  room: GameRoom;
  progress: PlayerProgress;
  userId: string;
  onClick: () => void;
}

const PLAYER_COLORS = ['#FFE600', '#00FF94', '#00C2FF', '#FF2D55'];
const CLICK_PARTICLES = 6;

interface Particle {
  id: number;
  x: number;
  y: number;
}

export default function RaceScreen({ room, progress, userId, onClick }: Props) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [clickCount, setClickCount] = useState(0);
  const [isPressed, setIsPressed] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const particleIdRef = useRef(0);

  // Keyboard support — barra de espaço e enter
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleClick();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const spawnParticles = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;

    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0]?.clientX ?? rect.left + rect.width / 2;
      clientY = e.touches[0]?.clientY ?? rect.top + rect.height / 2;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const newParticles: Particle[] = Array.from({ length: CLICK_PARTICLES }, () => ({
      id: particleIdRef.current++,
      x: clientX - rect.left,
      y: clientY - rect.top,
    }));

    setParticles((prev) => [...prev.slice(-20), ...newParticles]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !newParticles.find((np) => np.id === p.id)));
    }, 600);
  }, []);

  const handleClick = useCallback(() => {
    onClick();
    setClickCount((c) => c + 1);
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 80);
  }, [onClick]);

  const handleButtonEvent = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    spawnParticles(e);
    handleClick();
  }, [spawnParticles, handleClick]);

  // Sorted players by progress
  const sortedPlayers = room.players
    .map((p, idx) => ({
      ...p,
      colorIdx: idx,
      currentProgress: progress[p.id]?.progress ?? 0,
      currentClicks: progress[p.id]?.clicks ?? 0,
    }))
    .sort((a, b) => b.currentProgress - a.currentProgress);

  const myPlayer = sortedPlayers.find((p) => p.id === userId);
  const myProgress = myPlayer?.currentProgress ?? 0;

  return (
    <div className="min-h-dvh bg-dark-900 flex flex-col relative overflow-hidden select-none">
      {/* Top bar — jogadores e progresso */}
      <div className="relative z-10 p-4 border-b border-dark-700 bg-dark-900/90 backdrop-blur-sm">
        <div className="space-y-2.5 max-w-sm mx-auto">
          {sortedPlayers.map((player) => {
            const color = PLAYER_COLORS[player.colorIdx];
            const isMe = player.id === userId;
            return (
              <div key={player.id} className="flex items-center gap-3">
                {/* Nome */}
                <div className="w-24 truncate text-right">
                  <span className={`text-xs font-bold ${isMe ? 'text-white' : 'text-dark-500'}`}>
                    {player.displayName}
                    {isMe && <span className="text-dark-600 ml-1">(eu)</span>}
                  </span>
                </div>

                {/* Barra de progresso */}
                <div className="flex-1 h-4 bg-dark-700 rounded-full overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-100 ease-out"
                    style={{
                      width: `${player.currentProgress}%`,
                      background: color,
                      boxShadow: isMe ? `0 0 10px ${color}` : undefined,
                      '--bar-color': color,
                    } as React.CSSProperties}
                  />
                  {/* Emoji no final da barra */}
                  {player.currentProgress > 5 && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 text-xs transition-all duration-100"
                      style={{ left: `calc(${Math.min(player.currentProgress, 95)}% - 8px)` }}
                    >
                      🏃
                    </div>
                  )}
                </div>

                {/* Percentual */}
                <div className="w-10 text-right">
                  <span className="text-xs tabular-nums" style={{ color }}>
                    {Math.round(player.currentProgress)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Meu progresso em destaque */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-between p-6 pb-8">
        {/* Minha barra grande */}
        <div className="w-full max-w-sm mt-4">
          <div className="flex justify-between mb-2">
            <span className="text-dark-500 text-xs tracking-widest uppercase">Meu progresso</span>
            <span className="text-neon-yellow font-black tabular-nums" style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}>
              {Math.round(myProgress)}%
            </span>
          </div>
          <div className="h-6 bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-75"
              style={{
                width: `${myProgress}%`,
                background: 'linear-gradient(90deg, #FFE600, #FFB300)',
                boxShadow: '0 0 15px rgba(255,230,0,0.6)',
              }}
            />
          </div>

          {/* Clicks count */}
          <div className="flex justify-between mt-2 text-xs text-dark-600">
            <span>{myPlayer?.currentClicks ?? 0} cliques</span>
            <span>100 para vencer</span>
          </div>
        </div>

        {/* Click button */}
        <div className="relative w-full max-w-xs">
          {/* Particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
            {particles.map((particle) => (
              <div
                key={particle.id}
                className="absolute w-2 h-2 rounded-full bg-neon-yellow"
                style={{
                  left: particle.x,
                  top: particle.y,
                  animation: 'particle-float 0.6s ease-out forwards',
                  transform: `rotate(${Math.random() * 360}deg)`,
                  '--dx': `${(Math.random() - 0.5) * 60}px`,
                } as React.CSSProperties}
              />
            ))}
          </div>

          {/* Main click button */}
          <button
            ref={btnRef}
            onMouseDown={handleButtonEvent}
            onTouchStart={handleButtonEvent}
            className="click-btn w-full h-44 rounded-3xl font-black no-select transition-transform"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '3.5rem',
              letterSpacing: '0.05em',
              background: isPressed
                ? 'linear-gradient(135deg, #FFB300, #FF8C00)'
                : 'linear-gradient(135deg, #FFE600, #FFB300)',
              color: '#080808',
              transform: isPressed ? 'scale(0.93)' : 'scale(1)',
              boxShadow: isPressed
                ? '0 0 10px rgba(255,230,0,0.4)'
                : '0 0 30px rgba(255,230,0,0.6), 0 0 60px rgba(255,230,0,0.2)',
              transition: 'transform 0.07s ease, box-shadow 0.07s ease',
            }}
          >
            ⚡ CLIQUE!
          </button>

          <p className="text-center text-dark-600 text-xs mt-3">
            Espaço / Enter também funcionam
          </p>
        </div>
      </div>
    </div>
  );
}
