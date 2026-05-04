import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type EventStatus = "pending" | "approved" | "rejected";
export type ProjectStatus = "not_started" | "in_progress" | "at_risk" | "completed";
export type TaskStatus = "todo" | "in_progress" | "at_risk" | "done";
export type TaskPriority = "low" | "medium" | "high";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  color: string;
  projectId?: string;
  status: EventStatus;
  isAllDay: boolean;
  attendees: string[];
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  date: string;
  completed: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignee: string;
  dueDate: string;
  priority: TaskPriority;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  color: string;
  owner: string;
  dueDate: string;
  phase: string;
  tags: string[];
}

interface DataContextType {
  events: CalendarEvent[];
  projects: Project[];
  tasks: Task[];
  milestones: Milestone[];

  addEvent: (event: Omit<CalendarEvent, "id">) => void;
  updateEvent: (event: CalendarEvent) => void;
  deleteEvent: (id: string) => void;

  addProject: (project: Omit<Project, "id">) => void;
  updateProject: (project: Project) => void;
  deleteProject: (id: string) => void;

  addTask: (task: Omit<Task, "id">) => void;
  updateTask: (task: Task) => void;
  deleteTask: (id: string) => void;

  addMilestone: (milestone: Omit<Milestone, "id">) => void;
  updateMilestone: (milestone: Milestone) => void;
  deleteMilestone: (id: string) => void;

  getProjectById: (id: string) => Project | undefined;
  getTasksByProject: (projectId: string) => Task[];
  getMilestonesByProject: (projectId: string) => Milestone[];
  getEventsByDate: (dateStr: string) => CalendarEvent[];
}

const DataContext = createContext<DataContextType | null>(null);

const EVENTS_KEY = "ops_events";
const PROJECTS_KEY = "ops_projects";
const TASKS_KEY = "ops_tasks";
const MILESTONES_KEY = "ops_milestones";

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const EVENT_COLORS = ["#2563EB", "#7C3AED", "#DC2626", "#D97706", "#059669", "#0891B2", "#DB2777"];
const PROJECT_COLORS = ["#2563EB", "#7C3AED", "#059669", "#D97706", "#DC2626", "#0891B2"];

