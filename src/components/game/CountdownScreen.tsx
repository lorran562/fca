// src/components/game/CountdownScreen.tsx
'use client';

import { GameRoom } from '@/types';

interface Props {
  countdown: number;
  room: GameRoom | null;
  userId: string;
}

const PLAYER_COLORS = ['#FFE600', '#00FF94', '#00C2FF', '#FF2D55'];

export default function CountdownScreen({ countdown, room, userId }: Props) {
  return (
    <div className="min-h-dvh bg-dark-900 flex flex-col items-center justify-center p-6 gap-8 relative overflow-hidden">
      {/* Background flash on countdown */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          background: countdown === 1
            ? 'radial-gradient(circle at center, #00FF94, transparent 60%)'
            : 'radial-gradient(circle at center, #FFE600, transparent 60%)',
        }}
      />

      {/* Players list */}
      {room && (
        <div className="w-full max-w-sm fade-slide-up">
          <p className="text-dark-500 text-xs tracking-widest text-center mb-4 uppercase">
            {room.players.length} jogadores prontos
          </p>
          <div className="flex flex-col gap-2">
            {room.players.map((player, idx) => (
              <div
                key={player.id}
                className="flex items-center gap-3 bg-dark-800 border border-dark-700 rounded-xl p-3"
                style={{
                  borderColor: player.id === userId ? PLAYER_COLORS[idx] : undefined,
                  boxShadow: player.id === userId ? `0 0 10px ${PLAYER_COLORS[idx]}33` : undefined,
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-black text-dark-900 text-sm"
                  style={{ background: PLAYER_COLORS[idx] }}
                >
                  {idx + 1}
                </div>
                <span className="text-white font-medium text-sm">
                  {player.displayName}
                  {player.id === userId && (
                    <span className="text-xs text-dark-500 ml-2">(você)</span>
                  )}
                </span>
                <div
                  className="ml-auto w-2 h-2 rounded-full"
                  style={{ background: PLAYER_COLORS[idx], boxShadow: `0 0 6px ${PLAYER_COLORS[idx]}` }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Countdown number */}
      <div className="flex flex-col items-center gap-2">
        {countdown > 0 ? (
          <>
            <p className="text-dark-500 text-xs tracking-widest uppercase">A corrida começa em</p>
            <div
              key={countdown}
              className="countdown-number text-9xl font-black"
              style={{
                fontFamily: 'var(--font-display)',
                color: countdown === 1 ? '#00FF94' : '#FFE600',
                textShadow: countdown === 1
                  ? '0 0 40px #00FF94, 0 0 80px #00FF94'
                  : '0 0 40px #FFE600, 0 0 80px #FFE600',
              }}
            >
              {countdown}
            </div>
          </>
        ) : (
          <div
            className="countdown-number text-7xl font-black text-neon-green glow-green"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            VÁ!
          </div>
        )}
      </div>

      <p className="text-dark-600 text-xs text-center">
        Posicione o dedo no botão
      </p>
    </div>
  );
}
