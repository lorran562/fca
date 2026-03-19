// src/hooks/useAuth.ts — Hook de autenticação e perfil do usuário
'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '@/types';

const STORAGE_KEY = 'fca_user';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  // Tenta recuperar sessão do localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setState({ user: parsed, loading: false, error: null });
        // Revalida coins do servidor
        refreshCoins(parsed.id);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        setState({ user: null, loading: false, error: null });
      }
    } else {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  const saveUser = (user: UserProfile) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    setState({ user, loading: false, error: null });
  };

  // Login anônimo — entra direto sem email
  const loginAnonymous = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const authRes = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'anonymous' }),
      });
      const authData = await authRes.json();
      if (!authRes.ok) throw new Error(authData.error);

      // Cria perfil no banco
      const userRes = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: authData.userId,
          displayName: `Player_${authData.userId.slice(0, 6)}`,
        }),
      });
      const userData = await userRes.json();
      if (!userRes.ok) throw new Error(userData.error);

      const profile: UserProfile = {
        id: authData.userId,
        displayName: userData.user.display_name || `Player_${authData.userId.slice(0, 6)}`,
        coins: userData.user.coins,
        createdAt: userData.user.created_at,
      };
      saveUser(profile);
      return profile;
    } catch (err: any) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
      return null;
    }
  }, []);

  // Login com email
  const loginEmail = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const authRes = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'email', email, password }),
      });
      const authData = await authRes.json();
      if (!authRes.ok) throw new Error(authData.error);

      const userRes = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authData.userId }),
      });
      const userData = await userRes.json();
      if (!userRes.ok) throw new Error(userData.error);

      const profile: UserProfile = {
        id: authData.userId,
        displayName: email.split('@')[0],
        coins: userData.user.coins,
        createdAt: userData.user.created_at,
      };
      saveUser(profile);
      return profile;
    } catch (err: any) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
      return null;
    }
  }, []);

  // Refresca coins do servidor
  const refreshCoins = useCallback(async (userId?: string) => {
    const id = userId || state.user?.id;
    if (!id) return;
    try {
      const res = await fetch(`/api/user?userId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setState((s) => {
          if (!s.user) return s;
          const updated = { ...s.user, coins: data.user.coins };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return { ...s, user: updated };
        });
      }
    } catch {
      // silencioso
    }
  }, [state.user?.id]);

  // Atualiza coins localmente (otimista)
  const updateCoins = useCallback((newCoins: number) => {
    setState((s) => {
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

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    loginAnonymous,
    loginEmail,
    refreshCoins,
    updateCoins,
    logout,
  };
}
