import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type {
  AppEvent,
  Member,
  Milestone,
  NewEventInput,
  NewMemberInput,
  NewMilestoneInput,
  NewProjectInput,
  NewStreamInput,
  NewTeamInput,
  NewTeamNoteInput,
  NewUserInput,
  Project,
  Stream,
  Team,
  TeamNote,
  User,
} from "@/models/types";

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso(): string { return new Date().toISOString(); }
function logErr(label: string, e: unknown) {
  // eslint-disable-next-line no-console
  console.error(`[store] ${label}:`, e);
}
function tryAct<T>(label: string, fn: () => T): T | undefined {
  try { return fn(); } catch (e) { logErr(label, e); return undefined; }
}
function newInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function normalizeEmail(s: string): string { return s.trim().toLowerCase(); }
function normalizeCode(s: string): string { return s.trim().toUpperCase(); }

function seed(): { users: User[]; members: Member[]; streams: Stream[]; events: AppEvent[] } {
  const adminId = uid("u");
  const overseerId = uid("u");
  const leaderAId = uid("u");
  const leaderBId = uid("u");

  const teamAId = uid("tm");
  const teamBId = uid("tm");
  const streamMarketingId = uid("st");
  const streamOpsId = uid("st");

  const teamA: Team = {
    id: teamAId,
    name: "Brand & Creative",
    leaderId: leaderAId,
    notes: [
      {
        id: uid("tn"),
        teamId: teamAId,
        body: "Kicked off the spring campaign. Concept locked, moving to production.",
        authorId: leaderAId,
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        updatedAt: null,
      },
    ],
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
            deadline: new Date(Date.now() - 7 * 86400000).toISOString(),
            createdAt: nowIso(),
            completedAt: nowIso(),
            assignedTo: leaderAId,
          },
          {
            id: uid("ms"),
            title: "Asset production complete",
            status: "in_progress",
            deadline: new Date(Date.now() + 5 * 86400000).toISOString(),
            createdAt: nowIso(),
            completedAt: null,
            assignedTo: leaderAId,
          },
        ],
      },
    ],
  };

  const teamB: Team = {
    id: teamBId,
    name: "Data & Analytics",
    leaderId: leaderBId,
    notes: [],
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
            deadline: new Date(Date.now() + 14 * 86400000).toISOString(),
            createdAt: nowIso(),
            completedAt: null,
            assignedTo: leaderBId,
          },
        ],
      },
    ],
  };

  const streamMarketing: Stream = { id: streamMarketingId, name: "Marketing", teams: [teamA] };
  const streamOps: Stream = { id: streamOpsId, name: "Operations", teams: [teamB] };

  const users: User[] = [
    {
      id: adminId, name: "Sam Admin", email: "admin@ops.test", role: "admin",
      active: true, streamId: null, teamId: null, inviteCode: null, createdAt: nowIso(),
    },
    {
      id: overseerId, name: "Pat Overseer", email: "pat@ops.test", role: "stream_overseer",
      active: true, streamId: streamMarketingId, teamId: null, inviteCode: null, createdAt: nowIso(),
    },
    {
      id: leaderAId, name: "Jess Leader", email: "jess@ops.test", role: "leader",
      active: true, streamId: streamMarketingId, teamId: teamAId, inviteCode: null, createdAt: nowIso(),
    },
    {
      id: leaderBId, name: "Morgan Leader", email: "morgan@ops.test", role: "leader",
      active: true, streamId: streamOpsId, teamId: teamBId, inviteCode: null, createdAt: nowIso(),
    },
  ];

  const members: Member[] = [
    { id: uid("mb"), name: "Alex Doyle", teamId: teamAId, streamId: streamMarketingId, createdAt: nowIso() },
    { id: uid("mb"), name: "Casey Brown", teamId: teamAId, streamId: streamMarketingId, createdAt: nowIso() },
    { id: uid("mb"), name: "Riley Park", teamId: teamBId, streamId: streamOpsId, createdAt: nowIso() },
  ];

  const eventDay = new Date(Date.now() + 3 * 86400000);
  eventDay.setHours(10, 0, 0, 0);

  const events: AppEvent[] = [
    {
      id: uid("ev"),
      title: "All-hands kickoff",
      description: "Quarterly all-hands across both streams.",
      date: eventDay.toISOString().slice(0, 10),
      time: "10:00",
      fullDateTime: eventDay.toISOString(),
      linkedStreamId: null,
      linkedTeamId: null,
      createdBy: adminId,
    },
  ];

  return { users, members, streams: [streamMarketing, streamOps], events };
}

