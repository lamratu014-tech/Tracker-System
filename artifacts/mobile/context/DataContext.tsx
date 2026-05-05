import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { api } from "@/services/api";
import { useAuth } from "./AuthContext";

export type EventStatus = "pending" | "approved" | "rejected";
export type ProjectStatus = "not_started" | "in_progress" | "at_risk" | "completed";
export type TaskStatus = "todo" | "in_progress" | "at_risk" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface Team {
  id: string;
  name: string;
  functionLabel?: string | null;
  createdAt: string;
}

export interface Personnel {
  id: string;
  name: string;
  roleLabel?: string | null;
  teamId: string;
  createdAt: string;
}

export interface Project {
  id: string;
  teamId: string;
  teamName?: string | null;
  title: string;
  description: string;
  status: ProjectStatus;
  color: string;
  phase: string;
  dueDate: string | null;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assignedToUserId: string | null;
  assignedToMemberId: string | null;
  assignedUserName: string | null;
  assignedMemberName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  date: string;
  completed: boolean;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  internalDescription: string | null;
  sharedDescription: string;
  startDate: string;
  endDate: string;
  location: string;
  color: string;
  isAllDay: boolean;
  status: EventStatus;
  projectId: string | null;
  createdByTeamId: string | null;
  createdByUserId: string | null;
  invitedTeamIds: string[];
  visibility: "full" | "shared";
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string | null;
  userRole: string | null;
  userName: string | null;
  actionType: string;
  entityType: string;
  entityId: string | null;
  entityTitle: string | null;
  description: string | null;
  teamId: string | null;
  createdAt: string;
}

interface DataContextType {
  teams: Team[];
  personnel: Personnel[];
  projects: Project[];
  tasks: Task[];
  milestones: Milestone[];
  events: CalendarEvent[];
  activityLogs: ActivityLog[];
  isLoading: boolean;

  // Teams
  createTeam: (body: { name: string; functionLabel?: string }) => Promise<void>;
  updateTeam: (id: string, body: { name?: string; functionLabel?: string }) => Promise<void>;
  deleteTeam: (id: string) => Promise<void>;
  refreshTeams: () => Promise<void>;

  // Personnel
  createPersonnel: (teamId: string, body: { name: string; roleLabel?: string }) => Promise<void>;
  updatePersonnel: (id: string, body: { name?: string; roleLabel?: string }) => Promise<void>;
  deletePersonnel: (id: string) => Promise<void>;
  refreshPersonnel: (teamId: string) => Promise<void>;

