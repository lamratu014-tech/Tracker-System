import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type {
  AppEvent,
  Milestone,
  NewEventInput,
  NewMilestoneInput,
  NewProjectInput,
  NewStreamInput,
  NewTeamInput,
  NewUserInput,
  Project,
  Stream,
  Team,
  User,
} from "@/models/types";

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function logErr(label: string, e: unknown) {
  // eslint-disable-next-line no-console
  console.error(`[store] ${label}:`, e);
}

function tryAct<T>(label: string, fn: () => T): T | undefined {
  try {
    return fn();
  } catch (e) {
    logErr(label, e);
    return undefined;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Seed
// ────────────────────────────────────────────────────────────────────────────
function seed(): { users: User[]; streams: Stream[]; events: AppEvent[] } {
  const adminId = uid("u");
  const leaderAId = uid("u");
  const leaderBId = uid("u");
  const memberAId = uid("u");
  const memberBId = uid("u");

  const teamA: Team = {
    id: uid("tm"),
    name: "Brand & Creative",
    leaderId: leaderAId,
    members: [{ id: memberAId, name: "Alex Member" }],
    projects: [
      {
        id: uid("pr"),
        title: "Spring Campaign",
        description: "Launch creative for the spring brand refresh.",
        milestones: [
          {
            id: uid("ms"),
            title: "Concept signed off",
            status: "completed",
            deadline: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
            createdAt: nowIso(),
            completedAt: nowIso(),
            assignedTo: leaderAId,
          },
          {
            id: uid("ms"),
            title: "Asset production complete",
            status: "in_progress",
            deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
            createdAt: nowIso(),
            completedAt: null,
            assignedTo: memberAId,
          },
        ],
      },
    ],
  };

  const teamB: Team = {
    id: uid("tm"),
    name: "Data & Analytics",
    leaderId: leaderBId,
    members: [{ id: memberBId, name: "Riley Member" }],
    projects: [
      {
        id: uid("pr"),
        title: "Q3 Reporting",
        description: "Build the quarterly performance pack.",
        milestones: [
          {
            id: uid("ms"),
            title: "Pull baseline metrics",
            status: "pending",
            deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
            createdAt: nowIso(),
            completedAt: null,
            assignedTo: leaderBId,
          },
        ],
      },
    ],
  };

  const streamMarketing: Stream = {
    id: uid("st"),
    name: "Marketing",
    teams: [teamA],
  };
  const streamOps: Stream = {
    id: uid("st"),
    name: "Operations",
    teams: [teamB],
  };

  const users: User[] = [
    { id: adminId, name: "Sam Admin", role: "admin", teamId: null },
    { id: leaderAId, name: "Jess Leader", role: "leader", teamId: teamA.id },
    { id: leaderBId, name: "Morgan Leader", role: "leader", teamId: teamB.id },
    { id: memberAId, name: "Alex Member", role: "member", teamId: teamA.id },
    { id: memberBId, name: "Riley Member", role: "member", teamId: teamB.id },
  ];

  const events: AppEvent[] = [
    {
      id: uid("ev"),
      title: "All-hands kickoff",
      description: "Quarterly all-hands across both streams.",
      date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString().slice(0, 10),
      time: "10:00",
      fullDateTime: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
      linkedStreamId: null,
      linkedTeamId: null,
      createdBy: adminId,
    },
  ];

  return { users, streams: [streamMarketing, streamOps], events };
}

// ────────────────────────────────────────────────────────────────────────────
// State + actions
// ────────────────────────────────────────────────────────────────────────────
export interface AppState {
  hydrated: boolean;
  users: User[];
  currentUserId: string | null;
  streams: Stream[];
  events: AppEvent[];
  selectedStreamId: string | null;
  selectedTeamId: string | null;
  selectedProjectId: string | null;

  // session
  login: (userId: string) => void;
  logout: () => void;

  // selectors
  selectStream: (id: string | null) => void;
  selectTeam: (id: string | null) => void;
  selectProject: (id: string | null) => void;

  // streams
  addStream: (input: NewStreamInput) => Stream | undefined;
  updateStream: (id: string, patch: Partial<NewStreamInput>) => void;
  deleteStream: (id: string) => void;

  // teams
  addTeam: (streamId: string, input: NewTeamInput) => Team | undefined;
  updateTeam: (teamId: string, patch: Partial<NewTeamInput>) => void;
  deleteTeam: (teamId: string) => void;
  assignTeamLeader: (teamId: string, leaderId: string | null) => void;

  // projects
  addProject: (teamId: string, input: NewProjectInput) => Project | undefined;
  updateProject: (projectId: string, patch: Partial<NewProjectInput>) => void;
  deleteProject: (projectId: string) => void;

  // milestones
  addMilestone: (projectId: string, input: NewMilestoneInput) => Milestone | undefined;
  updateMilestone: (milestoneId: string, patch: Partial<NewMilestoneInput>) => void;
  setMilestoneStatus: (milestoneId: string, status: Milestone["status"]) => void;
  deleteMilestone: (milestoneId: string) => void;

  // events
  addEvent: (input: NewEventInput, createdBy: string) => AppEvent | undefined;
  updateEvent: (eventId: string, patch: Partial<NewEventInput>) => void;
  deleteEvent: (eventId: string) => void;

  // users
  addUser: (input: NewUserInput) => User | undefined;
  updateUser: (userId: string, patch: Partial<Omit<User, "id">>) => void;
  deleteUser: (userId: string) => void;

  // utility
  resetSeed: () => void;
}

const initial = seed();

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      users: initial.users,
      currentUserId: null,
      streams: initial.streams,
      events: initial.events,
      selectedStreamId: null,
      selectedTeamId: null,
      selectedProjectId: null,

      login: (userId) => {
        tryAct("login", () => {
          if (!get().users.find((u) => u.id === userId)) throw new Error("user not found");
          set({ currentUserId: userId });
        });
      },
      logout: () => {
        tryAct("logout", () => set({ currentUserId: null, selectedStreamId: null, selectedTeamId: null, selectedProjectId: null }));
      },

      selectStream: (id) => set({ selectedStreamId: id }),
      selectTeam: (id) => set({ selectedTeamId: id }),
      selectProject: (id) => set({ selectedProjectId: id }),

      addStream: (input) =>
        tryAct("addStream", () => {
          const stream: Stream = { id: uid("st"), name: input.name.trim(), teams: [] };
          if (!stream.name) throw new Error("name required");
          set((s) => ({ streams: [...s.streams, stream] }));
          return stream;
        }),
      updateStream: (id, patch) =>
        tryAct("updateStream", () => {
          set((s) => ({
            streams: s.streams.map((st) => (st.id === id ? { ...st, ...patch, name: (patch.name ?? st.name).trim() || st.name } : st)),
          }));
        }),
      deleteStream: (id) =>
        tryAct("deleteStream", () => {
          set((s) => ({ streams: s.streams.filter((st) => st.id !== id) }));
        }),

      addTeam: (streamId, input) =>
        tryAct("addTeam", () => {
          const team: Team = {
            id: uid("tm"),
            name: input.name.trim(),
            leaderId: input.leaderId ?? null,
            members: [],
            projects: [],
          };
          if (!team.name) throw new Error("name required");
          set((s) => ({
            streams: s.streams.map((st) => (st.id === streamId ? { ...st, teams: [...st.teams, team] } : st)),
            users: input.leaderId
              ? s.users.map((u) => (u.id === input.leaderId ? { ...u, teamId: team.id } : u))
              : s.users,
          }));
          return team;
        }),
      updateTeam: (teamId, patch) =>
        tryAct("updateTeam", () => {
          set((s) => ({
            streams: s.streams.map((st) => ({
              ...st,
              teams: st.teams.map((t) =>
                t.id === teamId ? { ...t, ...patch, name: (patch.name ?? t.name).trim() || t.name } : t,
              ),
            })),
          }));
        }),
      deleteTeam: (teamId) =>
        tryAct("deleteTeam", () => {
          set((s) => ({
            streams: s.streams.map((st) => ({ ...st, teams: st.teams.filter((t) => t.id !== teamId) })),
            users: s.users.map((u) => (u.teamId === teamId ? { ...u, teamId: null } : u)),
          }));
        }),
      assignTeamLeader: (teamId, leaderId) =>
        tryAct("assignTeamLeader", () => {
          set((s) => {
            const updatedUsers = leaderId
              ? s.users.map((u) =>
                  u.id === leaderId
                    ? { ...u, role: (u.role === "admin" ? "admin" : "leader") as User["role"], teamId }
                    : u,
                )
              : s.users;
            return {
              streams: s.streams.map((st) => ({
                ...st,
                teams: st.teams.map((t) => (t.id === teamId ? { ...t, leaderId: leaderId ?? null } : t)),
              })),
              users: updatedUsers,
            };
          });
        }),

      addProject: (teamId, input) =>
        tryAct("addProject", () => {
          const project: Project = {
            id: uid("pr"),
            title: input.title.trim(),
            description: (input.description ?? "").trim(),
            milestones: [],
          };
          if (!project.title) throw new Error("title required");
          set((s) => ({
            streams: s.streams.map((st) => ({
              ...st,
              teams: st.teams.map((t) => (t.id === teamId ? { ...t, projects: [...t.projects, project] } : t)),
            })),
          }));
          return project;
        }),
      updateProject: (projectId, patch) =>
        tryAct("updateProject", () => {
          set((s) => ({
            streams: s.streams.map((st) => ({
              ...st,
              teams: st.teams.map((t) => ({
                ...t,
                projects: t.projects.map((p) =>
                  p.id === projectId
                    ? {
                        ...p,
                        ...patch,
                        title: (patch.title ?? p.title).trim() || p.title,
                        description: (patch.description ?? p.description).trim(),
                      }
                    : p,
                ),
              })),
            })),
          }));
        }),
      deleteProject: (projectId) =>
        tryAct("deleteProject", () => {
          set((s) => ({
            streams: s.streams.map((st) => ({
              ...st,
              teams: st.teams.map((t) => ({ ...t, projects: t.projects.filter((p) => p.id !== projectId) })),
            })),
          }));
        }),

      addMilestone: (projectId, input) =>
        tryAct("addMilestone", () => {
          const ms: Milestone = {
            id: uid("ms"),
            title: input.title.trim(),
            status: input.status ?? "pending",
            deadline: input.deadline,
            createdAt: nowIso(),
            completedAt: input.status === "completed" ? nowIso() : null,
            assignedTo: input.assignedTo ?? null,
          };
          if (!ms.title) throw new Error("title required");
          if (!ms.deadline) throw new Error("deadline required");
          set((s) => ({
            streams: s.streams.map((st) => ({
              ...st,
              teams: st.teams.map((t) => ({
                ...t,
                projects: t.projects.map((p) =>
                  p.id === projectId ? { ...p, milestones: [...p.milestones, ms] } : p,
                ),
              })),
            })),
          }));
          return ms;
        }),
      updateMilestone: (milestoneId, patch) =>
        tryAct("updateMilestone", () => {
          set((s) => ({
            streams: s.streams.map((st) => ({
              ...st,
              teams: st.teams.map((t) => ({
                ...t,
                projects: t.projects.map((p) => ({
                  ...p,
                  milestones: p.milestones.map((m) =>
                    m.id === milestoneId
                      ? {
                          ...m,
                          ...patch,
                          title: (patch.title ?? m.title).trim() || m.title,
                          completedAt:
                            patch.status === "completed"
                              ? m.completedAt ?? nowIso()
                              : patch.status
                                ? null
                                : m.completedAt,
                        }
                      : m,
                  ),
                })),
              })),
            })),
          }));
        }),
      setMilestoneStatus: (milestoneId, status) =>
        tryAct("setMilestoneStatus", () => {
          set((s) => ({
            streams: s.streams.map((st) => ({
              ...st,
              teams: st.teams.map((t) => ({
                ...t,
                projects: t.projects.map((p) => ({
                  ...p,
                  milestones: p.milestones.map((m) =>
                    m.id === milestoneId
                      ? {
                          ...m,
                          status,
                          completedAt: status === "completed" ? m.completedAt ?? nowIso() : null,
                        }
                      : m,
                  ),
                })),
              })),
            })),
          }));
        }),
      deleteMilestone: (milestoneId) =>
        tryAct("deleteMilestone", () => {
          set((s) => ({
            streams: s.streams.map((st) => ({
              ...st,
              teams: st.teams.map((t) => ({
                ...t,
                projects: t.projects.map((p) => ({
                  ...p,
                  milestones: p.milestones.filter((m) => m.id !== milestoneId),
                })),
              })),
            })),
          }));
        }),

      addEvent: (input, createdBy) =>
        tryAct("addEvent", () => {
          const dt = `${input.date}T${input.time || "00:00"}:00`;
          const ev: AppEvent = {
            id: uid("ev"),
            title: input.title.trim(),
            description: (input.description ?? "").trim(),
            date: input.date,
            time: input.time,
            fullDateTime: new Date(dt).toISOString(),
            linkedStreamId: input.linkedStreamId ?? null,
            linkedTeamId: input.linkedTeamId ?? null,
            createdBy,
          };
          if (!ev.title) throw new Error("title required");
          if (!ev.date) throw new Error("date required");
          set((s) => ({ events: [...s.events, ev] }));
          return ev;
        }),
      updateEvent: (eventId, patch) =>
        tryAct("updateEvent", () => {
          set((s) => ({
            events: s.events.map((e) => {
              if (e.id !== eventId) return e;
              const date = patch.date ?? e.date;
              const time = patch.time ?? e.time;
              const dt = `${date}T${time || "00:00"}:00`;
              return {
                ...e,
                ...patch,
                date,
                time,
                fullDateTime: new Date(dt).toISOString(),
                title: (patch.title ?? e.title).trim() || e.title,
                description: (patch.description ?? e.description).trim(),
              };
            }),
          }));
        }),
      deleteEvent: (eventId) =>
        tryAct("deleteEvent", () => {
          set((s) => ({ events: s.events.filter((e) => e.id !== eventId) }));
        }),

      addUser: (input) =>
        tryAct("addUser", () => {
          const user: User = {
            id: uid("u"),
            name: input.name.trim(),
            role: input.role,
            teamId: input.teamId ?? null,
          };
          if (!user.name) throw new Error("name required");
          set((s) => ({ users: [...s.users, user] }));
          return user;
        }),
      updateUser: (userId, patch) =>
        tryAct("updateUser", () => {
          set((s) => ({
            users: s.users.map((u) => (u.id === userId ? { ...u, ...patch, name: (patch.name ?? u.name).trim() || u.name } : u)),
          }));
        }),
      deleteUser: (userId) =>
        tryAct("deleteUser", () => {
          set((s) => ({
            users: s.users.filter((u) => u.id !== userId),
            currentUserId: s.currentUserId === userId ? null : s.currentUserId,
          }));
        }),

      resetSeed: () => {
        const fresh = seed();
        set({
          users: fresh.users,
          streams: fresh.streams,
          events: fresh.events,
          currentUserId: null,
          selectedStreamId: null,
          selectedTeamId: null,
          selectedProjectId: null,
        });
      },
    }),
    {
      name: "ops-planning-store-v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        users: s.users,
        currentUserId: s.currentUserId,
        streams: s.streams,
        events: s.events,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) logErr("rehydrate", error);
        useStore.setState({ hydrated: true });
      },
    },
  ),
);