function seedData(): { events: CalendarEvent[]; projects: Project[]; tasks: Task[]; milestones: Milestone[] } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString();
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  const projects: Project[] = [
    { id: "p1", title: "Digital Transformation", description: "Migrate legacy systems to cloud infrastructure and modernise workflows.", status: "in_progress", color: PROJECT_COLORS[0], owner: "Alex Morgan", dueDate: fmt(addDays(today, 60)), phase: "Phase 2: Migration", tags: ["technology", "infrastructure"] },
    { id: "p2", title: "Annual Conference 2026", description: "Plan and execute the company's flagship annual conference.", status: "in_progress", color: PROJECT_COLORS[1], owner: "Sarah Chen", dueDate: fmt(addDays(today, 90)), phase: "Phase 1: Planning", tags: ["event", "external"] },
    { id: "p3", title: "Staff Wellbeing Programme", description: "Launch a comprehensive wellbeing initiative across all departments.", status: "not_started", color: PROJECT_COLORS[2], owner: "James Liu", dueDate: fmt(addDays(today, 120)), phase: "Pre-planning", tags: ["HR", "internal"] },
    { id: "p4", title: "Facilities Upgrade", description: "Renovate meeting rooms and update AV equipment.", status: "at_risk", color: PROJECT_COLORS[4], owner: "Nina Patel", dueDate: fmt(addDays(today, 30)), phase: "Phase 3: Execution", tags: ["facilities"] },
  ];

  const tasks: Task[] = [
    { id: "t1", projectId: "p1", title: "Audit existing infrastructure", description: "Document all current systems and dependencies.", status: "done", assignee: "Alex Morgan", dueDate: fmt(addDays(today, -5)), priority: "high" },
    { id: "t2", projectId: "p1", title: "Select cloud vendor", description: "Evaluate AWS, Azure, and GCP proposals.", status: "in_progress", assignee: "Alex Morgan", dueDate: fmt(addDays(today, 10)), priority: "high" },
    { id: "t3", projectId: "p1", title: "Draft migration plan", description: "Create detailed migration timeline and resource plan.", status: "todo", assignee: "Dev Team", dueDate: fmt(addDays(today, 20)), priority: "medium" },
    { id: "t4", projectId: "p2", title: "Book venue", description: "Confirm venue booking and catering.", status: "done", assignee: "Sarah Chen", dueDate: fmt(addDays(today, -10)), priority: "high" },
    { id: "t5", projectId: "p2", title: "Confirm keynote speakers", description: "Secure all keynote and session speakers.", status: "in_progress", assignee: "Sarah Chen", dueDate: fmt(addDays(today, 15)), priority: "high" },
    { id: "t6", projectId: "p2", title: "Design conference programme", description: "Create the full schedule and print materials.", status: "todo", assignee: "Marketing", dueDate: fmt(addDays(today, 40)), priority: "medium" },
    { id: "t7", projectId: "p4", title: "Obtain contractor quotes", description: "Get at least 3 quotes from licensed contractors.", status: "at_risk", assignee: "Nina Patel", dueDate: fmt(addDays(today, 5)), priority: "high" },
    { id: "t8", projectId: "p4", title: "Board approval", description: "Present budget to board for approval.", status: "todo", assignee: "Nina Patel", dueDate: fmt(addDays(today, 8)), priority: "high" },
  ];

  const milestones: Milestone[] = [
    { id: "m1", projectId: "p1", title: "Infrastructure audit complete", date: fmt(addDays(today, -5)), completed: true },
    { id: "m2", projectId: "p1", title: "Cloud vendor selected", date: fmt(addDays(today, 14)), completed: false },
    { id: "m3", projectId: "p1", title: "Migration plan approved", date: fmt(addDays(today, 30)), completed: false },
    { id: "m4", projectId: "p2", title: "Venue confirmed", date: fmt(addDays(today, -10)), completed: true },
    { id: "m5", projectId: "p2", title: "All speakers confirmed", date: fmt(addDays(today, 21)), completed: false },
    { id: "m6", projectId: "p2", title: "Conference goes live", date: fmt(addDays(today, 90)), completed: false },
  ];

  const startOfToday = new Date(today); startOfToday.setHours(9, 0, 0, 0);
  const endOfToday = new Date(today); endOfToday.setHours(10, 30, 0, 0);

  const events: CalendarEvent[] = [
    { id: "e1", title: "Leadership Briefing", description: "Weekly leadership team sync.", startDate: fmt(startOfToday), endDate: fmt(endOfToday), location: "Board Room", color: EVENT_COLORS[0], projectId: "p1", status: "approved", isAllDay: false, attendees: ["Alex Morgan", "Sarah Chen", "James Liu"] },
    { id: "e2", title: "Cloud Vendor Demo", description: "AWS solution architecture demonstration.", startDate: fmt(addDays(today, 2)), endDate: fmt(addDays(today, 2)), location: "Meeting Room A", color: EVENT_COLORS[1], projectId: "p1", status: "approved", isAllDay: false, attendees: ["Alex Morgan", "Dev Team"] },
    { id: "e3", title: "Speaker Briefing", description: "Briefing call with keynote speakers.", startDate: fmt(addDays(today, 3)), endDate: fmt(addDays(today, 3)), location: "Virtual", color: EVENT_COLORS[2], projectId: "p2", status: "approved", isAllDay: false, attendees: ["Sarah Chen"] },
    { id: "e4", title: "Facilities Walk-through", description: "Inspect renovation progress.", startDate: fmt(addDays(today, 5)), endDate: fmt(addDays(today, 5)), location: "Building B", color: EVENT_COLORS[3], projectId: "p4", status: "pending", isAllDay: false, attendees: ["Nina Patel"] },
    { id: "e5", title: "All-Staff Town Hall", description: "Quarterly all-staff update.", startDate: fmt(addDays(today, 7)), endDate: fmt(addDays(today, 7)), location: "Main Hall", color: EVENT_COLORS[4], status: "approved", isAllDay: false, attendees: ["All Staff"] },
    { id: "e6", title: "Annual Conference 2026", description: "Flagship annual company conference.", startDate: fmt(addDays(today, 90)), endDate: fmt(addDays(today, 92)), location: "Convention Centre", color: EVENT_COLORS[1], projectId: "p2", status: "approved", isAllDay: true, attendees: ["All Staff", "External Guests"] },
  ];

  return { events, projects, tasks, milestones };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [ev, pr, ta, mi] = await Promise.all([
          AsyncStorage.getItem(EVENTS_KEY),
          AsyncStorage.getItem(PROJECTS_KEY),
          AsyncStorage.getItem(TASKS_KEY),
          AsyncStorage.getItem(MILESTONES_KEY),
        ]);
        if (ev) setEvents(JSON.parse(ev));
        if (pr) setProjects(JSON.parse(pr));
        if (ta) setTasks(JSON.parse(ta));
        if (mi) setMilestones(JSON.parse(mi));

        if (!ev && !pr) {
          const seed = seedData();
          setEvents(seed.events);
          setProjects(seed.projects);
          setTasks(seed.tasks);
          setMilestones(seed.milestones);
          await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(seed.events));
          await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(seed.projects));
          await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(seed.tasks));
          await AsyncStorage.setItem(MILESTONES_KEY, JSON.stringify(seed.milestones));
        }
      } catch {}
    }
    load();
  }, []);

  const saveEvents = useCallback(async (data: CalendarEvent[]) => {
    setEvents(data);
    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(data));
  }, []);

  const saveProjects = useCallback(async (data: Project[]) => {
    setProjects(data);
    await AsyncStorage.setItem(PROJECTS_KEY, JSON.stringify(data));
  }, []);

  const saveTasks = useCallback(async (data: Task[]) => {
    setTasks(data);
    await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(data));
  }, []);

  const saveMilestones = useCallback(async (data: Milestone[]) => {
    setMilestones(data);
    await AsyncStorage.setItem(MILESTONES_KEY, JSON.stringify(data));
  }, []);

  const addEvent = useCallback((ev: Omit<CalendarEvent, "id">) => {
    const newEvent = { ...ev, id: genId() };
    saveEvents([...events, newEvent]);
  }, [events, saveEvents]);

  const updateEvent = useCallback((ev: CalendarEvent) => {
    saveEvents(events.map(e => e.id === ev.id ? ev : e));
  }, [events, saveEvents]);

  const deleteEvent = useCallback((id: string) => {
    saveEvents(events.filter(e => e.id !== id));
  }, [events, saveEvents]);

  const addProject = useCallback((pr: Omit<Project, "id">) => {
    saveProjects([...projects, { ...pr, id: genId() }]);
  }, [projects, saveProjects]);

  const updateProject = useCallback((pr: Project) => {
    saveProjects(projects.map(p => p.id === pr.id ? pr : p));
  }, [projects, saveProjects]);

  const deleteProject = useCallback((id: string) => {
    saveProjects(projects.filter(p => p.id !== id));
  }, [projects, saveProjects]);

  const addTask = useCallback((ta: Omit<Task, "id">) => {
    saveTasks([...tasks, { ...ta, id: genId() }]);
  }, [tasks, saveTasks]);

  const updateTask = useCallback((ta: Task) => {
    saveTasks(tasks.map(t => t.id === ta.id ? ta : t));
  }, [tasks, saveTasks]);

  const deleteTask = useCallback((id: string) => {
    saveTasks(tasks.filter(t => t.id !== id));
  }, [tasks, saveTasks]);

  const addMilestone = useCallback((mi: Omit<Milestone, "id">) => {
    saveMilestones([...milestones, { ...mi, id: genId() }]);
  }, [milestones, saveMilestones]);

  const updateMilestone = useCallback((mi: Milestone) => {
    saveMilestones(milestones.map(m => m.id === mi.id ? mi : m));
  }, [milestones, saveMilestones]);

  const deleteMilestone = useCallback((id: string) => {
    saveMilestones(milestones.filter(m => m.id !== id));
  }, [milestones, saveMilestones]);

  const getProjectById = useCallback((id: string) => projects.find(p => p.id === id), [projects]);
  const getTasksByProject = useCallback((projectId: string) => tasks.filter(t => t.projectId === projectId), [tasks]);
  const getMilestonesByProject = useCallback((projectId: string) => milestones.filter(m => m.projectId === projectId), [milestones]);

  const getEventsByDate = useCallback((dateStr: string) => {
    return events.filter(e => {
      const start = new Date(e.startDate);
      const target = new Date(dateStr);
      return start.getFullYear() === target.getFullYear() &&
        start.getMonth() === target.getMonth() &&
        start.getDate() === target.getDate();
    });
  }, [events]);

  return (
    <DataContext.Provider value={{
      events, projects, tasks, milestones,
      addEvent, updateEvent, deleteEvent,
      addProject, updateProject, deleteProject,
      addTask, updateTask, deleteTask,
      addMilestone, updateMilestone, deleteMilestone,
      getProjectById, getTasksByProject, getMilestonesByProject, getEventsByDate,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
