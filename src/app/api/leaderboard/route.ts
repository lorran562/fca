// src/app/api/leaderboard/route.ts — Top jogadores por wins
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('users')
    .select('id, display_name, coins')
    .order('coins', { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar ranking' }, { status: 500 });
  }

  return NextResponse.json({ leaderboard: data || [] });
}
