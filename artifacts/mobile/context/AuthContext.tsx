import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api, getStoredToken, storeToken, clearToken } from "@/services/api";

export type UserRole = "programme_lead" | "team_lead";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  initials: string;
  department: string;
  role: UserRole;
  teamId: string | null;
  active: boolean;
  createdAt: string;
  invitedByName?: string | null;
}

interface AuthContextType {
  currentUser: AppUser | null;
  users: AppUser[];
  isProgrammeLead: boolean;
  isTeamLead: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  needsSetup: boolean;
  sessionToken: string | null;

  login: (email: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  setup: (email: string, name: string, password: string, department?: string, setupSecret?: string) => Promise<{ error?: string }>;
  inviteUser: (email: string, name: string, role: UserRole, department?: string) => Promise<{ error?: string; acceptUrl?: string }>;
  updateUserRole: (userId: string, role: UserRole, teamId?: string | null) => Promise<void>;
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
            if (user.role === "programme_lead") {
              const usersRes = await api.getUsers(token);
              if (usersRes.ok) setUsers((await usersRes.json()) as AppUser[]);
            }
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
        // API unreachable
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
      if (user.role === "programme_lead") {
        const usersRes = await api.getUsers(token);
        if (usersRes.ok) setUsers((await usersRes.json()) as AppUser[]);
      } else {
        setUsers([]);
      }
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
      try { await api.logout(sessionToken); } catch {}
    }
    await clearToken();
    setSessionToken(null);
    setCurrentUser(null);
    setUsers([]);
  }, [sessionToken]);

  const setup = useCallback(
    async (email: string, name: string, password: string, department?: string, setupSecret?: string): Promise<{ error?: string }> => {
      if (!setupSecret) return { error: "Setup secret is required." };
      try {
        const res = await api.setup({ email, name, password, department, setupSecret });
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
    if (!sessionToken || currentUser?.role !== "programme_lead") return;
    try {
      const res = await api.getUsers(sessionToken);
      if (res.ok) setUsers((await res.json()) as AppUser[]);
    } catch {}
  }, [sessionToken, currentUser]);

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
    async (userId: string, role: UserRole, teamId?: string | null) => {
      if (!sessionToken) return;
      const res = await api.updateRole(sessionToken, userId, role, teamId);
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

  const isProgrammeLead = currentUser?.role === "programme_lead";
  const isTeamLead = isProgrammeLead || currentUser?.role === "team_lead";
  const isAuthenticated = !!currentUser;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        isProgrammeLead,
        isTeamLead,
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
      isProgrammeLead: false,
      isTeamLead: false,
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
