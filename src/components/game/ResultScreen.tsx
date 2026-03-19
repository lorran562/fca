// src/components/game/ResultScreen.tsx
'use client';

import { MatchResult } from '@/types';
import CoinDisplay from '@/components/ui/CoinDisplay';

interface Props {
  result: MatchResult;
  userId: string;
  coins: number;
  onPlayAgain: () => void;
}

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣'];
const PLAYER_COLORS = ['#FFE600', '#C0C0C0', '#CD7F32', '#888888'];

export default function ResultScreen({ result, userId, coins, onPlayAgain }: Props) {
  const isWinner = result.isWinner;
  const coinsChange = result.coinsChange;

  return (
    <div className="min-h-dvh bg-dark-900 flex flex-col items-center justify-between p-6 relative overflow-hidden">
      {/* Winner confetti bg */}
      {isWinner && (
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background: 'radial-gradient(circle at 50% 30%, #FFE600, transparent 60%)',
          }}
        />
      )}

      <div className="w-full max-w-sm flex flex-col items-center gap-6 mt-8 fade-slide-up">
        {/* Result badge */}
        <div className="text-center">
          <div className="text-7xl mb-3">
            {isWinner ? '🏆' : '💀'}
          </div>
          <div
            className="text-6xl mb-1"
            style={{
              fontFamily: 'var(--font-display)',
              color: isWinner ? '#FFE600' : '#FF2D55',
              textShadow: isWinner
                ? '0 0 30px #FFE600, 0 0 60px #FFE600'
                : '0 0 30px #FF2D55, 0 0 60px #FF2D55',
            }}
          >
            {isWinner ? 'VITÓRIA!' : 'DERROTA'}
          </div>
          <p className="text-dark-500 text-sm">
            {isWinner
              ? `${result.winnerName} foi o mais rápido!`
              : `${result.winnerName} venceu a corrida`}
          </p>
        </div>

        {/* Coins change */}
        <div
          className={`w-full rounded-2xl p-4 text-center border ${
            isWinner
              ? 'bg-neon-yellow/10 border-neon-yellow/30'
              : 'bg-neon-red/10 border-neon-red/30'
          }`}
        >
          <div className="text-dark-500 text-xs tracking-widest uppercase mb-1">
            {isWinner ? 'Prêmio recebido' : 'Entrada perdida'}
          </div>
          <div
            className={`text-4xl font-black ${isWinner ? 'text-neon-yellow' : 'text-neon-red'}`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {isWinner ? '+' : ''}{coinsChange} ₵
          </div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-dark-500 text-xs">Saldo atual:</span>
            <CoinDisplay coins={coins} size="sm" />
          </div>
        </div>

        {/* Leaderboard da partida */}
        <div className="w-full">
          <h3 className="text-dark-500 text-xs tracking-widest uppercase mb-3 text-center">
            Resultado da Partida
          </h3>
          <div className="space-y-2">
            {result.players.map((player, idx) => {
              const isMe = player.id === userId;
              return (
                <div
                  key={player.id}
                  className={`flex items-center gap-3 rounded-xl p-3 ${
                    isMe ? 'bg-dark-700 border border-dark-500' : 'bg-dark-800'
                  }`}
                >
                  {/* Medal */}
                  <span className="text-xl w-8 text-center">{MEDALS[idx] || '—'}</span>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <div className={`font-bold text-sm truncate ${isMe ? 'text-white' : 'text-dark-500'}`}>
                      {player.name}
                      {isMe && <span className="text-dark-600 ml-1 font-normal">(você)</span>}
                    </div>
                    <div className="text-dark-600 text-xs">{player.clicks} cliques</div>
                  </div>

                  {/* Progress bar mini */}
                  <div className="w-16">
                    <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${player.progress}%`,
                          background: PLAYER_COLORS[idx],
                        }}
                      />
                    </div>
                    <div
                      className="text-xs text-right mt-0.5 tabular-nums"
                      style={{ color: PLAYER_COLORS[idx] }}
                    >
                      {player.progress}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="w-full max-w-sm flex flex-col gap-3 mt-6">
        <button
          onClick={onPlayAgain}
          className="w-full py-5 rounded-2xl font-black tracking-widest uppercase no-select transition-all active:scale-95"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.8rem',
            background: 'var(--neon-yellow)',
            color: '#080808',
            boxShadow: '0 0 25px rgba(255,230,0,0.5)',
          }}
        >
          ⚡ JOGAR NOVAMENTE
        </button>

        {/* Economia info */}
        <p className="text-dark-600 text-xs text-center">
          Pote: {result.prize + Math.round(result.entryFee * result.players.length * 0.1)} ₵
          {' · '}
          Prêmio: {result.prize} ₵
          {' · '}
          Taxa: 10%
        </p>
      </div>
    </div>
  );
}
