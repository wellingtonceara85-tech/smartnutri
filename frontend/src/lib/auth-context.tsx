'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch } from './api-client';

export type UserRole = 'ADMIN' | 'NUTRITIONIST' | 'RECEPTION';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId: string;
  tenantName: string;
}

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const SESSION_MARKER_COOKIE = 'sf_has_session';
const SESSION_MARKER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Cookie não-sensível apenas para o proxy.ts decidir se redireciona para
 * /login — a sessão real é o refresh token httpOnly guardado pelo backend
 * (Path=/auth, inacessível ao JS) e o access token, mantido só em memória.
 */
function setSessionMarker(present: boolean) {
  if (present) {
    document.cookie = `${SESSION_MARKER_COOKIE}=1; path=/; max-age=${SESSION_MARKER_MAX_AGE_SECONDS}; samesite=lax`;
  } else {
    document.cookie = `${SESSION_MARKER_COOKIE}=; path=/; max-age=0`;
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    apiFetch<LoginResponse>('/auth/refresh', { method: 'POST' })
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        setAccessToken(data.accessToken);
        setSessionMarker(true);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        setSessionMarker(false);
        setStatus('unauthenticated');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setUser(data.user);
    setAccessToken(data.accessToken);
    setSessionMarker(true);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      setAccessToken(null);
      setSessionMarker(false);
      setStatus('unauthenticated');
    }
  }, []);

  return <AuthContext.Provider value={{ user, accessToken, status, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return ctx;
}
