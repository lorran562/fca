// src/components/game/LobbyScreen.tsx
'use client';

import { UserProfile } from '@/types';
import CoinDisplay from '@/components/ui/CoinDisplay';
import LeaderboardWidget from '@/components/ui/LeaderboardWidget';
import { GAME_CONFIG } from '@/lib/game/config';

interface Props {
  user: UserProfile;
  onPlay: () => void;
  onLogout: () => void;
}

const ENTRY_FEE = 100; // fallback visual; valor real vem do config

export default function LobbyScreen({ user, onPlay, onLogout }: Props) {
  const hasEnoughCoins = user.coins >= ENTRY_FEE;

  return (
    <div className="min-h-dvh bg-dark-900 flex flex-col relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,230,0,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,230,0,0.5) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between p-5 border-b border-dark-700">
        <div>
          <div
            className="text-2xl text-neon-yellow glow-yellow"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}
          >
            FLASH ARENA
          </div>
          <p className="text-dark-500 text-xs mt-0.5">Olá, {user.displayName}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <CoinDisplay coins={user.coins} size="md" />
          <button
            onClick={onLogout}
            className="text-dark-500 text-xs hover:text-white transition-colors"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 gap-8">
        {/* Title */}
        <div className="text-center fade-slide-up">
          <div
            className="text-8xl text-white mb-2"
            style={{ fontFamily: 'var(--font-display)', lineHeight: 1 }}
          >
            PRONTO
          </div>
          <div
            className="text-4xl text-neon-yellow glow-yellow"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            PARA CORRER?
          </div>
        </div>

        {/* Info cards */}
        <div className="w-full max-w-sm grid grid-cols-3 gap-3">
          {[
            { label: 'ENTRADA', value: `${ENTRY_FEE} ₵`, color: 'text-neon-yellow' },
            { label: 'JOGADORES', value: '2–4', color: 'text-neon-blue' },
            { label: 'CLIQUES', value: '100', color: 'text-neon-green' },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-dark-800 border border-dark-600 rounded-xl p-3 text-center"
            >
              <div className={`text-xl font-black ${item.color}`} style={{ fontFamily: 'var(--font-display)' }}>
                {item.value}
              </div>
              <div className="text-dark-500 text-xs mt-1 tracking-widest">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Play button */}
        <div className="w-full max-w-sm">
          {hasEnoughCoins ? (
            <button
              onClick={onPlay}
              className="click-btn w-full py-6 rounded-2xl no-select transition-transform active:scale-95"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '2.5rem',
                letterSpacing: '0.1em',
                background: 'var(--neon-yellow)',
                color: '#080808',
                boxShadow: '0 0 30px rgba(255,230,0,0.6), 0 0 60px rgba(255,230,0,0.2)',
              }}
            >
              ⚡ JOGAR
            </button>
          ) : (
            <div className="w-full py-5 rounded-2xl bg-dark-700 border border-dark-500 text-center">
              <p className="text-neon-red font-bold">Coins insuficientes</p>
              <p className="text-dark-500 text-sm mt-1">
                Você precisa de {ENTRY_FEE} ₵ para jogar
              </p>
            </div>
          )}
        </div>

        {/* How to play */}
        <div className="w-full max-w-sm bg-dark-800/50 border border-dark-700 rounded-xl p-4">
          <h3 className="text-white font-bold text-xs tracking-widest uppercase mb-3 flex items-center gap-2">
            <span className="w-4 h-px bg-neon-yellow inline-block" />
            Como Jogar
            <span className="w-4 h-px bg-neon-yellow inline-block" />
          </h3>
          <ol className="text-dark-500 text-sm space-y-1.5">
            <li>1. Clique em <span className="text-neon-yellow">JOGAR</span> para entrar na fila</li>
            <li>2. Aguarde 2–4 jogadores se juntarem</li>
            <li>3. Na largada, clique o mais rápido possível</li>
            <li>4. Primeiro a chegar a <span className="text-neon-green">100%</span> vence</li>
            <li>5. Vencedor leva <span className="text-neon-yellow">90%</span> do pote total</li>
          </ol>
        </div>

        {/* Leaderboard */}
        <div className="w-full max-w-sm">
          <LeaderboardWidget />
        </div>
      </main>
    </div>
  );
}
