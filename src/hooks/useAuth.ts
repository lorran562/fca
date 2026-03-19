'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '@/types';
import { createClient } from '@/lib/supabase/client';

const STORAGE_KEY = 'fca_user';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, error: null });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setState({ user: JSON.parse(stored), loading: false, error: null });
        return;
      } catch { localStorage.removeItem(STORAGE_KEY); }
    }
    setState(s => ({ ...s, loading: false }));
  }, []);

  const saveUser = (user: UserProfile) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    setState({ user, loading: false, error: null });
  };

  const ensureProfile = async (userId: string, displayName: string): Promise<UserProfile> => {
    const supabase = createClient();
    const { data: existing } = await supabase
      .from('users')
      .select('id, display_name, coins, created_at')
      .eq('id', userId)
      .single();

    if (existing) {
      return { id: existing.id, displayName: existing.display_name, coins: existing.coins, avatarIndex: 0, createdAt: existing.created_at };
    }

    const { data: newUser } = await supabase
      .from('users')
      .insert({ id: userId, display_name: displayName, coins: 1000, avatar_index: 0 })
      .select('id, display_name, coins, created_at')
      .single();

    await supabase.from('transactions').insert({ user_id: userId, amount: 1000, type: 'initial' });

    return { id: userId, displayName: displayName, coins: newUser?.coins ?? 1000, avatarIndex: 0, createdAt: newUser?.created_at ?? '' };
  };

  const loginAnonymous = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      const userId = data.user!.id;
      const displayName = `Player_${userId.slice(0, 6)}`;
      const profile = await ensureProfile(userId, displayName);
      saveUser(profile);
    } catch (e: any) {
      setState(s => ({ ...s, loading: false, error: e.message }));
    }
  }, []);

  const loginEmail = useCallback(async (email: string, password: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const supabase = createClient();
      let userId: string;
      const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
      if (!loginErr && loginData.user) {
        userId = loginData.user.id;
      } else {
        const { data: signupData, error: signupErr } = await supabase.auth.signUp({ email, password });
        if (signupErr) throw signupErr;
        userId = signupData.user!.id;
      }
      const profile = await ensureProfile(userId, email.split('@')[0]);
      saveUser(profile);
    } catch (e: any) {
      setState(s => ({ ...s, loading: false, error: e.message }));
    }
  }, []);

  const refreshCoins = useCallback(async (userId?: string) => {
    const id = userId || state.user?.id;
    if (!id) return;
    try {
      const supabase = createClient();
      const { data } = await supabase.from('users').select('coins').eq('id', id).single();
      if (data) {
        setState(s => {
          if (!s.user) return s;
          const updated = { ...s.user, coins: data.coins };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return { ...s, user: updated };
        });
      }
    } catch {}
  }, [state.user?.id]);

  const updateCoins = useCallback((newCoins: number) => {
    setState(s => {
      if (!s.user) return s;
      const updated = { ...s.user, coins: newCoins };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return { ...s, user: updated };
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ user: null, loading: false, error: null });
  }, []);

  return { user: state.user, loading: state.loading, error: state.error, loginAnonymous, loginEmail, refreshCoins, updateCoins, logout };
}
