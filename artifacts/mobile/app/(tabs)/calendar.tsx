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
import { canManageEverything, useCurrentUser, useStore } from "@/store/useStore";

export default function CalendarScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useCurrentUser();
  const events = useStore((s) => s.events);
  const streams = useStore((s) => s.streams);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");

  const isAdmin = canManageEverything(me);
  const isLeader = me?.role === "leader";
  const canCreateEvent = isAdmin || isLeader;

  const sorted = useMemo(() => {
    const now = Date.now();
    let list = [...events].sort((a, b) => +new Date(a.fullDateTime) - +new Date(b.fullDateTime));
    if (filter === "upcoming") list = list.filter((e) => +new Date(e.fullDateTime) >= now);
    else if (filter === "past") list = list.filter((e) => +new Date(e.fullDateTime) < now).reverse();
    return list;
  }, [events, filter]);

  function nameFor(streamId: string | null, teamId: string | null): string {
    if (!streamId && !teamId) return "Programme-wide";
    for (const st of streams) {
      if (st.id === streamId && !teamId) return st.name;
      const t = st.teams.find((x) => x.id === teamId);
      if (t) return `${st.name} · ${t.name}`;
    }
    return "—";
  }

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

        <View style={styles.tabs}>
          {(["upcoming", "past", "all"] as const).map((k) => (
            <TouchableOpacity
              key={k}
              style={[
                styles.tab,
                { backgroundColor: filter === k ? colors.primary : colors.muted },
              ]}
              onPress={() => setFilter(k)}
            >
              <Text style={[styles.tabText, { color: filter === k ? "#fff" : colors.mutedForeground }]}>
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {sorted.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.muted }]}>
            <Feather name="calendar" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No events.
            </Text>
          </View>
        ) : (
          sorted.map((ev) => {
            const dt = new Date(ev.fullDateTime);
            const dateStr = dt.toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            return (
              <TouchableOpacity
                key={ev.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: "/event/[id]", params: { id: ev.id } })}
                activeOpacity={0.8}
              >
                <View style={[styles.dateBox, { backgroundColor: colors.primary + "15" }]}>
                  <Text style={[styles.dateBoxDay, { color: colors.primary }]}>{dt.getDate()}</Text>
                  <Text style={[styles.dateBoxMo, { color: colors.primary }]}>
                    {dt.toLocaleDateString([], { month: "short" })}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{ev.title}</Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {dateStr} · {ev.time}
                  </Text>
                  <Text style={[styles.cardMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                    <Feather name="link" size={10} /> {nameFor(ev.linkedStreamId, ev.linkedTeamId)}
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
  scroll: { padding: 20 },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  headerBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  tabs: { flexDirection: "row", gap: 6, marginBottom: 12 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  tabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  empty: { padding: 32, alignItems: "center", borderRadius: 12, gap: 8 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
  },
  dateBox: { width: 48, height: 48, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  dateBoxDay: { fontSize: 18, fontFamily: "Inter_700Bold" },
  dateBoxMo: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  cardMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});
