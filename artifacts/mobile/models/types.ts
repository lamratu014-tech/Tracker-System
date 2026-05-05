export type Role = "admin" | "leader" | "member";

export type MilestoneStatus = "pending" | "in_progress" | "blocked" | "completed";

export interface User {
  id: string;
  name: string;
  role: Role;
  teamId: string | null;
}

export interface Member {
  id: string;
  name: string;
}

export interface Milestone {
  id: string;
  title: string;
  status: MilestoneStatus;
  deadline: string;
  createdAt: string;
  completedAt: string | null;
  assignedTo: string | null;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  milestones: Milestone[];
}

export interface Team {
  id: string;
  name: string;
  leaderId: string | null;
  members: Member[];
  projects: Project[];
}

export interface Stream {
  id: string;
  name: string;
  teams: Team[];
}

export interface AppEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  fullDateTime: string;
  linkedStreamId: string | null;
  linkedTeamId: string | null;
  createdBy: string;
}

export interface NewMilestoneInput {
  title: string;
  status?: MilestoneStatus;
  deadline: string;
  assignedTo?: string | null;
}

export interface NewProjectInput {
  title: string;
  description?: string;
}

export interface NewTeamInput {
  name: string;
  leaderId?: string | null;
}

export interface NewStreamInput {
  name: string;
}

export interface NewUserInput {
  name: string;
  role: Role;
  teamId?: string | null;
}

export interface NewEventInput {
  title: string;
  description?: string;
  date: string;
  time: string;
  linkedStreamId?: string | null;
  linkedTeamId?: string | null;
}

export function isOverdue(milestone: Milestone, now: Date = new Date()): boolean {
  if (milestone.status === "completed") return false;
  const d = new Date(milestone.deadline);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < now.getTime();
}
