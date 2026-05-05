import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, getStoredToken, storeToken, clearToken } from "@/services/api";

export type UserRole = "admin" | "manager" | "viewer";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  initials: string;
  department: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  invitedByName?: string | null;
}

interface AuthContextType {
  currentUser: AppUser | null;
  users: AppUser[];
  isAdmin: boolean;
  isManager: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsSetup: boolean;
  sessionToken: string | null;

  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  setup: (email: string, name: string, password: string, department?: string) => Promise<{ error?: string }>;
  inviteUser: (email: string, name: string, role: UserRole, department?: string) => Promise<{ error?: string; acceptUrl?: string }>;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  deactivateUser: (userId: string) => Promise<void>;
  reactivateUser: (userId: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const token = await getStoredToken();
        if (token) {
          const res = await api.me(token);
          if (res.ok) {
            const user = (await res.json()) as AppUser;
            setCurrentUser(user);
            setSessionToken(token);
            const usersRes = await api.getUsers(token);
            if (usersRes.ok) setUsers((await usersRes.json()) as AppUser[]);
          } else {
            await clearToken();
          }
        } else {
          const statusRes = await api.status();
          if (statusRes.ok) {
            const { needsSetup: ns } = (await statusRes.json()) as { needsSetup: boolean };
            setNeedsSetup(ns);
          }
        }
      } catch {
        // API unreachable — app will show login/setup after load
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const handleAuthSuccess = useCallback(
    async (token: string, user: AppUser) => {
      await storeToken(token);
      setSessionToken(token);
      setCurrentUser(user);
      const usersRes = await api.getUsers(token);
      if (usersRes.ok) setUsers((await usersRes.json()) as AppUser[]);
    },
    []
  );

  const login = useCallback(
    async (email: string, password: string): Promise<{ error?: string }> => {
      try {
        const res = await api.login(email, password);
        if (res.ok) {
          const { token, user } = (await res.json()) as { token: string; user: AppUser };
          await handleAuthSuccess(token, user);
          return {};
        }
        const body = (await res.json()) as { error?: string };
        return { error: body.error ?? "Login failed" };
      } catch {
        return { error: "Could not connect to server" };
      }
    },
    [handleAuthSuccess]
  );

  const logout = useCallback(async () => {
    if (sessionToken) {
      try {
        await api.logout(sessionToken);
      } catch {}
    }
    await clearToken();
    setSessionToken(null);
    setCurrentUser(null);
    setUsers([]);
  }, [sessionToken]);

  const setup = useCallback(
    async (email: string, name: string, password: string, department?: string): Promise<{ error?: string }> => {
      try {
        const res = await api.setup({ email, name, password, department });
        if (res.ok) {
          const { token, user } = (await res.json()) as { token: string; user: AppUser };
          setNeedsSetup(false);
          await handleAuthSuccess(token, user);
          return {};
        }
        const body = (await res.json()) as { error?: string };
        return { error: body.error ?? "Setup failed" };
      } catch {
        return { error: "Could not connect to server" };
      }
    },
    [handleAuthSuccess]
  );

  const refreshUsers = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const res = await api.getUsers(sessionToken);
      if (res.ok) setUsers((await res.json()) as AppUser[]);
    } catch {}
  }, [sessionToken]);

  const inviteUser = useCallback(
    async (email: string, name: string, role: UserRole, department?: string): Promise<{ error?: string; acceptUrl?: string }> => {
      if (!sessionToken) return { error: "Not authenticated" };
      try {
        const res = await api.invite(sessionToken, { email, name, role, department });
        if (res.ok) {
          const body = (await res.json()) as { message: string; acceptUrl: string };
          return { acceptUrl: body.acceptUrl };
        }
        const body = (await res.json()) as { error?: string };
        return { error: body.error ?? "Failed to send invite" };
      } catch {
        return { error: "Could not connect to server" };
      }
    },
    [sessionToken]
  );

  const updateUserRole = useCallback(
    async (userId: string, role: UserRole) => {
      if (!sessionToken) return;
      const res = await api.updateRole(sessionToken, userId, role);
      if (res.ok) await refreshUsers();
    },
    [sessionToken, refreshUsers]
  );

  const deactivateUser = useCallback(
    async (userId: string) => {
      if (!sessionToken) return;
      const res = await api.deactivateUser(sessionToken, userId);
      if (res.ok) await refreshUsers();
    },
    [sessionToken, refreshUsers]
  );

  const reactivateUser = useCallback(
    async (userId: string) => {
      if (!sessionToken) return;
      const res = await api.reactivateUser(sessionToken, userId);
      if (res.ok) await refreshUsers();
    },
    [sessionToken, refreshUsers]
  );

  const deleteUser = useCallback(
    async (userId: string) => {
      if (!sessionToken) return;
      const res = await api.deleteUser(sessionToken, userId);
      if (res.status === 204) await refreshUsers();
    },
    [sessionToken, refreshUsers]
  );

  const isAuthenticated = !!currentUser;
  const isAdmin = currentUser?.role === "admin";
  const isManager = isAdmin || currentUser?.role === "manager";

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        isAdmin,
        isManager,
        isLoading,
        isAuthenticated,
        needsSetup,
        sessionToken,
        login,
        logout,
        setup,
        inviteUser,
        updateUserRole,
        deactivateUser,
        reactivateUser,
        deleteUser,
        refreshUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      currentUser: null,
      users: [],
      isAdmin: false,
      isManager: false,
      isLoading: true,
      isAuthenticated: false,
      needsSetup: false,
      sessionToken: null,
      login: async () => ({}),
      logout: async () => {},
      setup: async () => ({}),
      inviteUser: async () => ({}),
      updateUserRole: async () => {},
      deactivateUser: async () => {},
      reactivateUser: async () => {},
      deleteUser: async () => {},
      refreshUsers: async () => {},
    };
  }
  return ctx;
}
