import {
  db,
  calendarSubscriptionsTable,
  eventsTable,
  type CalendarSubscription,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { parseIcs } from "./ics";
import { logger } from "./logger";

/** webcal:// is just https:// for HTTP fetch purposes. */
function normaliseFeedUrl(url: string): string {
  if (url.startsWith("webcal://")) return "https://" + url.slice("webcal://".length);
  if (url.startsWith("webcals://")) return "https://" + url.slice("webcals://".length);
  return url;
}

const FETCH_TIMEOUT_MS = 20_000;

async function fetchFeed(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(normaliseFeedUrl(url), {
      signal: controller.signal,
      headers: { Accept: "text/calendar, text/plain, */*" },
      redirect: "follow",
    });
    if (!res.ok) {
      throw new Error(`Feed responded with HTTP ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

export interface SyncResult {
  inserted: number;
  updated: number;
  removed: number;
}

/**
 * Re-sync one subscription against its feed. Reconciles imported events by
 * iCal UID: new UIDs are inserted, existing ones updated in place, and any
 * imported event whose UID disappeared from the feed is removed. Updates the
 * subscription's lastSynced* status fields either way.
 *
 * Imported events inherit the subscription's scope (programme or team) so the
 * existing event visibility logic applies unchanged, and the subscription's
 * colour so they render distinctly.
 */
export async function syncSubscription(
  sub: CalendarSubscription,
): Promise<SyncResult> {
  try {
    const text = await fetchFeed(sub.feedUrl);
    const parsed = parseIcs(text);

    // De-duplicate by UID, keeping the last occurrence in the feed.
    const byUid = new Map<string, (typeof parsed)[number]>();
    for (const ev of parsed) byUid.set(ev.uid, ev);

    const existing = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.subscriptionId, sub.id));
    const existingByUid = new Map(
      existing
        .filter((e) => e.externalUid)
        .map((e) => [e.externalUid as string, e]),
    );

    let inserted = 0;
    let updated = 0;

    for (const [uid, ev] of byUid) {
      const shared = {
        title: ev.summary,
        sharedDescription: ev.description,
        location: ev.location,
        startDate: ev.startDate,
        endDate: ev.endDate,
        isAllDay: ev.isAllDay,
        recurrenceFreq: ev.recurrenceFreq,
        recurrenceUntil: ev.recurrenceUntil,
        color: sub.color,
        programmeId: sub.programmeId,
        createdByTeamId: sub.teamId,
      };
      const current = existingByUid.get(uid);
      if (current) {
        await db
          .update(eventsTable)
          .set(shared)
          .where(eq(eventsTable.id, current.id));
        updated++;
      } else {
        await db.insert(eventsTable).values({
          ...shared,
          internalDescription: "",
          status: "approved",
          subscriptionId: sub.id,
          externalUid: uid,
          createdByUserId: null,
        });
        inserted++;
      }
    }

    // Remove imported events whose UID is no longer present in the feed.
    const staleIds = existing
      .filter((e) => !e.externalUid || !byUid.has(e.externalUid))
      .map((e) => e.id);
    if (staleIds.length > 0) {
      await db.delete(eventsTable).where(inArray(eventsTable.id, staleIds));
    }

    await db
      .update(calendarSubscriptionsTable)
      .set({
        lastSyncedAt: new Date(),
        lastSyncStatus: "ok",
        lastSyncError: null,
      })
      .where(eq(calendarSubscriptionsTable.id, sub.id));

    return { inserted, updated, removed: staleIds.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(calendarSubscriptionsTable)
      .set({
        lastSyncedAt: new Date(),
        lastSyncStatus: "error",
        lastSyncError: message.slice(0, 500),
      })
      .where(eq(calendarSubscriptionsTable.id, sub.id));
    throw err;
  }
}

/** Sync every subscription, logging failures without aborting the batch. */
export async function syncAllSubscriptions(): Promise<void> {
  const subs = await db.select().from(calendarSubscriptionsTable);
  for (const sub of subs) {
    try {
      const result = await syncSubscription(sub);
      logger.info(
        { subscriptionId: sub.id, ...result },
        "Synced calendar subscription",
      );
    } catch (err) {
      logger.warn(
        { err, subscriptionId: sub.id },
        "Failed to sync calendar subscription",
      );
    }
  }
}

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
let schedulerStarted = false;

/** Start the periodic background sync. Idempotent. */
export function startCalendarSyncScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Initial sync shortly after boot so a fresh process picks up feeds.
  setTimeout(() => {
    syncAllSubscriptions().catch((err) =>
      logger.warn({ err }, "Initial calendar sync failed"),
    );
  }, 10_000);

  setInterval(() => {
    syncAllSubscriptions().catch((err) =>
      logger.warn({ err }, "Scheduled calendar sync failed"),
    );
  }, SYNC_INTERVAL_MS);
}
