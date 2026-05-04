import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EventCard } from "@/components/EventCard";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function CalendarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { events } = useData();

  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarCells = useMemo(() => {
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [firstDay, daysInMonth]);

  const eventDots = useMemo(() => {
    const map: Record<number, string[]> = {};
    events.forEach(ev => {
      const d = new Date(ev.startDate);
      if (d.getFullYear() === year && d.getMonth() === month) {
        if (!map[d.getDate()]) map[d.getDate()] = [];
        map[d.getDate()].push(ev.color);
      }
    });
    return map;
  }, [events, year, month]);

  const selectedEvents = useMemo(() =>
    events.filter(ev => isSameDay(new Date(ev.startDate), selectedDate))
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()),
    [events, selectedDate]
  );

  function prevMonth() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setViewDate(new Date(year, month + 1, 1));
  }

  function selectDay(day: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate(new Date(year, month, day));
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.navyDark, paddingTop: topPad + 16 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn} activeOpacity={0.7}>
            <Feather name="chevron-left" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{MONTHS[month]} {year}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn} activeOpacity={0.7}>
            <Feather name="chevron-right" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Day labels */}
        <View style={styles.dayLabels}>
          {DAYS.map(d => (
            <Text key={d} style={styles.dayLabel}>{d}</Text>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={styles.grid}>
          {calendarCells.map((day, i) => {
            if (!day) return <View key={`empty-${i}`} style={styles.cell} />;
            const date = new Date(year, month, day);
            const isToday = isSameDay(date, today);
            const isSelected = isSameDay(date, selectedDate);
            const dots = eventDots[day] ?? [];
            return (
              <TouchableOpacity
                key={day}
                style={[
                  styles.cell,
                  isSelected && { backgroundColor: colors.primary, borderRadius: 20 },
                  !isSelected && isToday && { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 20 },
                ]}
                onPress={() => selectDay(day)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dayNum,
                  isSelected && { color: "#fff" },
                  !isSelected && isToday && { color: colors.primary },
                  !isSelected && !isToday && { color: "rgba(255,255,255,0.85)" },
                ]}>
                  {day}
                </Text>
                <View style={styles.dots}>
                  {dots.slice(0, 3).map((c, di) => (
                    <View key={di} style={[styles.dot, { backgroundColor: isSelected ? "rgba(255,255,255,0.7)" : c }]} />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Events for selected day */}
      <View style={styles.eventsHeader}>
        <Text style={[styles.eventsTitle, { color: colors.foreground }]}>
          {selectedDate.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
        </Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/new-event")}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.eventsList}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: botPad }}
        showsVerticalScrollIndicator={false}
      >
        {selectedEvents.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.muted }]}>
            <Feather name="calendar" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No events on this day</Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/new-event")}
              activeOpacity={0.7}
            >
              <Text style={styles.emptyBtnText}>Add Event</Text>
            </TouchableOpacity>
          </View>
        ) : (
          selectedEvents.map(ev => <EventCard key={ev.id} event={ev} />)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  navBtn: {
    padding: 8,
  },
  monthTitle: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  dayLabels: {
    flexDirection: "row",
    marginBottom: 4,
  },
  dayLabel: {
    flex: 1,
    textAlign: "center",
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: "14.28%" as any,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  dayNum: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  dots: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
    height: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  eventsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  eventsTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  eventsList: { flex: 1 },
  empty: {
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  emptyBtn: {
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginTop: 4,
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