// ────────────────────────────────────────────────────────────────────────────
// Permission helpers (UI + logic should both call these)
// ────────────────────────────────────────────────────────────────────────────
export function canManageEverything(user: User | null | undefined): boolean {
  return user?.role === "admin";
}
export function canManageTeam(user: User | null | undefined, teamId: string): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "leader") return user.teamId === teamId;
  return false;
}
export function canCreateForTeam(user: User | null | undefined, teamId: string | null): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "leader") return !!teamId && user.teamId === teamId;
  return false;
}

// Lookup helpers — pure, no state mutation
export function useCurrentUser(): User | null {
  return useStore((s) => (s.currentUserId ? s.users.find((u) => u.id === s.currentUserId) ?? null : null));
}

export function findTeam(streams: Stream[], teamId: string): { stream: Stream; team: Team } | null {
  for (const st of streams) {
    const t = st.teams.find((x) => x.id === teamId);
    if (t) return { stream: st, team: t };
  }
  return null;
}
export function findProject(
  streams: Stream[],
  projectId: string,
): { stream: Stream; team: Team; project: Project } | null {
  for (const st of streams) {
    for (const t of st.teams) {
      const p = t.projects.find((x) => x.id === projectId);
      if (p) return { stream: st, team: t, project: p };
    }
  }
  return null;
}
export function findStream(streams: Stream[], streamId: string): Stream | null {
  return streams.find((s) => s.id === streamId) ?? null;
}