  // Projects
  createProject: (body: Record<string, unknown>) => Promise<Project | null>;
  updateProject: (id: string, body: Record<string, unknown>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  refreshProjects: () => Promise<void>;

  // Tasks
  createTask: (body: Record<string, unknown>) => Promise<void>;
  updateTask: (id: string, body: Record<string, unknown>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  refreshTasks: (projectId: string) => Promise<void>;

  // Milestones
  createMilestone: (body: Record<string, unknown>) => Promise<void>;
  updateMilestone: (id: string, body: Record<string, unknown>) => Promise<void>;
  deleteMilestone: (id: string) => Promise<void>;
  refreshMilestones: (projectId: string) => Promise<void>;

  // Events
  createEvent: (body: Record<string, unknown>) => Promise<void>;
  updateEvent: (id: string, body: Record<string, unknown>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  refreshEvents: () => Promise<void>;

  // Activity
  refreshActivity: () => Promise<void>;

  // Helpers
  getProjectById: (id: string) => Project | undefined;
  getTasksByProject: (projectId: string) => Task[];
  getMilestonesByProject: (projectId: string) => Milestone[];
  getEventsByDate: (dateStr: string) => CalendarEvent[];
  getPersonnelByTeam: (teamId: string) => Personnel[];
}

const DataContext = createContext<DataContextType | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { sessionToken, currentUser, isAuthenticated } = useAuth();

  const [teams, setTeams] = useState<Team[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const token = sessionToken;

  const refreshTeams = useCallback(async () => {
    if (!token) return;
    const res = await api.getTeams(token);
    if (res.ok) setTeams((await res.json()) as Team[]);
  }, [token]);

  const refreshPersonnel = useCallback(async (teamId: string) => {
    if (!token) return;
    const res = await api.getPersonnel(token, teamId);
    if (res.ok) {
      const data = (await res.json()) as Personnel[];
      setPersonnel((prev) => {
        const filtered = prev.filter((p) => p.teamId !== teamId);
        return [...filtered, ...data];
      });
    }
  }, [token]);

  const refreshProjects = useCallback(async () => {
    if (!token) return;
    const res = await api.getProjects(token);
    if (res.ok) setProjects((await res.json()) as Project[]);
  }, [token]);

  const refreshTasks = useCallback(async (projectId: string) => {
    if (!token) return;
    const res = await api.getTasks(token, projectId);
    if (res.ok) {
      const data = (await res.json()) as Task[];
      setTasks((prev) => {
        const filtered = prev.filter((t) => t.projectId !== projectId);
        return [...filtered, ...data];
      });
    }
  }, [token]);

  const refreshMilestones = useCallback(async (projectId: string) => {
    if (!token) return;
    const res = await api.getMilestones(token, projectId);
    if (res.ok) {
      const data = (await res.json()) as Milestone[];
      setMilestones((prev) => {
        const filtered = prev.filter((m) => m.projectId !== projectId);
        return [...filtered, ...data];
      });
    }
  }, [token]);

  const refreshEvents = useCallback(async () => {
    if (!token) return;
    const res = await api.getEvents(token);
    if (res.ok) setEvents((await res.json()) as CalendarEvent[]);
  }, [token]);

  const refreshActivity = useCallback(async () => {
    if (!token) return;
    const res = await api.getActivity(token, 50);
    if (res.ok) setActivityLogs((await res.json()) as ActivityLog[]);
  }, [token]);

  // Initial load
  useEffect(() => {
    if (!isAuthenticated || !token) return;
    setIsLoading(true);
    Promise.all([
      refreshTeams(),
      refreshProjects(),
      refreshEvents(),
      refreshActivity(),
    ]).finally(() => setIsLoading(false));
  }, [isAuthenticated, token]);

  // Load personnel for user's team
  useEffect(() => {
    if (currentUser?.teamId) {
      refreshPersonnel(currentUser.teamId);
    }
  }, [currentUser?.teamId]);

  // Load tasks/milestones for loaded projects
  useEffect(() => {
    if (!token || projects.length === 0) return;
    projects.forEach((p) => {
      refreshTasks(p.id);
      refreshMilestones(p.id);
    });
  }, [projects.length, token]);

  // Teams
  const createTeam = useCallback(async (body: { name: string; functionLabel?: string }) => {
    if (!token) return;
    const res = await api.createTeam(token, body);
    if (res.ok) await refreshTeams();
  }, [token, refreshTeams]);

  const updateTeam = useCallback(async (id: string, body: { name?: string; functionLabel?: string }) => {
    if (!token) return;
    const res = await api.updateTeam(token, id, body);
    if (res.ok) await refreshTeams();
  }, [token, refreshTeams]);

  const deleteTeam = useCallback(async (id: string) => {
    if (!token) return;
    const res = await api.deleteTeam(token, id);
    if (res.ok || res.status === 204) await refreshTeams();
  }, [token, refreshTeams]);

  // Personnel
  const createPersonnel = useCallback(async (teamId: string, body: { name: string; roleLabel?: string }) => {
    if (!token) return;
    const res = await api.createPersonnel(token, teamId, body);
    if (res.ok) await refreshPersonnel(teamId);
  }, [token, refreshPersonnel]);

  const updatePersonnel = useCallback(async (id: string, body: { name?: string; roleLabel?: string }) => {
    if (!token) return;
    const member = personnel.find((p) => p.id === id);
    const res = await api.updatePersonnel(token, id, body);
    if (res.ok && member) await refreshPersonnel(member.teamId);
  }, [token, personnel, refreshPersonnel]);

  const deletePersonnel = useCallback(async (id: string) => {
    if (!token) return;
    const member = personnel.find((p) => p.id === id);
    const res = await api.deletePersonnel(token, id);
    if ((res.ok || res.status === 204) && member) await refreshPersonnel(member.teamId);
  }, [token, personnel, refreshPersonnel]);

  // Projects
  const createProject = useCallback(async (body: Record<string, unknown>): Promise<Project | null> => {
    if (!token) return null;
    const res = await api.createProject(token, body);
    if (res.ok) {
      const project = (await res.json()) as Project;
      setProjects((prev) => [...prev, project]);
      return project;
    }
    return null;
  }, [token]);

  const updateProject = useCallback(async (id: string, body: Record<string, unknown>) => {
    if (!token) return;
    const res = await api.updateProject(token, id, body);
    if (res.ok) {
      const updated = (await res.json()) as Project;
      setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    }
  }, [token]);

  const deleteProject = useCallback(async (id: string) => {
    if (!token) return;
    const res = await api.deleteProject(token, id);
    if (res.ok || res.status === 204) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setTasks((prev) => prev.filter((t) => t.projectId !== id));
      setMilestones((prev) => prev.filter((m) => m.projectId !== id));
    }
  }, [token]);

  // Tasks
  const createTask = useCallback(async (body: Record<string, unknown>) => {
    if (!token) return;
    const res = await api.createTask(token, body);
    if (res.ok) {
      const task = (await res.json()) as Task;
      setTasks((prev) => [...prev, task]);
    }
  }, [token]);

  const updateTask = useCallback(async (id: string, body: Record<string, unknown>) => {
    if (!token) return;
    const res = await api.updateTask(token, id, body);
    if (res.ok) {
      const updated = (await res.json()) as Task;
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    }
  }, [token]);

  const deleteTask = useCallback(async (id: string) => {
    if (!token) return;
    const res = await api.deleteTask(token, id);
    if (res.ok || res.status === 204) setTasks((prev) => prev.filter((t) => t.id !== id));
  }, [token]);

  // Milestones
  const createMilestone = useCallback(async (body: Record<string, unknown>) => {
    if (!token) return;
    const res = await api.createMilestone(token, body);
    if (res.ok) {
      const milestone = (await res.json()) as Milestone;
      setMilestones((prev) => [...prev, milestone]);
    }
  }, [token]);

  const updateMilestone = useCallback(async (id: string, body: Record<string, unknown>) => {
    if (!token) return;
    const res = await api.updateMilestone(token, id, body);
    if (res.ok) {
      const updated = (await res.json()) as Milestone;
      setMilestones((prev) => prev.map((m) => (m.id === id ? updated : m)));
    }
  }, [token]);

  const deleteMilestone = useCallback(async (id: string) => {
    if (!token) return;
    const res = await api.deleteMilestone(token, id);
    if (res.ok || res.status === 204) setMilestones((prev) => prev.filter((m) => m.id !== id));
  }, [token]);

  // Events
  const createEvent = useCallback(async (body: Record<string, unknown>) => {
    if (!token) return;
    const res = await api.createEvent(token, body);
    if (res.ok) {
      const event = (await res.json()) as CalendarEvent;
      setEvents((prev) => [...prev, event]);
    }
  }, [token]);

  const updateEvent = useCallback(async (id: string, body: Record<string, unknown>) => {
    if (!token) return;
    const res = await api.updateEvent(token, id, body);
    if (res.ok) {
      const updated = (await res.json()) as CalendarEvent;
      setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));
    }
  }, [token]);

