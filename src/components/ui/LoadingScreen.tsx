// src/components/ui/LoadingScreen.tsx
'use client';

export default function LoadingScreen() {
  return (
    <div className="min-h-dvh bg-dark-900 flex flex-col items-center justify-center gap-6">
      {/* Logo */}
      <div className="text-center">
        <h1
          className="text-5xl tracking-widest text-neon-yellow glow-yellow"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          FLASH
        </h1>
        <h1
          className="text-3xl tracking-widest text-white"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          CLICK ARENA
        </h1>
      </div>

      {/* Spinner */}
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-neon-yellow"
            style={{
              animation: `pulse 0.8s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
