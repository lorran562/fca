// src/app/api/user/route.ts — Gerencia perfil do usuário

import { NextRequest, NextResponse } from 'next/server';
import { createAnonClient } from "@/lib/supabase/server";
import { GAME_CONFIG } from '@/lib/game/config';

// GET /api/user?userId=xxx — Retorna perfil e saldo
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 });
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, coins, created_at')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  return NextResponse.json({ user: data });
}

// POST /api/user — Cria ou recupera perfil do usuário
export async function POST(req: NextRequest) {
  try {
    const { userId, displayName } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 });
    }

    const supabase = createAnonClient();

    // Tenta encontrar o usuário
    const { data: existing } = await supabase
      .from('users')
      .select('id, coins, created_at')
      .eq('id', userId)
      .single();

    if (existing) {
      return NextResponse.json({ user: existing, created: false });
    }

    // Cria novo usuário com saldo inicial
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        id: userId,
        coins: GAME_CONFIG.INITIAL_COINS,
        display_name: displayName || `Player_${userId.slice(0, 6)}`,
      })
      .select('id, coins, created_at, display_name')
      .single();

    if (error) {
      console.error('[API/user] Erro ao criar usuário:', error);
      return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 });
    }

    // Registra transação inicial
    await supabase.from('transactions').insert({
      user_id: userId,
      amount: GAME_CONFIG.INITIAL_COINS,
      type: 'initial',
    });

    return NextResponse.json({ user: newUser, created: true }, { status: 201 });
  } catch (err) {
    console.error('[API/user] Erro inesperado:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
