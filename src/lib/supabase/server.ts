// src/lib/supabase/server.ts — Cliente Supabase para uso no servidor (API routes, Server Components)
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Cliente com service role para operações privilegiadas (server-side apenas)
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// Cliente anônimo para operações de leitura pública
export function createAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
