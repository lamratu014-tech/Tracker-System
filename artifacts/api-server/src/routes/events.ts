import { Router } from "express";
import { z } from "zod";
import { db, eventsTable, eventInvitationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireTeamLead } from "../middlewares/requireAuth";
import { logActivity } from "../lib/activity";

const router = Router();

// GET /events — filtered by visibility rules
router.get("/events", requireAuth, async (req, res): Promise<void> => {
  const user = req.authUser!;

  const allEvents = await db.select().from(eventsTable).orderBy(eventsTable.startDate);
  const allInvitations = await db.select().from(eventInvitationsTable);

  const result = allEvents.flatMap((event) => {
    const invitedTeamIds = allInvitations
      .filter((inv) => inv.eventId === event.id)
      .map((inv) => inv.teamId);

    if (user.role === "programme_lead") {
      return [{ ...event, invitedTeamIds, visibility: "full" as const }];
    }

    if (!user.teamId) return [];

    if (event.createdByTeamId === user.teamId) {
      return [{ ...event, invitedTeamIds, visibility: "full" as const }];
    }

    if (invitedTeamIds.includes(user.teamId)) {
      return [{
        id: event.id,
        title: event.title,
        sharedDescription: event.sharedDescription,
        internalDescription: null,
        startDate: event.startDate,
        endDate: event.endDate,
        location: event.location,
        color: event.color,
        isAllDay: event.isAllDay,
        status: event.status,
        projectId: null,
        createdByTeamId: event.createdByTeamId,
        createdByUserId: event.createdByUserId,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        invitedTeamIds,
        visibility: "shared" as const,
      }];
    }

    return [];
  });

  res.json(result);
});

// GET /events/:id
router.get("/events/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.authUser!;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  const invitations = await db.select().from(eventInvitationsTable).where(eq(eventInvitationsTable.eventId, id));
  const invitedTeamIds = invitations.map((i) => i.teamId);

  if (user.role === "programme_lead" || event.createdByTeamId === user.teamId) {
    res.json({ ...event, invitedTeamIds, visibility: "full" });
    return;
  }

  if (user.teamId && invitedTeamIds.includes(user.teamId)) {
    res.json({
      id: event.id,
      title: event.title,
      sharedDescription: event.sharedDescription,
      internalDescription: null,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location,
      color: event.color,
      isAllDay: event.isAllDay,
      status: event.status,
      projectId: null,
      createdByTeamId: event.createdByTeamId,
      createdByUserId: event.createdByUserId,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      invitedTeamIds,
      visibility: "shared",
    });
    return;
  }

  res.status(403).json({ error: "Access denied" });
});

const EventBody = z.object({
  title: z.string().min(1),
  internalDescription: z.string().optional(),
  sharedDescription: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  location: z.string().optional(),
  color: z.string().optional(),
  isAllDay: z.boolean().optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  projectId: z.string().optional().nullable(),
  invitedTeamIds: z.array(z.string()).optional(),
});

// POST /events — team_lead or programme_lead
router.post("/events", requireTeamLead, async (req, res): Promise<void> => {
  const user = req.authUser!;
  const parsed = EventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { invitedTeamIds = [], ...eventData } = parsed.data;

  const [event] = await db.insert(eventsTable).values({
    ...eventData,
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

// PATCH /events/:id
router.patch("/events/:id", requireTeamLead, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.authUser!;

  const [existing] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Event not found" }); return; }

  if (user.role !== "programme_lead" && existing.createdByTeamId !== user.teamId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const parsed = EventBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { invitedTeamIds, ...eventData } = parsed.data;

  const [event] = await db.update(eventsTable).set({
    ...eventData,
    startDate: eventData.startDate ? new Date(eventData.startDate) : undefined,
    endDate: eventData.endDate ? new Date(eventData.endDate) : undefined,
  }).where(eq(eventsTable.id, id)).returning();

  if (invitedTeamIds !== undefined) {
    await db.delete(eventInvitationsTable).where(eq(eventInvitationsTable.eventId, id));
    if (invitedTeamIds.length > 0) {
      await db.insert(eventInvitationsTable).values(
        invitedTeamIds.map((teamId) => ({ eventId: id, teamId }))
      );
    }
  }

  const finalInvitations = await db.select().from(eventInvitationsTable).where(eq(eventInvitationsTable.eventId, id));
  await logActivity({ user, actionType: "update", entityType: "event", entityId: event.id, entityTitle: event.title });
  res.json({ ...event, invitedTeamIds: finalInvitations.map((i) => i.teamId) });
});

// DELETE /events/:id
router.delete("/events/:id", requireTeamLead, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = req.authUser!;

  const [existing] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Event not found" }); return; }

  if (user.role !== "programme_lead" && existing.createdByTeamId !== user.teamId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  await db.delete(eventsTable).where(eq(eventsTable.id, id));
  await logActivity({ user, actionType: "delete", entityType: "event", entityId: id, entityTitle: existing.title });
  res.sendStatus(204);
});

export default router;
