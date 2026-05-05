import type {
  Event as ApiEvent,
  EventWithVisibility,
  Member,
  Milestone,
  Project,
  ProjectWithTeamName,
  Stream,
  Team,
  TeamNote,
  TeamWithStreamName,
  User,
  UserRole,
} from "@workspace/api-client-react";

export type Role = UserRole;
export type {
  ApiEvent as AppEvent,
  EventWithVisibility,
  Member,
  Milestone,
  Project,
  ProjectWithTeamName,
  Stream,
  Team,
  TeamNote,
  TeamWithStreamName,
  User,
};

export function isOverdue(milestone: Milestone, now: Date = new Date()): boolean {
  if (milestone.completed) return false;
  const d = new Date(milestone.date);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < now.getTime();
}

export function isDueToday(m: Milestone, now: Date = new Date()): boolean {
  if (m.completed) return false;
  const d = new Date(m.date);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
