import { Router } from "express";
import { db, activityLogsTable } from "@workspace/db";
import type { ActivityLog } from "@workspace/db";
import { inArray, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { visibleTeamIdsFor } from "../lib/permissions";

const router = Router();

// GET /activity — admin sees all; managers see only their visible teams' logs
router.get("/activity", requireAuth, async (req, res): Promise<void> => {
  const user = req.authUser!;
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const visible = await visibleTeamIdsFor(user);
  let logs: ActivityLog[];
  if (visible === "all") {
    logs = await db
      .select()
      .from(activityLogsTable)
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(limit);
  } else if (visible.length > 0) {
    logs = await db
      .select()
      .from(activityLogsTable)
      .where(inArray(activityLogsTable.teamId, visible))
      .orderBy(desc(activityLogsTable.createdAt))
      .limit(limit);
  } else {
    logs = [];
  }

  res.json(logs);
});

export default router;
