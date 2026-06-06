// Client-side recurrence expansion.
//
// Events store a recurrence *rule* (`recurrenceFreq` + optional `recurrenceUntil`)
// rather than pre-expanded rows. This single helper turns that rule into concrete
// occurrences for a bounded window, and is the one source of truth shared by the
// calendar grid, the day list, and the dashboard so a recurring event looks
// identical everywhere.

export type RecurrenceFreq = "none" | "daily" | "weekly" | "monthly" | "yearly";

export interface RecurringEventLike {
  id: string;
  startDate: string;
  endDate: string;
  recurrenceFreq?: RecurrenceFreq | null;
  recurrenceUntil?: string | null;
}

// An occurrence carries the original event plus the concrete start/end of this
// instance and a key that is unique even when occurrences of the same event
// overlap (e.g. a week-long event repeating weekly).
export type Occurrence<T extends RecurringEventLike> = T & {
  startDate: string;
  endDate: string;
  seriesId: string;
  occurrenceKey: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Hard ceiling so a malformed/unbounded rule can never spin forever. The window
// passed in by callers is small (a calendar grid), so this is only a safety net.
const MAX_STEPS = 1000;

function daysInMonth(year: number, monthIndex: number): number {
  // Day 0 of the next month is the last day of this month.
  return new Date(year, monthIndex + 1, 0).getDate();
}

// Build a concrete occurrence for step `n`. Returns null when the calendar date
// is impossible for that period (e.g. a 31st-of-the-month series in February, or
// a Feb 29 yearly series in a non-leap year). We *skip* those rather than letting
// JavaScript roll the overflow into the following month (Jan 31 + 1mo => Mar 3),
// which would silently drift the whole series. Day-of-month is preserved whenever
// the target month actually has that day.
function addStep(base: Date, freq: RecurrenceFreq, n: number): Date | null {
  if (freq === "daily") {
    const d = new Date(base);
    d.setDate(d.getDate() + n);
    return d;
  }
  if (freq === "weekly") {
    const d = new Date(base);
    d.setDate(d.getDate() + 7 * n);
    return d;
  }

  const day = base.getDate();
  const h = base.getHours();
  const mi = base.getMinutes();
  const s = base.getSeconds();
  const ms = base.getMilliseconds();

  if (freq === "monthly") {
    const monthTotal = base.getMonth() + n;
    const year = base.getFullYear() + Math.floor(monthTotal / 12);
    const month = ((monthTotal % 12) + 12) % 12;
    if (day > daysInMonth(year, month)) return null;
    return new Date(year, month, day, h, mi, s, ms);
  }
  if (freq === "yearly") {
    const year = base.getFullYear() + n;
    const month = base.getMonth();
    if (day > daysInMonth(year, month)) return null;
    return new Date(year, month, day, h, mi, s, ms);
  }
  return null;
}

// Monotonic reference time for step `n`, used purely for loop-termination so the
// walk can stop even on steps where addStep() returns null (a skipped date). For
// monthly/yearly we anchor to the first of the target period, which is always
// <= the real occurrence, so once the reference passes the window/until bound the
// real occurrence cannot re-enter it.
function referenceStep(base: Date, freq: RecurrenceFreq, n: number): Date {
  if (freq === "daily") {
    const d = new Date(base);
    d.setDate(d.getDate() + n);
    return d;
  }
  if (freq === "weekly") {
    const d = new Date(base);
    d.setDate(d.getDate() + 7 * n);
    return d;
  }
  if (freq === "monthly") {
    const monthTotal = base.getMonth() + n;
    const year = base.getFullYear() + Math.floor(monthTotal / 12);
    const month = ((monthTotal % 12) + 12) % 12;
    return new Date(year, month, 1, 0, 0, 0, 0);
  }
  // yearly
  return new Date(base.getFullYear() + n, base.getMonth(), 1, 0, 0, 0, 0);
}

// Estimate the first occurrence index near `windowStart` so we don't iterate
// from index 0 for series that began long before the viewed window.
function estimateStartIndex(
  start: Date,
  freq: RecurrenceFreq,
  windowStart: Date,
): number {
  if (windowStart <= start) return 0;
  if (freq === "daily") return Math.floor((windowStart.getTime() - start.getTime()) / DAY_MS);
  if (freq === "weekly") return Math.floor((windowStart.getTime() - start.getTime()) / (7 * DAY_MS));
  if (freq === "monthly") {
    return (
      (windowStart.getFullYear() - start.getFullYear()) * 12 +
      (windowStart.getMonth() - start.getMonth())
    );
  }
  if (freq === "yearly") return windowStart.getFullYear() - start.getFullYear();
  return 0;
}

/**
 * Expand a list of events into the occurrences whose [start, end] interval
 * intersects the inclusive [windowStart, windowEnd] range. Non-repeating events
 * (or invalid dates) yield at most a single occurrence.
 */
export function expandOccurrences<T extends RecurringEventLike>(
  events: T[],
  windowStart: Date,
  windowEnd: Date,
): Occurrence<T>[] {
  const out: Occurrence<T>[] = [];
  const winStart = windowStart.getTime();
  const winEnd = windowEnd.getTime();

  for (const ev of events) {
    const start = new Date(ev.startDate);
    const end = new Date(ev.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

    const freq = ev.recurrenceFreq ?? "none";
    const durationMs = Math.max(0, end.getTime() - start.getTime());

    if (freq === "none") {
      if (start.getTime() <= winEnd && end.getTime() >= winStart) {
        out.push({
          ...ev,
          startDate: ev.startDate,
          endDate: ev.endDate,
          seriesId: ev.id,
          occurrenceKey: ev.id,
        });
      }
      continue;
    }

    const until = ev.recurrenceUntil ? new Date(ev.recurrenceUntil) : null;
    const untilMs =
      until && !isNaN(until.getTime())
        ? // Treat the until value as inclusive through the end of that day.
          new Date(until.getFullYear(), until.getMonth(), until.getDate(), 23, 59, 59, 999).getTime()
        : null;

    // Begin a couple of steps before the estimate to absorb multi-day spans and
    // month-length rounding, then walk forward.
    let n = Math.max(0, estimateStartIndex(start, freq, windowStart) - 2);
    for (let steps = 0; steps < MAX_STEPS; steps++, n++) {
      // Monotonic reference stops the walk even on skipped (null) steps; it is
      // always <= the real occurrence, so once it passes the bounds we are done.
      const refMs = referenceStep(start, freq, n).getTime();
      if (refMs > winEnd) break;
      if (untilMs !== null && refMs > untilMs) break;

      const occStart = addStep(start, freq, n);
      if (occStart === null) continue; // impossible calendar date for this period
      const occStartMs = occStart.getTime();
      if (occStartMs > winEnd) continue;
      if (untilMs !== null && occStartMs > untilMs) continue;
      const occEndMs = occStartMs + durationMs;
      if (occEndMs >= winStart) {
        out.push({
          ...ev,
          startDate: occStart.toISOString(),
          endDate: new Date(occEndMs).toISOString(),
          seriesId: ev.id,
          occurrenceKey: `${ev.id}#${n}`,
        });
      }
    }
  }

  return out;
}

const FREQ_ADVERB: Record<Exclude<RecurrenceFreq, "none">, string> = {
  daily: "daily",
  weekly: "weekly",
  monthly: "monthly",
  yearly: "yearly",
};

/**
 * Human label for a recurrence rule, e.g. "Repeats weekly until 5 Jun 2026"
 * or "Repeats monthly". Returns null for one-off events.
 */
export function recurrenceLabel(
  freq: RecurrenceFreq | null | undefined,
  until: string | null | undefined,
): string | null {
  if (!freq || freq === "none") return null;
  const adverb = FREQ_ADVERB[freq];
  if (until) {
    const d = new Date(until);
    if (!isNaN(d.getTime())) {
      return `Repeats ${adverb} until ${d.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;
    }
  }
  return `Repeats ${adverb}`;
}
