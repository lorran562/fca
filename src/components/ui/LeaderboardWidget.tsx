// src/components/ui/LeaderboardWidget.tsx
'use client';

import { useEffect, useState } from 'react';

interface LeaderEntry {
  id: string;
  display_name: string;
  coins: number;
}

export default function LeaderboardWidget() {
  const [data, setData] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((d) => {
        setData(d.leaderboard || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="w-full bg-dark-800/50 border border-dark-700 rounded-xl p-4">
        <div className="text-dark-600 text-xs text-center animate-pulse">Carregando ranking...</div>
      </div>
    );
  }

  if (!data.length) return null;

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="w-full bg-dark-800/50 border border-dark-700 rounded-xl p-4">
      <h3 className="text-white font-bold text-xs tracking-widest uppercase mb-3 flex items-center gap-2">
        <span className="w-4 h-px bg-neon-blue inline-block" />
        Top Jogadores
        <span className="w-4 h-px bg-neon-blue inline-block" />
      </h3>
      <div className="space-y-2">
        {data.slice(0, 5).map((entry, idx) => (
          <div key={entry.id} className="flex items-center gap-2">
            <span className="text-sm w-5">{medals[idx] || `${idx + 1}.`}</span>
            <span className="flex-1 text-sm text-dark-500 truncate">{entry.display_name}</span>
            <span className="text-xs text-neon-yellow tabular-nums font-bold">
              {entry.coins.toLocaleString('pt-BR')} ₵
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
