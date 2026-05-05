import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useCurrentUser, useStore } from "@/store/useStore";

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

export default function CalendarScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useCurrentUser();
  const events = useStore((s) => s.events);
  const streams = useStore((s) => s.streams);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<Date>(today);

  const visibleEvents = useMemo(() => {
    if (!me) return [];
    if (me.role === "admin") return events;
    if (me.role === "stream_overseer") {
      return events.filter((e) => !e.linkedStreamId || e.linkedStreamId === me.streamId);
    }
    if (me.role === "leader") {
      return events.filter((e) => !e.linkedTeamId || e.linkedTeamId === me.teamId);
    }
    return events;
  }, [events, me]);

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of visibleEvents) {
      const d = new Date(ev.fullDateTime);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [visibleEvents]);

  const selectedEvents = useMemo(() => {
    return visibleEvents
      .filter((ev) => sameDay(new Date(ev.fullDateTime), selected))
      .sort((a, b) => +new Date(a.fullDateTime) - +new Date(b.fullDateTime));
  }, [visibleEvents, selected]);

  function nameFor(streamId: string | null, teamId: string | null): string {
    if (!streamId && !teamId) return "Programme-wide";
    for (const st of streams) {
      if (st.id === streamId && !teamId) return st.name;
      const t = st.teams.find((x) => x.id === teamId);
      if (t) return `${st.name} · ${t.name}`;
    }
    return "—";
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  }
  function goToday() {
    const t = new Date();
    setViewYear(t.getFullYear());
    setViewMonth(t.getMonth());
    setSelected(t);
  }

  if (!me) return null;
  const canCreateEvent = true;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: 100 }]}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Calendar</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {visibleEvents.length} event{visibleEvents.length !== 1 ? "s" : ""}
            </Text>
          </View>
          {canCreateEvent ? (
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/new-event")}
            >
              <Feather name="plus" size={14} color="#fff" />
              <Text style={styles.headerBtnText}>Event</Text>
            </TouchableOpacity>
          ) : null}
        </View>

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

        {selectedEvents.length === 0 ? (
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
                <Text style={[styles.timeText, { color: colors.primary }]}>{ev.time}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.evTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {ev.title}
                </Text>
                <Text style={[styles.evMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {nameFor(ev.linkedStreamId, ev.linkedTeamId)}
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
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
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
