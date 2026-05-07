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
import {
  userCanAccessTeam,
  userCanAccessProgramme,
  userCanManageProgramme,
} from "../lib/permissions";

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

    // Org-wide events (no team and no programme link) are visible to everyone.
    if (!event.createdByTeamId && !event.programmeId) {
      result.push({ ...event, invitedTeamIds, visibility: "full" });
      continue;
    }

    if (await userCanAccessTeam(user, event.createdByTeamId)) {
      result.push({ ...event, invitedTeamIds, visibility: "full" });
      continue;
    }

    if (event.programmeId && (await userCanAccessProgramme(user, event.programmeId))) {
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

  if (!event.createdByTeamId && !event.programmeId) {
    res.json({ ...event, invitedTeamIds, visibility: "full" });
    return;
  }

  if (await userCanAccessTeam(user, event.createdByTeamId)) {
    res.json({ ...event, invitedTeamIds, visibility: "full" });
    return;
  }

  if (event.programmeId && (await userCanAccessProgramme(user, event.programmeId))) {
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

  const { invitedTeamIds = [], programmeId, ...eventData } = parsed.data;

  // Determine intended scope. Three modes:
  //   1. team-linked    → invitedTeamIds[0] set, no programmeId
  //   2. programme-linked → programmeId set, no team
  //   3. org-wide        → neither
  const teamScopeId = invitedTeamIds[0] ?? null;

  if (teamScopeId && programmeId) {
    res.status(400).json({ error: "An event can't be linked to both a team and a programme" });
    return;
  }

  // Authorise the chosen scope.
  if (teamScopeId) {
    if (!(await userCanAccessTeam(user, teamScopeId))) {
      res.status(403).json({ error: "You can't create events for that team" });
      return;
    }
  } else if (programmeId) {
    if (!(await userCanManageProgramme(user, programmeId))) {
      res.status(403).json({ error: "You can't create events for that programme" });
      return;
    }
  } else {
    // Org-wide is admin-only.
    if (user.role !== "admin") {
      res.status(403).json({ error: "Only admins can create org-wide events" });
      return;
    }
  }

  const [event] = await db.insert(eventsTable).values({
    title: eventData.title,
    internalDescription: eventData.internalDescription,
    sharedDescription: eventData.sharedDescription,
    location: eventData.location,
    color: eventData.color,
    isAllDay: eventData.isAllDay,
    status: eventData.status,
    projectId: eventData.projectId,
    programmeId: programmeId ?? null,
    startDate: new Date(eventData.startDate),
    endDate: new Date(eventData.endDate),
    createdByTeamId: teamScopeId,
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

  // Allow management by team-scope OR programme-scope managers, plus admins
  // for org-wide events.
  const canByTeam = await userCanAccessTeam(user, existing.createdByTeamId);
  const canByProgramme = existing.programmeId
    ? await userCanManageProgramme(user, existing.programmeId)
    : false;
  const canByOrg =
    !existing.createdByTeamId && !existing.programmeId && user.role === "admin";
  if (!canByTeam && !canByProgramme && !canByOrg) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { invitedTeamIds, programmeId, ...eventData } = parsed.data;

  // Compute the resulting scope after this patch is applied so we can
  // enforce the "exactly one of team / programme / org" rule and the
  // associated authorisation, instead of trusting the existing row.
  const nextTeamScopeId =
    invitedTeamIds !== undefined
      ? (invitedTeamIds[0] ?? null)
      : existing.createdByTeamId;
  const nextProgrammeId =
    "programmeId" in parsed.data
      ? (programmeId ?? null)
      : existing.programmeId;

  if (nextTeamScopeId && nextProgrammeId) {
    res.status(400).json({ error: "An event can't be linked to both a team and a programme" });
    return;
  }

  // Re-authorise the resulting scope (a manager can't downgrade a
  // team/programme event into org-wide unless they're admin).
  if (nextTeamScopeId) {
    if (!(await userCanAccessTeam(user, nextTeamScopeId))) {
      res.status(403).json({ error: "You can't link this event to that team" });
      return;
    }
  } else if (nextProgrammeId) {
    if (!(await userCanManageProgramme(user, nextProgrammeId))) {
      res.status(403).json({ error: "You can't link this event to that programme" });
      return;
    }
  } else {
    // Resulting scope is org-wide → admin only.
    if (user.role !== "admin") {
      res.status(403).json({ error: "Only admins can make events org-wide" });
      return;
    }
  }

  const patch: Partial<typeof eventsTable.$inferInsert> = {};
  if ("title" in eventData) patch.title = eventData.title;
  if ("internalDescription" in eventData) patch.internalDescription = eventData.internalDescription;
  if ("sharedDescription" in eventData) patch.sharedDescription = eventData.sharedDescription;
  if ("location" in eventData) patch.location = eventData.location;
  if ("color" in eventData) patch.color = eventData.color;
  if ("isAllDay" in eventData) patch.isAllDay = eventData.isAllDay;
  if ("status" in eventData) patch.status = eventData.status;
  if ("projectId" in eventData) patch.projectId = eventData.projectId ?? null;
  // Mirror the resulting scope: the patch is the source of truth, so when
  // invitedTeamIds clears the team link we also clear createdByTeamId, and
  // setting a programmeId implicitly clears any leftover team ownership.
  if (invitedTeamIds !== undefined || "programmeId" in parsed.data) {
    patch.createdByTeamId = nextTeamScopeId;
    patch.programmeId = nextProgrammeId;
  }
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

  const canByTeam = await userCanAccessTeam(user, existing.createdByTeamId);
  const canByProgramme = existing.programmeId
    ? await userCanManageProgramme(user, existing.programmeId)
    : false;
  const canByOrg =
    !existing.createdByTeamId && !existing.programmeId && user.role === "admin";
  if (!canByTeam && !canByProgramme && !canByOrg) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  await db.delete(eventsTable).where(eq(eventsTable.id, params.data.id));
  await logActivity({ user, actionType: "delete", entityType: "event", entityId: params.data.id, entityTitle: existing.title });
  res.sendStatus(204);
});

export default router;
