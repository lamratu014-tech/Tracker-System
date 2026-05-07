import { Feather } from "@expo/vector-icons";
import { useQueries } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  getListProjectMilestonesQueryOptions,
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

import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingRow } from "@/components/LoadingRow";
import { useColors } from "@/hooks/useColors";
import { isDueToday, isOverdue } from "@/models/types";

type FilterKey = "all" | "today" | "upcoming" | "overdue" | "completed";

const FILTERS: { key: FilterKey; label: string; headerTitle: string }[] = [
  { key: "all", label: "All", headerTitle: "All Milestones" },
  { key: "today", label: "Today", headerTitle: "Due Today" },
  { key: "upcoming", label: "Upcoming", headerTitle: "Upcoming Milestones" },
  { key: "overdue", label: "Overdue", headerTitle: "Overdue Milestones" },
  { key: "completed", label: "Completed", headerTitle: "Completed Milestones" },
];

interface Row {
  ms: Milestone;
  project: ProjectWithTeamName;
}

function applyFilter(rows: Row[], key: FilterKey): Row[] {
  switch (key) {
    case "all": return rows;
    case "today": return rows.filter((r) => isDueToday(r.ms));
    case "upcoming": return rows.filter((r) => !r.ms.completed && !isOverdue(r.ms));
    case "overdue": return rows.filter((r) => isOverdue(r.ms));
    case "completed": return rows.filter((r) => r.ms.completed);
  }
}

function dueLabel(ms: Milestone): { text: string; color: string } {
  const due = new Date(ms.date);
  if (Number.isNaN(due.getTime())) return { text: "—", color: "#6B7280" };
  if (ms.completed) return { text: "Done", color: "#059669" };
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const days = Math.round((+startOfDue - +startOfToday) / 86_400_000);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: "#DC2626" };
  if (days === 0) return { text: "Today", color: "#F59E0B" };
  if (days === 1) return { text: "Tomorrow", color: "#F59E0B" };
  if (days <= 7) return { text: `In ${days}d`, color: "#2563EB" };
  return {
    text: due.toLocaleDateString([], { month: "short", day: "numeric" }),
    color: "#6B7280",
  };
}

function isValidFilter(s: string | undefined): s is FilterKey {
  return s === "all" || s === "today" || s === "upcoming" || s === "overdue" || s === "completed";
}

export default function MilestonesScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const initialFilter = isValidFilter(params.filter) ? params.filter : "all";
  const [filter, setFilter] = useState<FilterKey>(initialFilter);

  const projectsQ = useListProjects();
  const projects = projectsQ.data ?? [];

  const milestoneQueries = useQueries({
    queries: projects.map((p) => getListProjectMilestonesQueryOptions(p.id)),
  });

  const allRows: Row[] = useMemo(() => {
    const out: Row[] = [];
    projects.forEach((p, i) => {
      const ms = milestoneQueries[i]?.data ?? [];
      for (const m of ms) out.push({ ms: m, project: p });
    });
    return out;
  }, [projects, milestoneQueries]);

  const counts = useMemo(() => ({
    all: allRows.length,
    today: applyFilter(allRows, "today").length,
    upcoming: applyFilter(allRows, "upcoming").length,
    overdue: applyFilter(allRows, "overdue").length,
    completed: applyFilter(allRows, "completed").length,
  }), [allRows]);

  const filtered = useMemo(
    () =>
      applyFilter(allRows, filter)
        .slice()
        .sort((a, b) => +new Date(a.ms.date) - +new Date(b.ms.date)),
    [allRows, filter],
  );

  const milestonesLoading = milestoneQueries.some((q) => q.isLoading);

  const headerTitle =
    FILTERS.find((f) => f.key === filter)?.headerTitle ?? "Milestones";

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: headerTitle }} />
      {projectsQ.isError ? (
        <ErrorBanner error={projectsQ.error} onRetry={() => projectsQ.refetch()} />
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.tab,
                { borderColor: colors.border, backgroundColor: active ? colors.primary : colors.muted },
              ]}
            >
              <Text style={[styles.tabText, { color: active ? "#fff" : colors.foreground }]}>
                {f.label} · {counts[f.key]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {projectsQ.isLoading || milestonesLoading ? <LoadingRow /> : null}

      {filtered.length === 0 && !projectsQ.isLoading && !milestonesLoading ? (
        <View style={[styles.empty, { backgroundColor: colors.muted }]}>
          <Text style={{ color: colors.mutedForeground }}>Nothing in this view.</Text>
        </View>
      ) : null}

      {filtered.map(({ ms, project }) => {
        const dl = dueLabel(ms);
        return (
          <TouchableOpacity
            key={ms.id}
            style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push({ pathname: "/project/[id]", params: { id: project.id } })}
            activeOpacity={0.8}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.primary + "15" }]}>
              <Feather name={ms.completed ? "check-circle" : "flag"} size={16} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>
                {ms.title}
              </Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                {project.title} · {project.teamName ?? "—"}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: dl.color + "22" }]}>
              <Text style={[styles.badgeText, { color: dl.color }]}>{dl.text}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 8 },
  tabs: { gap: 6, paddingVertical: 4 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  tabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  empty: { padding: 16, borderRadius: 10, alignItems: "center", marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  iconBox: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  rowSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
});
