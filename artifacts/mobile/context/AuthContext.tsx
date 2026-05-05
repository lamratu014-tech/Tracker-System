import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type UserRole = "admin" | "manager" | "viewer";

export interface AppUser {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: UserRole;
  department: string;
  active: boolean;
  createdAt: string;
}

interface AuthContextType {
  currentUser: AppUser;
  users: AppUser[];
  isAdmin: boolean;
  isManager: boolean;
  switchUser: (userId: string) => void;
  updateUserRole: (userId: string, role: UserRole) => void;
  addUser: (user: Omit<AppUser, "id" | "createdAt">) => void;
  deactivateUser: (userId: string) => void;
}

const DEFAULT_USER: AppUser = {
  id: "u1",
  name: "Alex Morgan",
  initials: "AM",
  email: "a.morgan@organisation.org",
  role: "admin",
  department: "Operations",
  active: true,
  createdAt: new Date(Date.now() - 86400000 * 60).toISOString(),
};

const AuthContext = createContext<AuthContextType>({
  currentUser: DEFAULT_USER,
  users: [DEFAULT_USER],
  isAdmin: true,
  isManager: true,
  switchUser: () => {},
  updateUserRole: () => {},
  addUser: () => {},
  deactivateUser: () => {},
});

const USERS_KEY = "ops_users_v1";
const CURRENT_USER_KEY = "ops_current_user_v1";

function genId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 6);
}

const SEED_USERS: AppUser[] = [
  DEFAULT_USER,
  { id: "u2", name: "Sarah Chen", initials: "SC", email: "s.chen@organisation.org", role: "manager", department: "Events", active: true, createdAt: new Date(Date.now() - 86400000 * 45).toISOString() },
  { id: "u3", name: "James Liu", initials: "JL", email: "j.liu@organisation.org", role: "manager", department: "HR", active: true, createdAt: new Date(Date.now() - 86400000 * 30).toISOString() },
  { id: "u4", name: "Nina Patel", initials: "NP", email: "n.patel@organisation.org", role: "manager", department: "Facilities", active: true, createdAt: new Date(Date.now() - 86400000 * 20).toISOString() },
  { id: "u5", name: "Tom Reid", initials: "TR", email: "t.reid@organisation.org", role: "viewer", department: "Finance", active: true, createdAt: new Date(Date.now() - 86400000 * 10).toISOString() },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<AppUser[]>(SEED_USERS);
  const [currentUserId, setCurrentUserId] = useState<string>("u1");

  useEffect(() => {
    async function load() {
      try {
        const [storedUsers, storedCurrent] = await Promise.all([
          AsyncStorage.getItem(USERS_KEY),
          AsyncStorage.getItem(CURRENT_USER_KEY),
        ]);
        if (storedUsers) setUsers(JSON.parse(storedUsers));
        if (storedCurrent) setCurrentUserId(storedCurrent);
      } catch {}
    }
    load();
  }, []);

  const saveUsers = useCallback(async (data: AppUser[]) => {
    setUsers(data);
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(data));
  }, []);

  const switchUser = useCallback(async (userId: string) => {
    setCurrentUserId(userId);
    await AsyncStorage.setItem(CURRENT_USER_KEY, userId);
  }, []);

  const updateUserRole = useCallback((userId: string, role: UserRole) => {
    saveUsers(users.map((u) => (u.id === userId ? { ...u, role } : u)));
  }, [users, saveUsers]);

  const addUser = useCallback((user: Omit<AppUser, "id" | "createdAt">) => {
    saveUsers([...users, { ...user, id: genId(), createdAt: new Date().toISOString() }]);
  }, [users, saveUsers]);

  const deactivateUser = useCallback((userId: string) => {
    saveUsers(users.map((u) => (u.id === userId ? { ...u, active: false } : u)));
  }, [users, saveUsers]);

  const currentUser = users.find((u) => u.id === currentUserId) ?? DEFAULT_USER;

  return (
    <AuthContext.Provider value={{
      currentUser,
      users,
      isAdmin: currentUser.role === "admin",
      isManager: currentUser.role === "admin" || currentUser.role === "manager",
      switchUser,
      updateUserRole,
      addUser,
      deactivateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
