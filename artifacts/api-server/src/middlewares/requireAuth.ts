import type { Request, Response, NextFunction } from "express";
import { getUserFromToken } from "../lib/auth";
import type { User } from "@workspace/db";

declare global {
  namespace Express {
    interface Request {
      authUser?: User;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
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
  next: NextFunction
): Promise<void> {
  await requireAuth(req, res, () => {
    if (req.authUser?.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}

export async function requireTeamLeader(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  await requireAuth(req, res, () => {
    const role = req.authUser?.role;
    if (role !== "admin" && role !== "team_leader") {
      res.status(403).json({ error: "Team leader access required" });
      return;
    }
    next();
  });
}