  const deleteEvent = useCallback(async (id: string) => {
    if (!token) return;
    const res = await api.deleteEvent(token, id);
    if (res.ok || res.status === 204) setEvents((prev) => prev.filter((e) => e.id !== id));
  }, [token]);

  // Helpers
  const getProjectById = useCallback((id: string) => projects.find((p) => p.id === id), [projects]);
  const getTasksByProject = useCallback((projectId: string) => tasks.filter((t) => t.projectId === projectId), [tasks]);
  const getMilestonesByProject = useCallback((projectId: string) => milestones.filter((m) => m.projectId === projectId), [milestones]);
  const getPersonnelByTeam = useCallback((teamId: string) => personnel.filter((p) => p.teamId === teamId), [personnel]);
  const getEventsByDate = useCallback((dateStr: string) => {
    return events.filter((e) => {
      const start = new Date(e.startDate);
      const target = new Date(dateStr);
      return (
        start.getFullYear() === target.getFullYear() &&
        start.getMonth() === target.getMonth() &&
        start.getDate() === target.getDate()
      );
    });
  }, [events]);

  return (
    <DataContext.Provider value={{
      teams, personnel, projects, tasks, milestones, events, activityLogs, isLoading,
      createTeam, updateTeam, deleteTeam, refreshTeams,
      createPersonnel, updatePersonnel, deletePersonnel, refreshPersonnel,
      createProject, updateProject, deleteProject, refreshProjects,
      createTask, updateTask, deleteTask, refreshTasks,
      createMilestone, updateMilestone, deleteMilestone, refreshMilestones,
      createEvent, updateEvent, deleteEvent, refreshEvents,
      refreshActivity,
      getProjectById, getTasksByProject, getMilestonesByProject, getEventsByDate, getPersonnelByTeam,
    }}>
      {children}
    </DataContext.Provider>
  );
}

const DATA_DEFAULTS: DataContextType = {
  teams: [], personnel: [], projects: [], tasks: [], milestones: [], events: [], activityLogs: [], isLoading: false,
  createTeam: async () => {}, updateTeam: async () => {}, deleteTeam: async () => {}, refreshTeams: async () => {},
  createPersonnel: async () => {}, updatePersonnel: async () => {}, deletePersonnel: async () => {}, refreshPersonnel: async () => {},
  createProject: async () => null, updateProject: async () => {}, deleteProject: async () => {}, refreshProjects: async () => {},
  createTask: async () => {}, updateTask: async () => {}, deleteTask: async () => {}, refreshTasks: async () => {},
  createMilestone: async () => {}, updateMilestone: async () => {}, deleteMilestone: async () => {}, refreshMilestones: async () => {},
  createEvent: async () => {}, updateEvent: async () => {}, deleteEvent: async () => {}, refreshEvents: async () => {},
  refreshActivity: async () => {},
  getProjectById: () => undefined, getTasksByProject: () => [], getMilestonesByProject: () => [],
  getEventsByDate: () => [], getPersonnelByTeam: () => [],
};

export function useData() {
  return useContext(DataContext) ?? DATA_DEFAULTS;
}
