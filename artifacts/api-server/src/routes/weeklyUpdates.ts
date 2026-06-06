import { Router } from "express";
import {
  db,
  weeklyUpdatesTable,
  streamsTable,
  usersTable,
  programmesTable,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { SubmitWeeklyUpdateBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activity";

const router = Router();

/**
 * Returns the Monday (YYYY-MM-DD, UTC) of the week containing `d`. Weeks
 * start Monday. Computed server-side so the current week is authoritative
 * and updates can't be backdated.
 */
function weekStartOf(d: Date): string {
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = date.getUTCDay(); // 0 = Sun .. 6 = Sat
  const shift = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + shift);
  return date.toISOString().slice(0, 10);
}

// GET /weekly-updates — scoped list of updates the caller may read.
//   admin              → every update
//   programme_overseer → updates whose stream is inside their programme
//   stream_overseer    → only their own updates
//   anyone else        → 403
router.get("/weekly-updates", requireAuth, async (req, res): Promise<void> => {
  const user = req.authUser!;

  if (
    user.role !== "admin" &&
    user.role !== "programme_overseer" &&
    user.role !== "stream_overseer"
  ) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  if (user.role === "programme_overseer" && !user.programmeId) {
    res.json([]);
    return;
  }

  const base = db
    .select({
      id: weeklyUpdatesTable.id,
      authorId: weeklyUpdatesTable.authorId,
      streamId: weeklyUpdatesTable.streamId,
      weekStart: weeklyUpdatesTable.weekStart,
      body: weeklyUpdatesTable.body,
      createdAt: weeklyUpdatesTable.createdAt,
      updatedAt: weeklyUpdatesTable.updatedAt,
      authorName: usersTable.name,
      streamName: streamsTable.name,
      programmeId: programmesTable.id,
      programmeName: programmesTable.name,
    })
    .from(weeklyUpdatesTable)
    .leftJoin(usersTable, eq(usersTable.id, weeklyUpdatesTable.authorId))
    .leftJoin(streamsTable, eq(streamsTable.id, weeklyUpdatesTable.streamId))
    .leftJoin(programmesTable, eq(programmesTable.id, streamsTable.programmeId));

  let rows;
  if (user.role === "admin") {
    rows = await base.orderBy(
      desc(weeklyUpdatesTable.weekStart),
      desc(weeklyUpdatesTable.updatedAt),
    );
  } else if (user.role === "programme_overseer") {
    rows = await base
      .where(eq(streamsTable.programmeId, user.programmeId!))
      .orderBy(desc(weeklyUpdatesTable.weekStart), desc(weeklyUpdatesTable.updatedAt));
  } else {
    rows = await base
      .where(eq(weeklyUpdatesTable.authorId, user.id))
      .orderBy(desc(weeklyUpdatesTable.weekStart), desc(weeklyUpdatesTable.updatedAt));
  }

  res.json(rows);
});

// GET /weekly-updates/status — current-week submission status for the
// active stream overseers in the caller's scope (admins = all). Used to
// surface who hasn't submitted yet.
router.get(
  "/weekly-updates/status",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = req.authUser!;

    if (
      user.role !== "admin" &&
      user.role !== "programme_overseer" &&
      user.role !== "stream_overseer"
    ) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const weekStart = weekStartOf(new Date());

    if (user.role === "programme_overseer" && !user.programmeId) {
      res.json({ weekStart, overseers: [] });
      return;
    }

    // Only overseers with a real stream are reportable (the unit of work is
    // the stream). The inner join on streams drops anyone unassigned.
    const conds = [
      eq(usersTable.role, "stream_overseer"),
      eq(usersTable.active, true),
    ];
    if (user.role === "programme_overseer") {
      conds.push(eq(streamsTable.programmeId, user.programmeId!));
    } else if (user.role === "stream_overseer") {
      conds.push(eq(usersTable.id, user.id));
    }

    const rows = await db
      .select({
        userId: usersTable.id,
        name: usersTable.name,
        streamId: usersTable.streamId,
        streamName: streamsTable.name,
        updateId: weeklyUpdatesTable.id,
        submittedAt: weeklyUpdatesTable.updatedAt,
      })
      .from(usersTable)
      .innerJoin(streamsTable, eq(streamsTable.id, usersTable.streamId))
      .leftJoin(
        weeklyUpdatesTable,
        and(
          eq(weeklyUpdatesTable.authorId, usersTable.id),
          eq(weeklyUpdatesTable.weekStart, weekStart),
        ),
      )
      .where(and(...conds))
      .orderBy(usersTable.name);

    const overseers = rows.map((r) => ({
      userId: r.userId,
      name: r.name,
      streamId: r.streamId!,
      streamName: r.streamName,
      submitted: !!r.updateId,
      submittedAt: r.submittedAt ?? null,
      updateId: r.updateId ?? null,
    }));

    res.json({ weekStart, overseers });
  },
);

// POST /weekly-updates — submit or edit the current week's update.
// Stream overseers only, and they must be assigned to a stream.
router.post("/weekly-updates", requireAuth, async (req, res): Promise<void> => {
  const user = req.authUser!;

  if (user.role !== "stream_overseer") {
    res.status(403).json({ error: "Only stream overseers can submit weekly updates" });
    return;
  }
  if (!user.streamId) {
    res.status(403).json({ error: "Your account is not assigned to a stream" });
    return;
  }

  const parsed = SubmitWeeklyUpdateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const weekStart = weekStartOf(new Date());

  const [row] = await db
    .insert(weeklyUpdatesTable)
    .values({
      authorId: user.id,
      streamId: user.streamId,
      weekStart,
      body: parsed.data.body,
    })
    .onConflictDoUpdate({
      target: [weeklyUpdatesTable.authorId, weeklyUpdatesTable.weekStart],
      set: { body: parsed.data.body, updatedAt: new Date() },
    })
    .returning();

  const [stream] = await db
    .select({
      name: streamsTable.name,
      programmeId: programmesTable.id,
      programmeName: programmesTable.name,
    })
    .from(streamsTable)
    .leftJoin(programmesTable, eq(programmesTable.id, streamsTable.programmeId))
    .where(eq(streamsTable.id, row.streamId))
    .limit(1);

  await logActivity({
    user,
    actionType: "update",
    entityType: "weekly_update",
    entityId: row.id,
    entityTitle: `Weekly update (${weekStart})`,
  });

  res.json({
    ...row,
    authorName: user.name,
    streamName: stream?.name ?? null,
    programmeId: stream?.programmeId ?? null,
    programmeName: stream?.programmeName ?? null,
  });
});

export default router;
