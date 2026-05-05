import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMeQueryKey,
  getMe,
  login as apiLogin,
  logout as apiLogout,
  setAuthTokenGetter,
  setBaseUrl,
} from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useStore } from "@/store/useStore";

import { resolveApiBaseUrl } from "./apiBaseUrl";
import { clearStoredToken, getStoredToken, setStoredToken } from "./storage";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  // Apply a session that was issued out-of-band (e.g. by the
  // accept-invite flow which returns its own token + user).
  applySession: (session: { token: string; user: User }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Configure base URL + bearer-token getter once at module load so the
// generated client works from the very first request.
const baseUrl = resolveApiBaseUrl();
if (baseUrl) setBaseUrl(baseUrl);

const tokenRef: { current: string | null } = { current: null };
setAuthTokenGetter(() => tokenRef.current);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const syncAuthUser = useStore((s) => s.syncAuthUser);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const bootedRef = useRef(false);

  // Keep the local Zustand store's currentUserId in lockstep with the
  // authenticated identity so legacy `useCurrentUser`-based screens see
  // the signed-in user (and never a stale prior identity).
  useEffect(() => {
    syncAuthUser(
      user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            active: user.active,
            streamId: user.streamId ?? null,
            teamId: user.teamId ?? null,
          }
        : null,
    );
  }, [user, syncAuthUser]);

  const setToken = useCallback(async (token: string | null) => {
    tokenRef.current = token;
    if (token) await setStoredToken(token);
    else await clearStoredToken();
  }, []);

  const refresh = useCallback(async () => {
    if (!tokenRef.current) {
      setUser(null);
      return;
    }
    try {
      const me = await getMe();
      setUser(me);
      qc.setQueryData(getGetMeQueryKey(), me);
    } catch (err: unknown) {
      const status = (err as { status?: number } | null)?.status;
      if (status === 401) {
        await setToken(null);
        setUser(null);
        qc.removeQueries({ queryKey: getGetMeQueryKey() });
      } else {
        // Transient network/server error — keep token AND keep the
        // currently-known user (if any) so the session persists
        // through brief outages instead of bouncing to /login.
        // eslint-disable-next-line no-console
        console.warn("[auth] /me failed (keeping session)", err);
      }
    }
  }, [qc, setToken]);

  // Bootstrap: read stored token, fetch /me.
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    (async () => {
      try {
        const stored = await getStoredToken();
        tokenRef.current = stored;
        if (stored) await refresh();
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const session = await apiLogin({ email, password });
      await setToken(session.token);
      setUser(session.user);
      qc.setQueryData(getGetMeQueryKey(), session.user);
    },
    [qc, setToken],
  );

  const signOut = useCallback(async () => {
    if (tokenRef.current) {
      try {
        await apiLogout();
      } catch {
        /* ignore — we're clearing the local token anyway */
      }
    }
    await setToken(null);
    setUser(null);
    qc.clear();
  }, [qc, setToken]);

  const applySession = useCallback(
    async (session: { token: string; user: User }) => {
      await setToken(session.token);
      setUser(session.user);
      qc.setQueryData(getGetMeQueryKey(), session.user);
    },
    [qc, setToken],
  );

  return (
    <AuthContext.Provider
      value={{ user, isLoading, signIn, signOut, refresh, applySession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
