// src/components/game/QueueScreen.tsx
'use client';

import { useEffect, useState } from 'react';

interface Props {
  position: number;
  onCancel: () => void;
}

export default function QueueScreen({ position, onCancel }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [dots, setDots] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const dotsTimer = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 400);
    return () => clearInterval(dotsTimer);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-dvh bg-dark-900 flex flex-col items-center justify-center p-6 gap-10 relative overflow-hidden">
      {/* Pulsing rings */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="absolute rounded-full border border-neon-yellow/20"
          style={{
            width: `${i * 180}px`,
            height: `${i * 180}px`,
            animation: `ping ${1.5 + i * 0.3}s cubic-bezier(0, 0, 0.2, 1) infinite`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}

      {/* Center icon */}
      <div className="relative">
        <div
          className="w-24 h-24 rounded-full bg-dark-800 border-2 border-neon-yellow flex items-center justify-center"
          style={{ boxShadow: '0 0 30px rgba(255,230,0,0.4)' }}
        >
          <span className="text-4xl">⚡</span>
        </div>
      </div>

      {/* Text */}
      <div className="text-center">
        <div
          className="text-5xl text-white mb-2"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}
        >
          BUSCANDO{dots}
        </div>
        <p className="text-dark-500 text-sm">Procurando oponentes</p>
      </div>

      {/* Stats */}
      <div className="flex gap-6">
        <div className="text-center">
          <div className="text-2xl font-black text-neon-yellow tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
            #{position || '—'}
          </div>
          <div className="text-dark-500 text-xs tracking-widest mt-0.5">NA FILA</div>
        </div>
        <div className="w-px bg-dark-600" />
        <div className="text-center">
          <div className="text-2xl font-black text-neon-blue tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
            {formatTime(elapsed)}
          </div>
          <div className="text-dark-500 text-xs tracking-widest mt-0.5">AGUARDANDO</div>
        </div>
      </div>

      {/* Cancel */}
      <button
        onClick={onCancel}
        className="px-8 py-3 rounded-xl border border-dark-600 text-dark-500 hover:border-neon-red hover:text-neon-red transition-all text-sm font-bold tracking-widest uppercase no-select"
      >
        Cancelar
      </button>

      <p className="text-dark-600 text-xs text-center max-w-xs">
        A partida inicia automaticamente quando houver 2 ou mais jogadores
      </p>
    </div>
  );
}
