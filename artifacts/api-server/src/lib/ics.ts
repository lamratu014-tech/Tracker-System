/**
 * Minimal iCalendar (RFC 5545) parser — just enough to import VEVENTs from a
 * public feed. We deliberately support a pragmatic subset:
 *
 *  - line unfolding (RFC 5545 §3.1)
 *  - VEVENT extraction with SUMMARY / DESCRIPTION / LOCATION / UID
 *  - DTSTART / DTEND in UTC ("...Z"), floating local time, or VALUE=DATE
 *    all-day form. Floating (non-Z) times are interpreted as UTC, which is
 *    a documented approximation — full VTIMEZONE handling is out of scope.
 *  - a single RRULE mapped onto our coarse recurrence model (FREQ + UNTIL,
 *    only when INTERVAL is absent or 1; anything else is treated as one-off).
 *
 * Per-occurrence overrides (RECURRENCE-ID), EXDATE, and arbitrary intervals
 * are intentionally ignored — the product model only stores FREQ + UNTIL.
 */

export type IcsRecurrenceFreq =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

export interface ParsedIcsEvent {
  uid: string;
  summary: string;
  description: string;
  location: string;
  startDate: Date;
  endDate: Date;
  isAllDay: boolean;
  recurrenceFreq: IcsRecurrenceFreq;
  recurrenceUntil: Date | null;
}

interface RawProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** Unfold folded lines: a CRLF (or LF) followed by a space or tab continues
 * the previous line. */
function unfold(text: string): string[] {
  const normalised = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalised.split("\n");
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

/** Parse one content line into name, params, and value. */
function parseLine(line: string): RawProperty | null {
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return null;
  const namePart = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);
  const segments = namePart.split(";");
  const name = segments[0]!.toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i]!;
    const eq = seg.indexOf("=");
    if (eq === -1) continue;
    params[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1);
  }
  return { name, params, value };
}

/** Unescape RFC 5545 TEXT escaping (\n, \,, \;, \\). */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/**
 * Parse a DATE or DATE-TIME value. Returns the instant plus whether it is an
 * all-day (date-only) value. Floating local times are treated as UTC.
 */
function parseIcsDate(
  value: string,
  params: Record<string, string>,
): { date: Date; isAllDay: boolean } | null {
  const v = value.trim();
  const isDateOnly = params["VALUE"] === "DATE" || /^\d{8}$/.test(v);
  if (isDateOnly) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
    if (!m) return null;
    const date = new Date(
      Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0),
    );
    if (Number.isNaN(date.getTime())) return null;
    return { date, isAllDay: true };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(v);
  if (!m) return null;
  const date = new Date(
    Date.UTC(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6]),
    ),
  );
  if (Number.isNaN(date.getTime())) return null;
  return { date, isAllDay: false };
}

/** Map an RRULE value onto our coarse FREQ + UNTIL model. Returns "none" for
 * anything we can't faithfully represent (e.g. INTERVAL > 1). */
function parseRRule(value: string): {
  freq: IcsRecurrenceFreq;
  until: Date | null;
} {
  const parts: Record<string, string> = {};
  for (const seg of value.split(";")) {
    const eq = seg.indexOf("=");
    if (eq === -1) continue;
    parts[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1);
  }
  const interval = parts["INTERVAL"] ? Number(parts["INTERVAL"]) : 1;
  if (Number.isNaN(interval) || interval !== 1) {
    return { freq: "none", until: null };
  }
  let freq: IcsRecurrenceFreq;
  switch ((parts["FREQ"] ?? "").toUpperCase()) {
    case "DAILY":
      freq = "daily";
      break;
    case "WEEKLY":
      freq = "weekly";
      break;
    case "MONTHLY":
      freq = "monthly";
      break;
    case "YEARLY":
      freq = "yearly";
      break;
    default:
      return { freq: "none", until: null };
  }
  let until: Date | null = null;
  if (parts["UNTIL"]) {
    const parsed = parseIcsDate(parts["UNTIL"], {});
    if (parsed) until = parsed.date;
  }
  return { freq, until };
}

/**
 * Parse the full text of an .ics feed into a list of events. Events missing a
 * UID or a parseable DTSTART are skipped. When DTEND is absent it defaults to
 * DTSTART (or +1 day for all-day events).
 */
export function parseIcs(text: string): ParsedIcsEvent[] {
  const lines = unfold(text);
  const events: ParsedIcsEvent[] = [];

  let inEvent = false;
  let current: RawProperty[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      inEvent = true;
      current = [];
      continue;
    }
    if (trimmed === "END:VEVENT") {
      inEvent = false;
      const parsed = buildEvent(current);
      if (parsed) events.push(parsed);
      current = [];
      continue;
    }
    if (!inEvent) continue;
    const prop = parseLine(line);
    if (prop) current.push(prop);
  }

  return events;
}

function buildEvent(props: RawProperty[]): ParsedIcsEvent | null {
  const get = (name: string): RawProperty | undefined =>
    props.find((p) => p.name === name);

  const uid = get("UID")?.value.trim();
  if (!uid) return null;

  const dtstartProp = get("DTSTART");
  if (!dtstartProp) return null;
  const start = parseIcsDate(dtstartProp.value, dtstartProp.params);
  if (!start) return null;

  const dtendProp = get("DTEND");
  let end: Date;
  if (dtendProp) {
    const parsedEnd = parseIcsDate(dtendProp.value, dtendProp.params);
    end = parsedEnd ? parsedEnd.date : start.date;
  } else if (start.isAllDay) {
    end = new Date(start.date.getTime() + 24 * 60 * 60 * 1000);
  } else {
    end = start.date;
  }

  const rruleProp = get("RRULE");
  const recurrence = rruleProp
    ? parseRRule(rruleProp.value)
    : { freq: "none" as IcsRecurrenceFreq, until: null };

  return {
    uid,
    summary: unescapeText(get("SUMMARY")?.value ?? "").trim() || "(untitled)",
    description: unescapeText(get("DESCRIPTION")?.value ?? "").trim(),
    location: unescapeText(get("LOCATION")?.value ?? "").trim(),
    startDate: start.date,
    endDate: end,
    isAllDay: start.isAllDay,
    recurrenceFreq: recurrence.freq,
    recurrenceUntil: recurrence.until,
  };
}