export interface AppState {
  hydrated: boolean;
  users: User[];
  members: Member[];
  currentUserId: string | null;
  streams: Stream[];
  events: AppEvent[];
  selectedStreamId: string | null;
  selectedTeamId: string | null;
  selectedProjectId: string | null;
  lastInviteCode: string | null;

  loginByEmail: (email: string) => { ok: boolean; error?: string };
  loginById: (userId: string) => void;
  logout: () => void;
  syncAuthUser: (
    authUser: {
      id: string;
      email: string;
      name: string;
      role: string;
      active: boolean;
      streamId?: string | null;
      teamId?: string | null;
    } | null,
  ) => void;

  selectStream: (id: string | null) => void;
  selectTeam: (id: string | null) => void;
  selectProject: (id: string | null) => void;

  addStream: (input: NewStreamInput) => Stream | undefined;
  updateStream: (id: string, patch: Partial<NewStreamInput>) => void;
  deleteStream: (id: string) => void;

  addTeam: (streamId: string, input: NewTeamInput) => Team | undefined;
  updateTeam: (teamId: string, patch: Partial<NewTeamInput>) => void;
  deleteTeam: (teamId: string) => void;
  assignTeamLeader: (teamId: string, leaderId: string | null) => void;

  addProject: (teamId: string, input: NewProjectInput) => Project | undefined;
  updateProject: (projectId: string, patch: Partial<NewProjectInput>) => void;
  deleteProject: (projectId: string) => void;

  addMilestone: (projectId: string, input: NewMilestoneInput) => Milestone | undefined;
  updateMilestone: (milestoneId: string, patch: Partial<NewMilestoneInput>) => void;
  setMilestoneStatus: (milestoneId: string, status: Milestone["status"]) => void;
  deleteMilestone: (milestoneId: string) => void;

  addEvent: (input: NewEventInput, createdBy: string) => AppEvent | undefined;
  updateEvent: (eventId: string, patch: Partial<NewEventInput>) => void;
  deleteEvent: (eventId: string) => void;

  inviteUser: (input: NewUserInput) => User | undefined;
  updateUser: (userId: string, patch: Partial<Omit<User, "id">>) => void;
  deleteUser: (userId: string) => void;
  acceptInvite: (code: string) => { ok: boolean; user?: User; error?: string };
  clearLastInviteCode: () => void;

  addMember: (input: NewMemberInput) => Member | undefined;
  updateMember: (memberId: string, patch: Partial<Pick<Member, "name" | "teamId">>) => void;
  deleteMember: (memberId: string) => void;

  addTeamNote: (input: NewTeamNoteInput, authorId: string) => TeamNote | undefined;
  updateTeamNote: (noteId: string, body: string) => void;
  deleteTeamNote: (noteId: string) => void;

  resetSeed: () => void;
}

