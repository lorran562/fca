// src/app/api/auth/route.ts — Autenticação via Supabase (anônimo ou email)

import { NextRequest, NextResponse } from 'next/server';
import { createAnonClient } from '@/lib/supabase/server';

// POST /api/auth — Login anônimo ou via email
export async function POST(req: NextRequest) {
  try {
    const { mode, email, password } = await req.json();
    const supabase = createAnonClient();

    if (mode === 'anonymous') {
      // Login anônimo — cria uma sessão temporária
      const { data, error } = await supabase.auth.signInAnonymously();

      if (error) {
        console.error('[API/auth] Erro login anônimo:', error.message);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({
        userId: data.user?.id,
        accessToken: data.session?.access_token,
        isAnonymous: true,
      });
    }

    if (mode === 'email') {
      if (!email || !password) {
        return NextResponse.json({ error: 'Email e senha obrigatórios' }, { status: 400 });
      }

      // Tenta fazer login
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!loginError && loginData.user) {
        return NextResponse.json({
          userId: loginData.user.id,
          accessToken: loginData.session?.access_token,
          isAnonymous: false,
        });
      }

      // Se não encontrou, cria conta
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signupError) {
        return NextResponse.json({ error: signupError.message }, { status: 400 });
      }

      return NextResponse.json({
        userId: signupData.user?.id,
        accessToken: signupData.session?.access_token,
        isAnonymous: false,
        isNew: true,
      });
    }

    return NextResponse.json({ error: 'Modo de autenticação inválido' }, { status: 400 });
  } catch (err) {
    console.error('[API/auth] Erro inesperado:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
