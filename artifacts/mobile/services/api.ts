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
  // ─── Auth ───────────────────────────────────────────────
  status: () => call("/auth/status"),
  me: (token: string) => call("/auth/me", {}, token),
  setup: (body: { email: string; name: string; password: string; department?: string; setupSecret: string }) =>
    call("/auth/setup", { method: "POST", body: JSON.stringify(body) }),
  login: (email: string, password: string) =>
    call("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: (token: string) =>
    call("/auth/logout", { method: "POST" }, token),
  invite: (token: string, body: { email: string; name: string; role: string; department?: string }) =>
    call("/auth/invite", { method: "POST", body: JSON.stringify(body) }, token),
  getInvite: (inviteToken: string) =>
    call(`/auth/invite/${inviteToken}`),
  acceptInvite: (body: { token: string; name: string; password: string }) =>
    call("/auth/accept-invite", { method: "POST", body: JSON.stringify(body) }),
  forgotPassword: (email: string) =>
    call("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    call("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }),

  // ─── Users ──────────────────────────────────────────────
  getUsers: (token: string) => call("/users", {}, token),
  updateRole: (token: string, userId: string, role: string, teamId?: string | null) =>
    call(`/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role, teamId }) }, token),
  deactivateUser: (token: string, userId: string) =>
    call(`/users/${userId}/deactivate`, { method: "PATCH" }, token),
  reactivateUser: (token: string, userId: string) =>
    call(`/users/${userId}/reactivate`, { method: "PATCH" }, token),
  deleteUser: (token: string, userId: string) =>
    call(`/users/${userId}`, { method: "DELETE" }, token),

  // ─── Teams ──────────────────────────────────────────────
  getTeams: (token: string) => call("/teams", {}, token),
  getTeam: (token: string, id: string) => call(`/teams/${id}`, {}, token),
  createTeam: (token: string, body: { name: string; functionLabel?: string }) =>
    call("/teams", { method: "POST", body: JSON.stringify(body) }, token),
  updateTeam: (token: string, id: string, body: { name?: string; functionLabel?: string }) =>
    call(`/teams/${id}`, { method: "PATCH", body: JSON.stringify(body) }, token),
  deleteTeam: (token: string, id: string) =>
    call(`/teams/${id}`, { method: "DELETE" }, token),
  assignTeamLeader: (token: string, teamId: string, userId: string) =>
    call(`/teams/${teamId}/assign-leader`, { method: "POST", body: JSON.stringify({ userId }) }, token),
  assignTeamOwner: (token: string, teamId: string, userId: string) =>
    call(`/teams/${teamId}/assign-owner`, { method: "POST", body: JSON.stringify({ userId }) }, token),

  // ─── Personnel ──────────────────────────────────────────
  getPersonnel: (token: string, teamId: string) => call(`/teams/${teamId}/personnel`, {}, token),
  createPersonnel: (token: string, teamId: string, body: { name: string; roleLabel?: string }) =>
    call(`/teams/${teamId}/personnel`, { method: "POST", body: JSON.stringify(body) }, token),
  updatePersonnel: (token: string, id: string, body: { name?: string; roleLabel?: string }) =>
    call(`/personnel/${id}`, { method: "PATCH", body: JSON.stringify(body) }, token),
  deletePersonnel: (token: string, id: string) =>
    call(`/personnel/${id}`, { method: "DELETE" }, token),

  // ─── Projects ───────────────────────────────────────────
  getProjects: (token: string) => call("/projects", {}, token),
  getProject: (token: string, id: string) => call(`/projects/${id}`, {}, token),
  createProject: (token: string, body: Record<string, unknown>) =>
    call("/projects", { method: "POST", body: JSON.stringify(body) }, token),
  updateProject: (token: string, id: string, body: Record<string, unknown>) =>
    call(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) }, token),
  deleteProject: (token: string, id: string) =>
    call(`/projects/${id}`, { method: "DELETE" }, token),

  // ─── Tasks ──────────────────────────────────────────────
  getTasks: (token: string, projectId: string) =>
    call(`/projects/${projectId}/tasks`, {}, token),
  createTask: (token: string, body: Record<string, unknown>) =>
    call("/tasks", { method: "POST", body: JSON.stringify(body) }, token),
  updateTask: (token: string, id: string, body: Record<string, unknown>) =>
    call(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }, token),
  deleteTask: (token: string, id: string) =>
    call(`/tasks/${id}`, { method: "DELETE" }, token),

  // ─── Milestones ─────────────────────────────────────────
  getMilestones: (token: string, projectId: string) =>
    call(`/projects/${projectId}/milestones`, {}, token),
  createMilestone: (token: string, body: Record<string, unknown>) =>
    call("/milestones", { method: "POST", body: JSON.stringify(body) }, token),
  updateMilestone: (token: string, id: string, body: Record<string, unknown>) =>
    call(`/milestones/${id}`, { method: "PATCH", body: JSON.stringify(body) }, token),
  deleteMilestone: (token: string, id: string) =>
    call(`/milestones/${id}`, { method: "DELETE" }, token),

  // ─── Events ─────────────────────────────────────────────
  getEvents: (token: string) => call("/events", {}, token),
  getEvent: (token: string, id: string) => call(`/events/${id}`, {}, token),
  createEvent: (token: string, body: Record<string, unknown>) =>
    call("/events", { method: "POST", body: JSON.stringify(body) }, token),
  updateEvent: (token: string, id: string, body: Record<string, unknown>) =>
    call(`/events/${id}`, { method: "PATCH", body: JSON.stringify(body) }, token),
  deleteEvent: (token: string, id: string) =>
    call(`/events/${id}`, { method: "DELETE" }, token),

  // ─── Activity Log ───────────────────────────────────────
  getActivity: (token: string, limit?: number) =>
    call(`/activity${limit ? `?limit=${limit}` : ""}`, {}, token),
};
