import { Router } from "express";
import { db, eventsTable, eventInvitationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateEventBody,
  UpdateEventBody,
  GetEventParams,
  UpdateEventParams,
  DeleteEventParams,
} from "@workspace/api-zod";
import { requireAuth, requireManager } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activity";
import { userCanAccessTeam } from "../lib/permissions";

const router = Router();

router.get("/events", requireAuth, async (req, res): Promise<void> => {
  const user = req.authUser!;

  const allEvents = await db.select().from(eventsTable).orderBy(eventsTable.startDate);
  const allInvitations = await db.select().from(eventInvitationsTable);

  type EventOut = (typeof allEvents)[number] & {
    invitedTeamIds: string[];
    visibility: "full" | "shared";
  };

  const result: EventOut[] = [];
  for (const event of allEvents) {
    const invitedTeamIds = allInvitations.filter((i) => i.eventId === event.id).map((i) => i.teamId);

    if (await userCanAccessTeam(user, event.createdByTeamId)) {
      result.push({ ...event, invitedTeamIds, visibility: "full" });
      continue;
    }

    if (user.teamId && invitedTeamIds.includes(user.teamId)) {
      result.push({
        ...event,
        internalDescription: "",
        projectId: null,
        invitedTeamIds,
        visibility: "shared",
      });
    }
  }

  res.json(result);
});

router.get("/events/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetEventParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const user = req.authUser!;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, params.data.id)).limit(1);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  const invitations = await db.select().from(eventInvitationsTable).where(eq(eventInvitationsTable.eventId, params.data.id));
  const invitedTeamIds = invitations.map((i) => i.teamId);

  if (await userCanAccessTeam(user, event.createdByTeamId)) {
    res.json({ ...event, invitedTeamIds, visibility: "full" });
    return;
  }

  if (user.teamId && invitedTeamIds.includes(user.teamId)) {
    res.json({
      ...event,
      internalDescription: "",
      projectId: null,
      invitedTeamIds,
      visibility: "shared",
    });
    return;
  }

  res.status(403).json({ error: "Access denied" });
});

router.post("/events", requireManager, async (req, res): Promise<void> => {
  const user = req.authUser!;
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { invitedTeamIds = [], ...eventData } = parsed.data;

  const [event] = await db.insert(eventsTable).values({
    title: eventData.title,
    internalDescription: eventData.internalDescription,
    sharedDescription: eventData.sharedDescription,
    location: eventData.location,
    color: eventData.color,
    isAllDay: eventData.isAllDay,
    status: eventData.status,
    projectId: eventData.projectId,
    startDate: new Date(eventData.startDate),
    endDate: new Date(eventData.endDate),
    createdByTeamId: user.teamId,
    createdByUserId: user.id,
  }).returning();

  if (invitedTeamIds.length > 0) {
    await db.insert(eventInvitationsTable).values(
      invitedTeamIds.map((teamId) => ({ eventId: event.id, teamId }))
    );
  }

  await logActivity({ user, actionType: "create", entityType: "event", entityId: event.id, entityTitle: event.title });
  res.status(201).json({ ...event, invitedTeamIds });
});

router.patch("/events/:id", requireManager, async (req, res): Promise<void> => {
  const params = UpdateEventParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const user = req.authUser!;

  const [existing] = await db.select().from(eventsTable).where(eq(eventsTable.id, params.data.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Event not found" }); return; }

  if (!(await userCanAccessTeam(user, existing.createdByTeamId))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { invitedTeamIds, ...eventData } = parsed.data;

  const patch: Partial<typeof eventsTable.$inferInsert> = {};
  if ("title" in eventData) patch.title = eventData.title;
  if ("internalDescription" in eventData) patch.internalDescription = eventData.internalDescription;
  if ("sharedDescription" in eventData) patch.sharedDescription = eventData.sharedDescription;
  if ("location" in eventData) patch.location = eventData.location;
  if ("color" in eventData) patch.color = eventData.color;
  if ("isAllDay" in eventData) patch.isAllDay = eventData.isAllDay;
  if ("status" in eventData) patch.status = eventData.status;
  if ("projectId" in eventData) patch.projectId = eventData.projectId ?? null;
  if ("startDate" in eventData && eventData.startDate) patch.startDate = new Date(eventData.startDate);
  if ("endDate" in eventData && eventData.endDate) patch.endDate = new Date(eventData.endDate);

  const [event] = await db.update(eventsTable).set(patch).where(eq(eventsTable.id, params.data.id)).returning();

  if (invitedTeamIds !== undefined) {
    await db.delete(eventInvitationsTable).where(eq(eventInvitationsTable.eventId, params.data.id));
    if (invitedTeamIds.length > 0) {
      await db.insert(eventInvitationsTable).values(
        invitedTeamIds.map((teamId) => ({ eventId: params.data.id, teamId }))
      );
    }
  }

  const finalInvitations = await db.select().from(eventInvitationsTable).where(eq(eventInvitationsTable.eventId, params.data.id));
  await logActivity({ user, actionType: "update", entityType: "event", entityId: event.id, entityTitle: event.title });
  res.json({ ...event, invitedTeamIds: finalInvitations.map((i) => i.teamId) });
});

router.delete("/events/:id", requireManager, async (req, res): Promise<void> => {
  const params = DeleteEventParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const user = req.authUser!;

  const [existing] = await db.select().from(eventsTable).where(eq(eventsTable.id, params.data.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Event not found" }); return; }

  if (!(await userCanAccessTeam(user, existing.createdByTeamId))) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  await db.delete(eventsTable).where(eq(eventsTable.id, params.data.id));
  await logActivity({ user, actionType: "delete", entityType: "event", entityId: params.data.id, entityTitle: existing.title });
  res.sendStatus(204);
});

export default router;
