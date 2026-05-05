import { Router } from "express";
import { db, activityLogsTable } from "@workspace/db";
import type { ActivityLog } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

// GET /activity — admin sees all; managers see only their team's
router.get("/activity", requireAuth, async (req, res): Promise<void> => {
  const user = req.authUser!;
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  let logs: ActivityLog[];
  if (user.role === "admin") {
    logs = await db
      .select()
      .from(activityLogsTable)
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(limit);
  } else if (user.teamId) {
    logs = await db
      .select()
      .from(activityLogsTable)
      .where(eq(activityLogsTable.teamId, user.teamId))
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(limit);
  } else {
    logs = [];
  }

  res.json(logs);
});

export default router;
