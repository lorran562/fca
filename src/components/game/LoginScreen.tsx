// src/components/game/LoginScreen.tsx
'use client';

import { useState } from 'react';

interface Props {
  onLoginAnonymous: () => Promise<any>;
  onLoginEmail: (email: string, password: string) => Promise<any>;
  error: string | null;
  loading: boolean;
}

export default function LoginScreen({ onLoginAnonymous, onLoginEmail, error, loading }: Props) {
  const [mode, setMode] = useState<'menu' | 'email'>('menu');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    await onLoginEmail(email, password);
  };

  return (
    <div className="min-h-dvh bg-dark-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,230,0,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,230,0,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Glow orb */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #FFE600, transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-sm fade-slide-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <div
            className="text-7xl tracking-wider text-neon-yellow glow-yellow mb-1"
            style={{ fontFamily: 'var(--font-display)', lineHeight: 1 }}
          >
            FLASH
          </div>
          <div
            className="text-4xl tracking-widest text-white"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            CLICK ARENA
          </div>
          <p className="mt-3 text-dark-500 text-sm tracking-widest uppercase">
            May the fastest finger win
          </p>
        </div>

        {mode === 'menu' && (
          <div className="flex flex-col gap-3">
            {/* Entrar anonimamente */}
            <button
              onClick={onLoginAnonymous}
              disabled={loading}
              className="w-full py-4 text-lg font-black tracking-widest uppercase rounded-lg no-select transition-all active:scale-95"
              style={{
                fontFamily: 'var(--font-display)',
                background: 'var(--neon-yellow)',
                color: '#080808',
                boxShadow: '0 0 20px rgba(255,230,0,0.5)',
                letterSpacing: '0.15em',
              }}
            >
              {loading ? '...' : '⚡ JOGAR AGORA'}
            </button>

            {/* Linha divisória */}
            <div className="flex items-center gap-3 my-1">
              <div className="flex-1 h-px bg-dark-600" />
              <span className="text-dark-500 text-xs tracking-widest">OU</span>
              <div className="flex-1 h-px bg-dark-600" />
            </div>

            {/* Login com email */}
            <button
              onClick={() => setMode('email')}
              className="w-full py-3 text-sm font-bold tracking-widest uppercase rounded-lg border border-dark-500 text-dark-500 hover:border-white hover:text-white transition-colors no-select"
            >
              Login com Email
            </button>
          </div>
        )}

        {mode === 'email' && (
          <form onSubmit={handleEmail} className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg bg-dark-700 border border-dark-500 text-white placeholder-dark-500 focus:outline-none focus:border-neon-yellow text-sm"
            />
            <input
              type="password"
              placeholder="senha (mín. 6 caracteres)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-lg bg-dark-700 border border-dark-500 text-white placeholder-dark-500 focus:outline-none focus:border-neon-yellow text-sm"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 text-lg font-black tracking-widest uppercase rounded-lg no-select transition-all active:scale-95"
              style={{
                fontFamily: 'var(--font-display)',
                background: 'var(--neon-yellow)',
                color: '#080808',
                boxShadow: '0 0 20px rgba(255,230,0,0.4)',
              }}
            >
              {loading ? '...' : 'ENTRAR / CRIAR CONTA'}
            </button>

            <button
              type="button"
              onClick={() => setMode('menu')}
              className="text-dark-500 text-sm hover:text-white transition-colors"
            >
              ← Voltar
            </button>
          </form>
        )}

        {/* Erro */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-neon-red/10 border border-neon-red/30 text-neon-red text-sm text-center">
            {error}
          </div>
        )}

        {/* Info moedas */}
        <p className="text-center text-dark-500 text-xs mt-8">
          Ganhe <span className="text-neon-yellow">1.000 ₵</span> de bônus ao entrar
        </p>
      </div>
    </div>
  );
}
