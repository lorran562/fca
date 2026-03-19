-- =============================================================
-- FLASH CLICK ARENA — Schema SQL para o Supabase
-- Execute este arquivo no SQL Editor do Supabase
-- =============================================================

-- Habilitar UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================
-- TABELA: users
-- =============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT        NOT NULL DEFAULT '',
  coins         INTEGER     NOT NULL DEFAULT 1000 CHECK (coins >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para buscas por saldo
CREATE INDEX IF NOT EXISTS idx_users_coins ON public.users(coins DESC);

-- RLS: usuários só leem/editam seus próprios dados
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- =============================================================
-- TABELA: matches
-- =============================================================
CREATE TABLE IF NOT EXISTS public.matches (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  players     JSONB       NOT NULL DEFAULT '[]',
  winner_id   UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  total_pot   INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_matches_created_at  ON public.matches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_winner_id   ON public.matches(winner_id);
CREATE INDEX IF NOT EXISTS idx_matches_players_gin ON public.matches USING GIN(players);

-- RLS: partidas são públicas para leitura
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "matches_select_all" ON public.matches
  FOR SELECT USING (true);

-- Apenas service role pode inserir/atualizar
CREATE POLICY "matches_insert_service" ON public.matches
  FOR INSERT WITH CHECK (true);

-- =============================================================
-- TABELA: transactions
-- =============================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount      INTEGER     NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN ('win', 'loss', 'entry', 'initial')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_transactions_user_id    ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

-- RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "transactions_insert_service" ON public.transactions
  FOR INSERT WITH CHECK (true);

-- =============================================================
-- FUNCTIONS: operações atômicas de coins
-- (Chamadas server-side pelo service role)
-- =============================================================

-- Adiciona coins ao usuário
CREATE OR REPLACE FUNCTION public.add_coins(p_user_id UUID, p_amount INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET coins = coins + p_amount
  WHERE id = p_user_id;
END;
$$;

-- Deduz coins do usuário (verifica saldo suficiente)
CREATE OR REPLACE FUNCTION public.deduct_coins(p_user_id UUID, p_amount INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_coins INTEGER;
BEGIN
  SELECT coins INTO current_coins FROM public.users WHERE id = p_user_id FOR UPDATE;

  IF current_coins < p_amount THEN
    RETURN FALSE;
  END IF;

  UPDATE public.users
  SET coins = coins - p_amount
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;

-- =============================================================
-- TRIGGER: auto-cria perfil público ao registrar no auth
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, display_name, coins)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Player_' || LEFT(NEW.id::text, 6)),
    1000
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =============================================================
-- PERMISSÕES para service_role
-- =============================================================
GRANT ALL ON public.users        TO service_role;
GRANT ALL ON public.matches      TO service_role;
GRANT ALL ON public.transactions TO service_role;
GRANT EXECUTE ON FUNCTION public.add_coins    TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_coins TO service_role;
