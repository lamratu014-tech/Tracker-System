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

import { CreateActionSheet } from "@/components/CreateActionSheet";
import { useColors } from "@/hooks/useColors";
import { isOverdue } from "@/models/types";
import type { Milestone, Stream } from "@/models/types";
import { useCurrentUser, useStore } from "@/store/useStore";

function flattenMilestones(streams: Stream[]): Array<{ ms: Milestone; streamName: string; teamName: string; projectTitle: string; teamId: string }> {
  const out: Array<{ ms: Milestone; streamName: string; teamName: string; projectTitle: string; teamId: string }> = [];
  for (const s of streams) for (const t of s.teams) for (const p of t.projects) for (const m of p.milestones) {
    out.push({ ms: m, streamName: s.name, teamName: t.name, projectTitle: p.title, teamId: t.id });
  }
  return out;
}

export default function DashboardScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useCurrentUser();
  const streams = useStore((s) => s.streams);
  const events = useStore((s) => s.events);
  const [sheetOpen, setSheetOpen] = useState(false);

  const allMilestones = useMemo(() => flattenMilestones(streams), [streams]);

  const visibleMilestones = useMemo(() => {
    if (!me) return [];
    if (me.role === "admin") return allMilestones;
    if (me.role === "leader") return allMilestones; // leaders can view all
    if (me.role === "member") return me.teamId ? allMilestones.filter((x) => x.teamId === me.teamId) : [];
    return [];
  }, [allMilestones, me]);

  const stats = useMemo(() => {
    const total = visibleMilestones.length;
    const completed = visibleMilestones.filter((x) => x.ms.status === "completed").length;
    const overdue = visibleMilestones.filter((x) => isOverdue(x.ms)).length;
    const today = visibleMilestones.filter((x) => {
      const d = new Date(x.ms.deadline);
      const now = new Date();
      return d.toDateString() === now.toDateString() && x.ms.status !== "completed";
    }).length;
    return { total, completed, overdue, today };
  }, [visibleMilestones]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return [...events]
      .filter((e) => new Date(e.fullDateTime).getTime() >= now)
      .sort((a, b) => +new Date(a.fullDateTime) - +new Date(b.fullDateTime))
      .slice(0, 3);
  }, [events]);

  const overdueItems = visibleMilestones.filter((x) => isOverdue(x.ms)).slice(0, 5);
  const dueToday = visibleMilestones.filter((x) => {
    const d = new Date(x.ms.deadline);
    return d.toDateString() === new Date().toDateString() && x.ms.status !== "completed";
  });

  if (!me) return null;
  const showFab = me.role !== "member";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: 100 }]}>
        <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
          {greeting()}
        </Text>
        <Text style={[styles.title, { color: colors.foreground }]}>{me.name}</Text>
        <Text style={[styles.role, { color: colors.primary }]}>
          {me.role.toUpperCase()}
        </Text>

        {/* stat tiles */}
        <View style={styles.tiles}>
          <Tile label="Total" value={stats.total} color={colors.primary} icon="flag" />
          <Tile label="Today" value={stats.today} color="#F59E0B" icon="clock" />
          <Tile label="Overdue" value={stats.overdue} color="#DC2626" icon="alert-triangle" />
          <Tile label="Done" value={stats.completed} color="#059669" icon="check-circle" />
        </View>

        {/* overdue */}
        {overdueItems.length > 0 ? (
          <Section title="Overdue">
            {overdueItems.map((x) => (
              <Row
                key={x.ms.id}
                title={x.ms.title}
                sub={`${x.streamName} · ${x.teamName} · ${x.projectTitle}`}
                badge="Overdue"
                badgeColor="#DC2626"
                onPress={() => router.push({ pathname: "/project/[id]", params: { id: findProjectIdForMilestone(streams, x.ms.id) ?? "" } })}
              />
            ))}
          </Section>
        ) : null}

        {/* due today */}
        {dueToday.length > 0 ? (
          <Section title="Due Today">
            {dueToday.map((x) => (
              <Row
                key={x.ms.id}
                title={x.ms.title}
                sub={`${x.streamName} · ${x.teamName} · ${x.projectTitle}`}
                badge="Today"
                badgeColor="#F59E0B"
                onPress={() => router.push({ pathname: "/project/[id]", params: { id: findProjectIdForMilestone(streams, x.ms.id) ?? "" } })}
              />
            ))}
          </Section>
        ) : null}

        {/* upcoming events */}
        <Section title="Upcoming Events">
          {upcomingEvents.length === 0 ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>No upcoming events.</Text>
          ) : (
            upcomingEvents.map((ev) => (
              <Row
                key={ev.id}
                title={ev.title}
                sub={`${new Date(ev.fullDateTime).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · ${ev.time}`}
                badge="Event"
                badgeColor={colors.primary}
                onPress={() => router.push({ pathname: "/event/[id]", params: { id: ev.id } })}
              />
            ))
          )}
        </Section>
      </ScrollView>

      {showFab ? (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + 90 }]}
          onPress={() => setSheetOpen(true)}
          activeOpacity={0.85}
          accessibilityLabel="Create"
        >
          <Feather name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      ) : null}

      <CreateActionSheet visible={sheetOpen} role={me.role} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

function findProjectIdForMilestone(streams: Stream[], msId: string): string | null {
  for (const s of streams) for (const t of s.teams) for (const p of t.projects) {
    if (p.milestones.some((m) => m.id === msId)) return p.id;
  }
  return null;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning,";
  if (h < 18) return "Good afternoon,";
  return "Good evening,";
}

function Tile({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  const colors = useColors();
  return (
    <View style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.tileIcon, { backgroundColor: color + "22" }]}>
        <Feather name={icon as never} size={14} color={color} />
      </View>
      <Text style={[styles.tileVal, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.tileLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {children}
    </View>
  );
}

function Row({
  title,
  sub,
  badge,
  badgeColor,
  onPress,
}: {
  title: string;
  sub: string;
  badge?: string;
  badgeColor?: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>{sub}</Text>
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: (badgeColor ?? colors.primary) + "22" }]}>
          <Text style={[styles.badgeText, { color: badgeColor ?? colors.primary }]}>{badge}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20 },
  greeting: { fontSize: 14, fontFamily: "Inter_400Regular" },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  role: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, marginTop: 2 },
  tiles: { flexDirection: "row", gap: 8, marginTop: 18 },
  tile: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, gap: 4 },
  tileIcon: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  tileVal: { fontSize: 22, fontFamily: "Inter_700Bold" },
  tileLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.85 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 6,
  },
  rowTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  rowSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  empty: { fontSize: 13, fontFamily: "Inter_400Regular", paddingVertical: 8, textAlign: "center" },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
