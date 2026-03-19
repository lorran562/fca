// src/lib/game/antiCheat.ts — Validação de cliques e anti-cheat server-side

import { GAME_CONFIG } from './config';

interface ClickRecord {
  timestamps: number[];
}

// Mapa: socketId → registro de cliques
const clickRecords = new Map<string, ClickRecord>();

/**
 * Valida se um clique é legítimo.
 * Retorna true se válido, false se deve ser ignorado.
 */
export function validateClick(socketId: string): boolean {
  const now = Date.now();
  const windowMs = 1000; // janela de 1 segundo

  if (!clickRecords.has(socketId)) {
    clickRecords.set(socketId, { timestamps: [] });
  }

  const record = clickRecords.get(socketId)!;

  // Remove timestamps fora da janela de 1 segundo
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

  // Verifica limite de CPS
  if (record.timestamps.length >= GAME_CONFIG.MAX_CPS) {
    console.warn(`[AntiCheat] socketId ${socketId} excedeu ${GAME_CONFIG.MAX_CPS} CPS`);
    return false;
  }

  // Registra o clique válido
  record.timestamps.push(now);
  return true;
}

/**
 * Calcula o avanço por clique com pequena variação randômica server-side.
 * Isso evita que todos progridam de forma perfeitamente linear.
 */
export function calculateClickProgress(clicksToWin: number): number {
  const baseProgress = 100 / clicksToWin;
  const variation = GAME_CONFIG.RANDOM_VARIATION_PERCENT / 100;
  const randomFactor = 1 + (Math.random() * 2 - 1) * variation;
  return baseProgress * randomFactor;
}

/**
 * Limpa o registro de um socket ao desconectar.
 */
export function clearClickRecord(socketId: string): void {
  clickRecords.delete(socketId);
}
