import { Router } from "express";
import {
  db,
  calendarSubscriptionsTable,
  type CalendarSubscription,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateCalendarSubscriptionBody,
  RefreshCalendarSubscriptionParams,
  DeleteCalendarSubscriptionParams,
} from "@workspace/api-zod";
import { requireAuth, requireManager } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activity";
import {
  userCanAccessTeam,
  userCanManageProgramme,
  userCanAccessProgramme,
} from "../lib/permissions";
import type { Principal } from "../lib/auth";
import { syncSubscription } from "../lib/calendarSync";

const router = Router();

/** Imported events inherit the subscription's scope, so visibility for a
 * subscription mirrors the visibility of events in that scope. */
async function canViewSubscription(
  user: Principal,
  sub: CalendarSubscription,
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (sub.teamId) return userCanAccessTeam(user, sub.teamId);
  if (sub.programmeId) return userCanAccessProgramme(user, sub.programmeId);
  return true; // org-wide subscription, visible to everyone
}

/** Who may create / refresh / delete a subscription in a given scope. */
async function canManageScope(
  user: Principal,
  teamId: string | null,
  programmeId: string | null,
): Promise<boolean> {
  if (teamId) return userCanAccessTeam(user, teamId);
  if (programmeId) return userCanManageProgramme(user, programmeId);
  // Org-wide subscriptions are admin-only, mirroring org-wide events.
  return user.role === "admin";
}

router.get(
  "/calendar-subscriptions",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = req.authUser!;
    const all = await db.select().from(calendarSubscriptionsTable);
    const visible: CalendarSubscription[] = [];
    for (const sub of all) {
      if (await canViewSubscription(user, sub)) visible.push(sub);
    }
    res.json(visible);
  },
);

router.post(
  "/calendar-subscriptions",
  requireManager,
  async (req, res): Promise<void> => {
    const user = req.authUser!;
    const parsed = CreateCalendarSubscriptionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { name, feedUrl, color, programmeId, teamId } = parsed.data;

    if (programmeId && teamId) {
      res
        .status(400)
        .json({ error: "A subscription can't be scoped to both a team and a programme" });
      return;
    }

    // Validate the feed URL scheme up front.
    const lower = feedUrl.toLowerCase();
    if (
      !lower.startsWith("http://") &&
      !lower.startsWith("https://") &&
      !lower.startsWith("webcal://") &&
      !lower.startsWith("webcals://")
    ) {
      res
        .status(400)
        .json({ error: "Feed URL must start with https://, http:// or webcal://" });
      return;
    }

    if (!(await canManageScope(user, teamId ?? null, programmeId ?? null))) {
      res
        .status(403)
        .json({ error: "You can't add a subscription for that scope" });
      return;
    }

    const [created] = await db
      .insert(calendarSubscriptionsTable)
      .values({
        name,
        feedUrl,
        color: color ?? "#2563EB",
        programmeId: programmeId ?? null,
        teamId: teamId ?? null,
        createdByUserId: user.id,
        lastSyncStatus: "pending",
      })
      .returning();

    await logActivity({
      user,
      actionType: "create",
      entityType: "calendar_subscription",
      entityId: created.id,
      entityTitle: created.name,
      teamId: created.teamId,
    });

    // Kick off an initial sync but don't fail creation if the feed is bad —
    // the error surfaces via lastSyncStatus / lastSyncError.
    let result = created;
    try {
      await syncSubscription(created);
      const [refreshed] = await db
        .select()
        .from(calendarSubscriptionsTable)
        .where(eq(calendarSubscriptionsTable.id, created.id));
      if (refreshed) result = refreshed;
    } catch (err) {
      req.log.warn({ err, subscriptionId: created.id }, "Initial sync failed");
      const [refreshed] = await db
        .select()
        .from(calendarSubscriptionsTable)
        .where(eq(calendarSubscriptionsTable.id, created.id));
      if (refreshed) result = refreshed;
    }

    res.status(201).json(result);
  },
);

router.post(
  "/calendar-subscriptions/:id/refresh",
  requireManager,
  async (req, res): Promise<void> => {
    const params = RefreshCalendarSubscriptionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const user = req.authUser!;
    const [sub] = await db
      .select()
      .from(calendarSubscriptionsTable)
      .where(eq(calendarSubscriptionsTable.id, params.data.id))
      .limit(1);
    if (!sub) {
      res.status(404).json({ error: "Subscription not found" });
      return;
    }
    if (!(await canManageScope(user, sub.teamId, sub.programmeId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    try {
      await syncSubscription(sub);
    } catch (err) {
      req.log.warn({ err, subscriptionId: sub.id }, "Manual refresh failed");
    }

    const [refreshed] = await db
      .select()
      .from(calendarSubscriptionsTable)
      .where(eq(calendarSubscriptionsTable.id, sub.id));
    res.json(refreshed ?? sub);
  },
);

router.delete(
  "/calendar-subscriptions/:id",
  requireManager,
  async (req, res): Promise<void> => {
    const params = DeleteCalendarSubscriptionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const user = req.authUser!;
    const [sub] = await db
      .select()
      .from(calendarSubscriptionsTable)
      .where(eq(calendarSubscriptionsTable.id, params.data.id))
      .limit(1);
    if (!sub) {
      res.status(404).json({ error: "Subscription not found" });
      return;
    }
    if (!(await canManageScope(user, sub.teamId, sub.programmeId))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    // Imported events cascade-delete via the FK on events.subscription_id.
    await db
      .delete(calendarSubscriptionsTable)
      .where(eq(calendarSubscriptionsTable.id, sub.id));

    await logActivity({
      user,
      actionType: "delete",
      entityType: "calendar_subscription",
      entityId: sub.id,
      entityTitle: sub.name,
      teamId: sub.teamId,
    });

    res.sendStatus(204);
  },
);

export default router;
