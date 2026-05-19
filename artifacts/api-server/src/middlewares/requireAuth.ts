import type { Request, Response, NextFunction } from "express";
import { getUserFromToken } from "../lib/auth";
import type { Principal } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      authUser?: Principal;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorised" });
    return;
  }
  const token = header.slice(7);
  const user = await getUserFromToken(token);
  if (!user) {
    res.status(401).json({ error: "Unauthorised" });
    return;
  }
  req.authUser = user;
  next();
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuth(req, res, () => {
    if (req.authUser?.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}

// Allows admin, programme_overseer, stream_overseer, leader, or team_admin.
// Per-row scoping is enforced inside each route handler — this middleware
// only filters out plain members / unscoped users.
export async function requireManager(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuth(req, res, () => {
    const role = req.authUser?.role;
    if (
      role !== "admin" &&
      role !== "programme_overseer" &&
      role !== "stream_overseer" &&
      role !== "leader" &&
      role !== "team_admin"
    ) {
      res.status(403).json({ error: "Manager access required" });
      return;
    }
    next();
  });
}

// Backward-compat aliases used by older route imports during migration.
export const requireProgrammeLead = requireAdmin;
export const requireTeamLead = requireManager;
export const requireTeamLeader = requireManager;
