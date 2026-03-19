// src/components/ui/CoinDisplay.tsx
'use client';

interface CoinDisplayProps {
  coins: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function CoinDisplay({ coins, size = 'md' }: CoinDisplayProps) {
  const sizes = {
    sm: 'text-sm gap-1',
    md: 'text-base gap-1.5',
    lg: 'text-xl gap-2',
  };

  const iconSizes = {
    sm: 'w-4 h-4 text-xs',
    md: 'w-5 h-5 text-sm',
    lg: 'w-7 h-7 text-base',
  };

  return (
    <div className={`flex items-center ${sizes[size]} font-bold`}>
      {/* Coin icon */}
      <div
        className={`${iconSizes[size]} rounded-full bg-neon-yellow flex items-center justify-center text-dark-900 font-black`}
        style={{ boxShadow: '0 0 8px rgba(255,230,0,0.6)' }}
      >
        ₵
      </div>
      <span className="text-neon-yellow tabular-nums">
        {coins.toLocaleString('pt-BR')}
      </span>
    </div>
  );
}
