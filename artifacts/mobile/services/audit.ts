export type AuditAction =
  | "event.create"
  | "event.update"
  | "event.delete"
  | "event.approve"
  | "event.reject"
  | "project.create"
  | "project.update"
  | "project.delete"
  | "task.create"
  | "task.update"
  | "task.complete"
  | "task.delete"
  | "milestone.create"
  | "milestone.update"
  | "milestone.complete"
  | "milestone.delete"
  | "user.role_change"
  | "user.create"
  | "user.deactivate"
  | "admin.settings_change"
  | "admin.permission_override"
  | "system.data_export"
  | "system.data_wipe";

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  summary: string;
  detail?: string;
  severity: "info" | "warn" | "critical";
}

export function auditSeverity(action: AuditAction): "info" | "warn" | "critical" {
  if (
    action === "event.delete" ||
    action === "project.delete" ||
    action === "task.delete" ||
    action === "milestone.delete" ||
    action === "user.deactivate" ||
    action === "system.data_wipe"
  )
    return "critical";
  if (
    action === "user.role_change" ||
    action === "admin.permission_override" ||
    action === "system.data_export" ||
    action === "admin.settings_change"
  )
    return "warn";
  return "info";
}

export function genAuditId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 6);
}
