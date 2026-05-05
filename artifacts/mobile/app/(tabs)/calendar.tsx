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

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

function timeOf(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

  const eventsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of events) {
      const d = new Date(ev.startDate);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [events]);

  const selectedEvents = useMemo(() => {
    return events
      .filter((ev) => {
        const d = new Date(ev.startDate);
        return !isNaN(d.getTime()) && sameDay(d, selected);
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
            const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
            const count = eventsByDay.get(key) ?? 0;
            const isToday = sameDay(day, today);
            const isSelected = sameDay(day, selected);
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
                {count > 0 ? (
                  <View style={[styles.dot, { backgroundColor: isSelected ? "#fff" : colors.primary }]} />
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
          selectedEvents.map((ev) => (
            <TouchableOpacity
              key={ev.id}
              style={[styles.evCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: "/event/[id]", params: { id: ev.id } })}
              activeOpacity={0.8}
            >
              <View style={[styles.timeBox, { backgroundColor: colors.primary + "15" }]}>
                <Text style={[styles.timeText, { color: colors.primary }]}>
                  {ev.isAllDay ? "All day" : timeOf(ev.startDate)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.evTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {ev.title}
                </Text>
                <Text style={[styles.evMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {nameFor(ev)}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))
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
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
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
  timeBox: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  timeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  evTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  evMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});
