// src/lib/game/config.ts — Configurações centrais do jogo
// Todos os valores são lidos das env vars com fallback seguro

export const GAME_CONFIG = {
  // Economia
  ENTRY_FEE_COINS: parseInt(process.env.ENTRY_FEE_COINS || '100'),
  PLATFORM_FEE_PERCENT: parseInt(process.env.PLATFORM_FEE_PERCENT || '10'),
  INITIAL_COINS: parseInt(process.env.INITIAL_COINS || '1000'),

  // Sala
  MAX_PLAYERS_PER_ROOM: parseInt(process.env.MAX_PLAYERS_PER_ROOM || '4'),
  MIN_PLAYERS_TO_START: parseInt(process.env.MIN_PLAYERS_TO_START || '2'),
  MATCHMAKING_TIMEOUT_MS: parseInt(process.env.MATCHMAKING_TIMEOUT_MS || '30000'),

  // Corrida
  CLICKS_TO_WIN: parseInt(process.env.CLICKS_TO_WIN || '100'),
  COUNTDOWN_SECONDS: 3,
  MAX_GAME_DURATION_MS: 60_000, // 1 minuto máximo

  // Anti-cheat
  MAX_CPS: parseInt(process.env.MAX_CPS || '10'),
  RANDOM_VARIATION_PERCENT: 5, // ±5% variação randômica server-side
} as const;

// Calcula prêmio líquido para o vencedor
export function calculatePrize(numPlayers: number, entryFee: number): number {
  const totalPot = numPlayers * entryFee;
  const platformFee = Math.floor(totalPot * (GAME_CONFIG.PLATFORM_FEE_PERCENT / 100));
  return totalPot - platformFee;
}
