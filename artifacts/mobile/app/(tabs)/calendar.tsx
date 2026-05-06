import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  useListEvents,
  useListStreams,
  useListTeams,
} from "@workspace/api-client-react";
import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingRow } from "@/components/LoadingRow";
import { useColors } from "@/hooks/useColors";
import { useMe } from "@/lib/permissions";
import { colorForStream, NEUTRAL_STREAM_COLOR } from "@/lib/streamColors";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MAX_DOTS = 3;

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const cells: (Date | null)[] = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function rangeLabel(startIso: string, endIso: string, isAllDay: boolean): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "";
  if (isAllDay) {
    if (sameDay(s, e)) return "All day";
    return `All day · until ${e.toLocaleDateString([], { month: "short", day: "numeric" })}`;
  }
  if (sameDay(s, e)) return `${timeOf(startIso)} – ${timeOf(endIso)}`;
  return `${timeOf(startIso)} → ${e.toLocaleDateString([], { month: "short", day: "numeric" })} ${timeOf(endIso)}`;
}

export default function CalendarScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useMe();

  const eventsQ = useListEvents();
  const streamsQ = useListStreams();
  const teamsQ = useListTeams();

  const events = eventsQ.data ?? [];
  const streams = streamsQ.data ?? [];
  const teams = teamsQ.data ?? [];

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<Date>(today);

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  function streamIdFor(ev: { invitedTeamIds: string[]; createdByTeamId?: string | null }): string | null {
    const teamId = ev.invitedTeamIds[0] ?? ev.createdByTeamId ?? null;
    if (!teamId) return null;
    const t = teams.find((x) => x.id === teamId);
    return t?.streamId ?? null;
  }

  // Map of dayKey -> ordered list of distinct stream ids (or null for programme-wide)
  // covering each visible day. We iterate the visible cells (≤ 42) and check
  // each event's [start..end] interval so very long events still render on
  // every day in view without forcing an unbounded per-event walk.
  const streamsByDay = useMemo(() => {
    const map = new Map<string, (string | null)[]>();
    const eventSpans = events.map((ev) => {
      const s = new Date(ev.startDate);
      const e = new Date(ev.endDate);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
      return {
        sStart: startOfDay(s).getTime(),
        sEnd: startOfDay(e).getTime(),
        sId: streamIdFor(ev),
      };
    });
    for (const cell of cells) {
      if (!cell) continue;
      const cellTs = startOfDay(cell).getTime();
      const list: (string | null)[] = [];
      for (const span of eventSpans) {
        if (!span) continue;
        if (cellTs >= span.sStart && cellTs <= span.sEnd) {
          if (!list.includes(span.sId)) list.push(span.sId);
        }
      }
      if (list.length > 0) map.set(dayKey(cell), list);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, teams, cells]);

  const selectedEvents = useMemo(() => {
    return events
      .filter((ev) => {
        const s = new Date(ev.startDate);
        const e = new Date(ev.endDate);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) return false;
        const sd = startOfDay(s).getTime();
        const ed = startOfDay(e).getTime();
        const target = startOfDay(selected).getTime();
        return target >= sd && target <= ed;
      })
      .slice()
      .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate));
  }, [events, selected]);

  function nameFor(ev: { invitedTeamIds: string[]; createdByTeamId?: string | null }): string {
    const teamId = ev.invitedTeamIds[0] ?? ev.createdByTeamId ?? null;
    if (!teamId) return "Programme-wide";
    const t = teams.find((x) => x.id === teamId);
    if (!t) return "—";
    const s = streams.find((x) => x.id === t.streamId);
    return s ? `${s.name} · ${t.name}` : t.name;
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }
  function goToday() {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
    setSelected(t);
  }

  if (!me) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: 100 }]}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Calendar</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {events.length} event{events.length !== 1 ? "s" : ""}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/new-event")}
          >
            <Feather name="plus" size={14} color="#fff" />
            <Text style={styles.headerBtnText}>Event</Text>
          </TouchableOpacity>
        </View>

        {eventsQ.isError ? (
          <ErrorBanner error={eventsQ.error} onRetry={() => eventsQ.refetch()} />
        ) : null}

        <View style={[styles.monthBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity onPress={prevMonth} hitSlop={8} style={styles.navBtn}>
            <Feather name="chevron-left" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={goToday} style={{ flex: 1, alignItems: "center" }}>
            <Text style={[styles.monthLabel, { color: colors.foreground }]}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </Text>
            <Text style={[styles.todayHint, { color: colors.primary }]}>Tap to jump to today</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={nextMonth} hitSlop={8} style={styles.navBtn}>
            <Feather name="chevron-right" size={18} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAYS.map((w, i) => (
            <Text key={i} style={[styles.weekdayText, { color: colors.mutedForeground }]}>{w}</Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((day, i) => {
            if (!day) return <View key={i} style={styles.cell} />;
            const list = streamsByDay.get(dayKey(day)) ?? [];
            const isToday = sameDay(day, today);
            const isSelected = sameDay(day, selected);
            const visible = list.slice(0, MAX_DOTS);
            const overflow = list.length - visible.length;
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.cell,
                  isSelected && { backgroundColor: colors.primary },
                  !isSelected && isToday && { borderColor: colors.primary, borderWidth: 1.5 },
                ]}
                onPress={() => setSelected(day)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.cellNum,
                    { color: isSelected ? "#fff" : colors.foreground },
                    isToday && !isSelected && { color: colors.primary, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {day.getDate()}
                </Text>
                {visible.length > 0 ? (
                  <View style={styles.dotRow}>
                    {visible.map((sId, di) => (
                      <View
                        key={`${sId ?? "none"}-${di}`}
                        style={[
                          styles.dot,
                          {
                            backgroundColor: isSelected
                              ? "#fff"
                              : colorForStream(sId),
                          },
                        ]}
                      />
                    ))}
                    {overflow > 0 ? (
                      <Text
                        style={[
                          styles.overflowDot,
                          { color: isSelected ? "#fff" : colors.mutedForeground },
                        ]}
                      >
                        +{overflow}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {selected.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </Text>

        {eventsQ.isLoading ? (
          <LoadingRow />
        ) : selectedEvents.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.muted }]}>
            <Feather name="calendar" size={24} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No events on this day.
            </Text>
          </View>
        ) : (
          selectedEvents.map((ev) => {
            const sId = streamIdFor(ev);
            const accent = sId ? colorForStream(sId) : NEUTRAL_STREAM_COLOR;
            return (
              <TouchableOpacity
                key={ev.id}
                style={[
                  styles.evCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderLeftColor: accent,
                    borderLeftWidth: 4,
                  },
                ]}
                onPress={() => router.push({ pathname: "/event/[id]", params: { id: ev.id } })}
                activeOpacity={0.8}
              >
                <View style={[styles.timeBox, { backgroundColor: accent + "15" }]}>
                  <Text style={[styles.timeText, { color: accent }]}>
                    {ev.isAllDay ? "All" : timeOf(ev.startDate)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.evTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {ev.title}
                  </Text>
                  <Text style={[styles.evMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {nameFor(ev)} · {rangeLabel(ev.startDate, ev.endDate, ev.isAllDay)}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16 },
  header: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    marginBottom: 12, paddingHorizontal: 4,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
  },
  headerBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  monthBar: {
    flexDirection: "row", alignItems: "center", padding: 10,
    borderRadius: 10, borderWidth: 1, marginBottom: 8,
  },
  navBtn: { padding: 6 },
  monthLabel: { fontSize: 16, fontFamily: "Inter_700Bold" },
  todayHint: { fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 1 },
  weekRow: { flexDirection: "row", marginTop: 8, marginBottom: 4 },
  weekdayText: {
    flex: 1, textAlign: "center", fontSize: 11,
    fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: {
    width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center",
    justifyContent: "center", borderRadius: 8,
  },
  cellNum: { fontSize: 14, fontFamily: "Inter_500Medium" },
  dotRow: {
    flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  overflowDot: {
    fontSize: 8, fontFamily: "Inter_700Bold", marginLeft: 1,
  },
  sectionTitle: {
    fontSize: 14, fontFamily: "Inter_700Bold",
    marginTop: 16, marginBottom: 8, paddingHorizontal: 4,
  },
  empty: { padding: 24, alignItems: "center", borderRadius: 10, gap: 8 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  evCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderWidth: 1, borderRadius: 10, marginBottom: 6,
  },
  timeBox: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, minWidth: 48, alignItems: "center" },
  timeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  evTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  evMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});
