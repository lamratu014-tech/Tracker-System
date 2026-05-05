import { Platform } from "react-native";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

const TOKEN_KEY = "ops_session_token";

export async function getStoredToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return typeof localStorage !== "undefined"
      ? localStorage.getItem(TOKEN_KEY)
      : null;
  }
  try {
    const { default: SecureStore } = await import("expo-secure-store");
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function storeToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  try {
    const { default: SecureStore } = await import("expo-secure-store");
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {}
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.removeItem(TOKEN_KEY);
    return;
  }
  try {
    const { default: SecureStore } = await import("expo-secure-store");
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {}
}

async function call(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> ?? {}) },
  });
}

export const api = {
  status: () => call("/auth/status"),

  me: (token: string) => call("/auth/me", {}, token),

  setup: (body: { email: string; name: string; password: string; department?: string }) =>
    call("/auth/setup", { method: "POST", body: JSON.stringify(body) }),

  login: (email: string, password: string) =>
    call("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  logout: (token: string) =>
    call("/auth/logout", { method: "POST" }, token),

  invite: (
    token: string,
    body: { email: string; name: string; role: string; department?: string }
  ) => call("/auth/invite", { method: "POST", body: JSON.stringify(body) }, token),

  getInvite: (inviteToken: string) =>
    call(`/auth/invite/${inviteToken}`),

  acceptInvite: (body: { token: string; name: string; password: string }) =>
    call("/auth/accept-invite", { method: "POST", body: JSON.stringify(body) }),

  getUsers: (token: string) => call("/users", {}, token),

  updateRole: (token: string, userId: string, role: string) =>
    call(`/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }, token),

  deactivateUser: (token: string, userId: string) =>
    call(`/users/${userId}/deactivate`, { method: "PATCH" }, token),

  reactivateUser: (token: string, userId: string) =>
    call(`/users/${userId}/reactivate`, { method: "PATCH" }, token),

  deleteUser: (token: string, userId: string) =>
    call(`/users/${userId}`, { method: "DELETE" }, token),

  forgotPassword: (email: string) =>
    call("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),

  resetPassword: (token: string, password: string) =>
    call("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }),
};