const initial = seed();

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      users: initial.users,
      members: initial.members,
      currentUserId: null,
      streams: initial.streams,
      events: initial.events,
      selectedStreamId: null,
      selectedTeamId: null,
      selectedProjectId: null,
      lastInviteCode: null,

      loginByEmail: (email) => {
        try {
          const e = normalizeEmail(email);
          if (!e) return { ok: false, error: "Email is required" };
          const user = get().users.find((u) => u.email.toLowerCase() === e);
          if (!user) return { ok: false, error: "No account with that email" };
          if (!user.active) {
            return { ok: false, error: "Account not yet activated. Use your invite code first." };
          }
          set({ currentUserId: user.id });
          return { ok: true };
        } catch (e) {
          logErr("loginByEmail", e);
          return { ok: false, error: "Login failed" };
        }
      },

      loginById: (userId) => {
        tryAct("loginById", () => {
          const u = get().users.find((x) => x.id === userId);
          if (!u) throw new Error("user not found");
          if (!u.active) throw new Error("inactive");
          set({ currentUserId: userId });
        });
      },

      logout: () => {
        tryAct("logout", () => set({
          currentUserId: null,
          selectedStreamId: null,
          selectedTeamId: null,
          selectedProjectId: null,
        }));
      },

      syncAuthUser: (authUser) => {
        tryAct("syncAuthUser", () => {
          if (!authUser) {
            set({
              currentUserId: null,
              selectedStreamId: null,
              selectedTeamId: null,
              selectedProjectId: null,
            });
            return;
          }
          const role: User["role"] =
            authUser.role === "admin" ||
            authUser.role === "stream_overseer" ||
            authUser.role === "leader"
              ? (authUser.role as User["role"])
              : "leader";
          const email = normalizeEmail(authUser.email);
          set((s) => {
            const byId = s.users.find((u) => u.id === authUser.id);
            const byEmail =
              byId ?? s.users.find((u) => u.email.toLowerCase() === email);
            const merged: User = {
              id: authUser.id,
              name: authUser.name,
              email,
              role,
              active: authUser.active,
              streamId: authUser.streamId ?? byEmail?.streamId ?? null,
              teamId: authUser.teamId ?? byEmail?.teamId ?? null,
              inviteCode: null,
              createdAt: byEmail?.createdAt ?? nowIso(),
            };
            const others = s.users.filter(
              (u) => u.id !== merged.id && u.email.toLowerCase() !== email,
            );
            return { users: [...others, merged], currentUserId: merged.id };
          });
        });
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
            streams: s.streams.map((st) =>
              st.id === id
                ? { ...st, ...patch, name: (patch.name ?? st.name).trim() || st.name }
                : st,
            ),
          }));
        }),
      deleteStream: (id) =>
        tryAct("deleteStream", () => {
          set((s) => {
            const target = s.streams.find((x) => x.id === id);
            const teamIds = target ? target.teams.map((t) => t.id) : [];
            return {
              streams: s.streams.filter((st) => st.id !== id),
              members: s.members.filter((m) => m.streamId !== id),
              events: s.events.map((e) =>
                e.linkedStreamId === id || (e.linkedTeamId && teamIds.includes(e.linkedTeamId))
                  ? { ...e, linkedStreamId: null, linkedTeamId: null }
                  : e,
              ),
              users: s.users.map((u) => {
                const tIn = !!(u.teamId && teamIds.includes(u.teamId));
                if (u.streamId === id || tIn) {
                  return {
                    ...u,
                    streamId: u.streamId === id ? null : u.streamId,
                    teamId: tIn ? null : u.teamId,
                  };
                }
                return u;
              }),
            };
          });
        }),

      addTeam: (streamId, input) =>
        tryAct("addTeam", () => {
          const team: Team = {
            id: uid("tm"),
            name: input.name.trim(),
            leaderId: input.leaderId ?? null,
            projects: [],
            notes: [],
          };
          if (!team.name) throw new Error("name required");
          set((s) => ({
            streams: s.streams.map((st) =>
              st.id === streamId ? { ...st, teams: [...st.teams, team] } : st,
            ),
            users: input.leaderId
              ? s.users.map((u) =>
                  u.id === input.leaderId ? { ...u, teamId: team.id, streamId } : u,
                )
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
                t.id === teamId
                  ? { ...t, ...patch, name: (patch.name ?? t.name).trim() || t.name }
                  : t,
              ),
            })),
          }));
        }),
      deleteTeam: (teamId) =>
        tryAct("deleteTeam", () => {
          set((s) => ({
            streams: s.streams.map((st) => ({
              ...st,
              teams: st.teams.filter((t) => t.id !== teamId),
            })),
            users: s.users.map((u) => (u.teamId === teamId ? { ...u, teamId: null } : u)),
            members: s.members.filter((m) => m.teamId !== teamId),
            events: s.events.map((e) =>
              e.linkedTeamId === teamId ? { ...e, linkedTeamId: null } : e,
            ),
          }));
        }),
      assignTeamLeader: (teamId, leaderId) =>
        tryAct("assignTeamLeader", () => {
          set((s) => {
            const stream = s.streams.find((st) => st.teams.some((t) => t.id === teamId));
            const updatedUsers = leaderId
              ? s.users.map((u) =>
                  u.id === leaderId
                    ? {
                        ...u,
                        role:
                          u.role === "admin" || u.role === "stream_overseer"
                            ? u.role
                            : ("leader" as User["role"]),
                        teamId,
                        streamId: stream?.id ?? u.streamId,
                      }
                    : u,
                )
              : s.users;
            return {
              streams: s.streams.map((st) => ({
                ...st,
                teams: st.teams.map((t) =>
                  t.id === teamId ? { ...t, leaderId: leaderId ?? null } : t,
                ),
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
              teams: st.teams.map((t) =>
                t.id === teamId ? { ...t, projects: [...t.projects, project] } : t,
              ),
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
              teams: st.teams.map((t) => ({
                ...t,
                projects: t.projects.filter((p) => p.id !== projectId),
              })),
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
          if (!input.title.trim()) throw new Error("title required");
          if (!input.date) throw new Error("date required");
          const time = input.time || "00:00";
          const dt = new Date(`${input.date}T${time}:00`);
          if (Number.isNaN(dt.getTime())) throw new Error("invalid date/time");
          const ev: AppEvent = {
            id: uid("ev"),
            title: input.title.trim(),
            description: (input.description ?? "").trim(),
            date: input.date,
            time,
            fullDateTime: dt.toISOString(),
            linkedStreamId: input.linkedStreamId ?? null,
            linkedTeamId: input.linkedTeamId ?? null,
            createdBy,
          };
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
              const dt = new Date(`${date}T${time || "00:00"}:00`);
              return {
                ...e,
                ...patch,
                date,
                time,
                fullDateTime: Number.isNaN(dt.getTime()) ? e.fullDateTime : dt.toISOString(),
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

      inviteUser: (input) =>
        tryAct("inviteUser", () => {
          const name = input.name.trim();
          const email = normalizeEmail(input.email);
          if (!name) throw new Error("name required");
          if (!email || !email.includes("@")) throw new Error("valid email required");
          if (get().users.some((u) => u.email.toLowerCase() === email)) {
            throw new Error("email already in use");
          }
          let streamId = input.streamId ?? null;
          let teamId = input.teamId ?? null;
          if (input.role === "admin") { streamId = null; teamId = null; }
          if (input.role === "stream_overseer") { teamId = null; }
          if (input.role === "leader" && teamId) {
            const stream = get().streams.find((s) => s.teams.some((t) => t.id === teamId));
            if (stream) streamId = stream.id;
          }
          const code = newInviteCode();
          const user: User = {
            id: uid("u"),
            name,
            email,
            role: input.role,
            active: false,
            streamId,
            teamId,
            inviteCode: code,
            createdAt: nowIso(),
          };
          set((s) => ({ users: [...s.users, user], lastInviteCode: code }));
          return user;
        }),

      updateUser: (userId, patch) =>
        tryAct("updateUser", () => {
          set((s) => ({
            users: s.users.map((u) =>
              u.id === userId
                ? {
                    ...u,
                    ...patch,
                    name: ((patch.name ?? u.name) as string).trim() || u.name,
                    email: patch.email ? normalizeEmail(patch.email) : u.email,
                  }
                : u,
            ),
          }));
        }),
      deleteUser: (userId) =>
        tryAct("deleteUser", () => {
          set((s) => ({
            users: s.users.filter((u) => u.id !== userId),
            currentUserId: s.currentUserId === userId ? null : s.currentUserId,
            streams: s.streams.map((st) => ({
              ...st,
              teams: st.teams.map((t) =>
                t.leaderId === userId ? { ...t, leaderId: null } : t,
              ),
            })),
          }));
        }),
      acceptInvite: (code) => {
        try {
          const c = normalizeCode(code);
          if (!c) return { ok: false, error: "Code is required" };
          const u = get().users.find((x) => x.inviteCode === c);
          if (!u) return { ok: false, error: "Invalid invite code" };
          set((s) => ({
            users: s.users.map((x) =>
              x.id === u.id ? { ...x, active: true, inviteCode: null } : x,
            ),
            currentUserId: u.id,
          }));
          return { ok: true, user: { ...u, active: true, inviteCode: null } };
        } catch (e) {
          logErr("acceptInvite", e);
          return { ok: false, error: "Could not accept invite" };
        }
      },
      clearLastInviteCode: () => set({ lastInviteCode: null }),

      addMember: (input) =>
        tryAct("addMember", () => {
          const name = input.name.trim();
          if (!name) throw new Error("name required");
          const stream = get().streams.find((s) =>
            s.teams.some((t) => t.id === input.teamId),
          );
          if (!stream) throw new Error("team not found");
          const member: Member = {
            id: uid("mb"),
            name,
            teamId: input.teamId,
            streamId: stream.id,
            createdAt: nowIso(),
          };
          set((s) => ({ members: [...s.members, member] }));
          return member;
        }),
      updateMember: (memberId, patch) =>
        tryAct("updateMember", () => {
          set((s) => ({
            members: s.members.map((m) => {
              if (m.id !== memberId) return m;
              let streamId = m.streamId;
              if (patch.teamId && patch.teamId !== m.teamId) {
                const st = s.streams.find((x) => x.teams.some((t) => t.id === patch.teamId));
                if (st) streamId = st.id;
              }
              return {
                ...m,
                ...patch,
                name: ((patch.name ?? m.name) as string).trim() || m.name,
                streamId,
              };
            }),
          }));
        }),
      deleteMember: (memberId) =>
        tryAct("deleteMember", () => {
          set((s) => ({ members: s.members.filter((m) => m.id !== memberId) }));
        }),

      addTeamNote: (input, authorId) =>
        tryAct("addTeamNote", () => {
          const body = input.body.trim();
          if (!body) throw new Error("body required");
          if (!authorId) throw new Error("author required");
          const note: TeamNote = {
            id: uid("tn"),
            teamId: input.teamId,
            body,
            authorId,
            createdAt: nowIso(),
            updatedAt: null,
          };
          set((s) => ({
            streams: s.streams.map((st) => ({
              ...st,
              teams: st.teams.map((t) =>
                t.id === input.teamId ? { ...t, notes: [note, ...(t.notes ?? [])] } : t,
              ),
            })),
          }));
          return note;
        }),
      updateTeamNote: (noteId, body) =>
        tryAct("updateTeamNote", () => {
          const trimmed = body.trim();
          if (!trimmed) throw new Error("body required");
          set((s) => ({
            streams: s.streams.map((st) => ({
              ...st,
              teams: st.teams.map((t) => ({
                ...t,
                notes: (t.notes ?? []).map((n) =>
                  n.id === noteId ? { ...n, body: trimmed, updatedAt: nowIso() } : n,
                ),
              })),
            })),
          }));
        }),
      deleteTeamNote: (noteId) =>
        tryAct("deleteTeamNote", () => {
          set((s) => ({
            streams: s.streams.map((st) => ({
              ...st,
              teams: st.teams.map((t) => ({
                ...t,
                notes: (t.notes ?? []).filter((n) => n.id !== noteId),
              })),
            })),
          }));
        }),

      resetSeed: () => {
        const fresh = seed();
        set({
          users: fresh.users,
          members: fresh.members,
          streams: fresh.streams,
          events: fresh.events,
          currentUserId: null,
          selectedStreamId: null,
          selectedTeamId: null,
          selectedProjectId: null,
          lastInviteCode: null,
        });
      },
    }),
    {
      name: "ops-planning-store-v2",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        users: s.users,
        members: s.members,
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

// ─────────────────────────────────────────────────────────────────────────
// Permission helpers (UI + logic should both call these)
// ─────────────────────────────────────────────────────────────────────────
export function canManageEverything(user: User | null | undefined): boolean {
  return user?.role === "admin";
}

export function canManageStream(
  user: User | null | undefined,
  streamId: string | null,
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (!streamId) return false;
  if (user.role === "stream_overseer") return user.streamId === streamId;
  return false;
}

export function canManageTeam(
  user: User | null | undefined,
  teamId: string,
  streams: Stream[],
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "leader") return user.teamId === teamId;
  if (user.role === "stream_overseer") {
    const stream = streams.find((s) => s.teams.some((t) => t.id === teamId));
    return !!stream && stream.id === user.streamId;
  }
  return false;
}

export function canCreateForTeam(
  user: User | null | undefined,
  teamId: string | null,
  streams: Stream[],
): boolean {
  if (!user) return false;
  if (!teamId) return user.role === "admin";
  return canManageTeam(user, teamId, streams);
}

// Hooks
export function useCurrentUser(): User | null {
  return useStore((s) =>
    s.currentUserId ? s.users.find((u) => u.id === s.currentUserId) ?? null : null,
  );
}
export function useCanManageTeam(teamId: string | null | undefined): boolean {
  return useStore((s) => {
    if (!teamId) return false;
    const me = s.currentUserId
      ? s.users.find((u) => u.id === s.currentUserId) ?? null
      : null;
    return canManageTeam(me, teamId, s.streams);
  });
}
export function useCanManageStream(streamId: string | null | undefined): boolean {
  return useStore((s) => {
    if (!streamId) return false;
    const me = s.currentUserId
      ? s.users.find((u) => u.id === s.currentUserId) ?? null
      : null;
    return canManageStream(me, streamId);
  });
}

// Lookups
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
