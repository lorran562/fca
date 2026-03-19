// src/app/api/match/route.ts — Histórico de partidas do jogador

import { NextRequest, NextResponse } from 'next/server';
import { createAnonClient } from '@/lib/supabase/server';

// GET /api/match?userId=xxx&limit=10
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10');

  if (!userId) {
    return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 });
  }

  const supabase = createAnonClient();

  const { data, error } = await supabase
    .from('matches')
    .select('id, created_at, players, winner_id, total_pot')
    .contains('players', JSON.stringify([{ id: userId }]))
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[API/match] Erro ao buscar partidas:', error.message);
    return NextResponse.json({ error: 'Erro ao buscar histórico' }, { status: 500 });
  }

  return NextResponse.json({ matches: data || [] });
}
