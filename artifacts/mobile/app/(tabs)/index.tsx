import { Feather } from "@expo/vector-icons";
import { useQueries } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  getListProjectMilestonesQueryOptions,
  useListEvents,
  useListProjects,
} from "@workspace/api-client-react";
import type { Milestone, ProjectWithTeamName } from "@workspace/api-client-react";
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
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingRow } from "@/components/LoadingRow";
import { useColors } from "@/hooks/useColors";
import { useMe } from "@/lib/permissions";
import { isDueToday, isOverdue } from "@/models/types";

interface Row {
  ms: Milestone;
  project: ProjectWithTeamName;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning,";
  if (h < 18) return "Good afternoon,";
  return "Good evening,";
}

export default function DashboardScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const [sheetOpen, setSheetOpen] = useState(false);

  const projectsQ = useListProjects();
  const eventsQ = useListEvents();
  const projects = projectsQ.data ?? [];

  // The server already scopes /projects per role (owner team OR shared teams),
  // so trust that list directly — re-filtering client-side hides shared projects.
  const milestoneQueries = useQueries({
    queries: projects.map((p) => getListProjectMilestonesQueryOptions(p.id)),
  });

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    projects.forEach((p, i) => {
      const ms = milestoneQueries[i]?.data ?? [];
      for (const m of ms) out.push({ ms: m, project: p });
    });
    return out;
  }, [projects, milestoneQueries]);

  const events = eventsQ.data ?? [];

  const stats = useMemo(() => {
    const total = rows.length;
    const completed = rows.filter((r) => r.ms.completed).length;
    const overdue = rows.filter((r) => isOverdue(r.ms)).length;
    const today = rows.filter((r) => isDueToday(r.ms)).length;
    return { total, completed, overdue, today };
  }, [rows]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return [...events]
      .filter((e) => new Date(e.startDate).getTime() >= now)
      .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))
      .slice(0, 3);
  }, [events]);

  const overdueItems = rows.filter((r) => isOverdue(r.ms)).slice(0, 5);
  const dueToday = rows.filter((r) => isDueToday(r.ms));

  const milestonesLoading = milestoneQueries.some((q) => q.isLoading);

  if (!me) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: 100 }]}>
        <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{greeting()}</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>{me.name}</Text>
        <Text style={[styles.role, { color: colors.primary }]}>
          {me.role.replace("_", " ").toUpperCase()}
        </Text>

        {projectsQ.isError ? (
          <ErrorBanner error={projectsQ.error} onRetry={() => projectsQ.refetch()} />
        ) : null}

        <View style={styles.tiles}>
          <Tile
            label="Total"
            value={stats.total}
            color={colors.primary}
            icon="flag"
            onPress={() => router.push({ pathname: "/milestones", params: { filter: "all" } })}
          />
          <Tile
            label="Today"
            value={stats.today}
            color="#F59E0B"
            icon="clock"
            onPress={() => router.push({ pathname: "/milestones", params: { filter: "today" } })}
          />
          <Tile
            label="Overdue"
            value={stats.overdue}
            color="#DC2626"
            icon="alert-triangle"
            onPress={() => router.push({ pathname: "/milestones", params: { filter: "overdue" } })}
          />
          <Tile
            label="Done"
            value={stats.completed}
            color="#059669"
            icon="check-circle"
            onPress={() => router.push({ pathname: "/milestones", params: { filter: "completed" } })}
          />
        </View>

        {projectsQ.isLoading || milestonesLoading ? <LoadingRow /> : null}

        {overdueItems.length > 0 ? (
          <Section title="Overdue">
            {overdueItems.map((x) => (
              <Row
                key={x.ms.id}
                title={x.ms.title}
                sub={`${x.project.teamName ?? "—"} · ${x.project.title}`}
                badge="Overdue"
                badgeColor="#DC2626"
                onPress={() => router.push({ pathname: "/project/[id]", params: { id: x.project.id } })}
              />
            ))}
          </Section>
        ) : null}

        {dueToday.length > 0 ? (
          <Section title="Due Today">
            {dueToday.map((x) => (
              <Row
                key={x.ms.id}
                title={x.ms.title}
                sub={`${x.project.teamName ?? "—"} · ${x.project.title}`}
                badge="Today"
                badgeColor="#F59E0B"
                onPress={() => router.push({ pathname: "/project/[id]", params: { id: x.project.id } })}
              />
            ))}
          </Section>
        ) : null}

        <Section title="Upcoming Events">
          {eventsQ.isLoading ? (
            <LoadingRow inline />
          ) : upcomingEvents.length === 0 ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>No upcoming events.</Text>
          ) : (
            upcomingEvents.map((ev) => {
              const d = new Date(ev.startDate);
              return (
                <Row
                  key={ev.id}
                  title={ev.title}
                  sub={`${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · ${
                    ev.isAllDay ? "All day" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  }`}
                  badge="Event"
                  badgeColor={colors.primary}
                  onPress={() => router.push({ pathname: "/event/[id]", params: { id: ev.id } })}
                />
              );
            })
          )}
        </Section>
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + 90 }]}
        onPress={() => setSheetOpen(true)}
        activeOpacity={0.85}
        accessibilityLabel="Create"
      >
        <Feather name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      <CreateActionSheet visible={sheetOpen} role={me.role} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

function Tile({
  label, value, color, icon, onPress,
}: { label: string; value: number; color: string; icon: string; onPress?: () => void }) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}
      activeOpacity={0.8}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.tileIcon, { backgroundColor: color + "22" }]}>
        <Feather name={icon as never} size={14} color={color} />
      </View>
      <Text style={[styles.tileVal, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.tileLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </TouchableOpacity>
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
  title, sub, badge, badgeColor, onPress,
}: { title: string; sub: string; badge?: string; badgeColor?: string; onPress?: () => void }) {
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
  sectionTitle: {
    fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 8,
    textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.85,
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderWidth: 1, borderRadius: 10, marginBottom: 6,
  },
  rowTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  rowSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  empty: { fontSize: 13, fontFamily: "Inter_400Regular", paddingVertical: 8, textAlign: "center" },
  fab: {
    position: "absolute", right: 20, width: 56, height: 56, borderRadius: 28,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
