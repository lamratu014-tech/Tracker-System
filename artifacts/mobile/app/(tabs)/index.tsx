import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EventCard } from "@/components/EventCard";
import { ProjectCard } from "@/components/ProjectCard";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  const colors = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Feather name={icon as any} size={16} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { events, projects, tasks } = useData();

  const today = new Date();
  const todayStr = today.toDateString();

  const upcomingEvents = useMemo(() =>
    events
      .filter(e => new Date(e.startDate) >= today)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 3),
    [events]
  );

  const activeProjects = useMemo(() =>
    projects.filter(p => p.status === "in_progress" || p.status === "at_risk"),
    [projects]
  );

  const atRiskCount = projects.filter(p => p.status === "at_risk").length;
  const completedCount = projects.filter(p => p.status === "completed").length;
  const pendingEvents = events.filter(e => e.status === "pending").length;
  const overdueTasks = tasks.filter(t => t.status !== "done" && new Date(t.dueDate) < today).length;

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.navyDark, paddingTop: topPad + 16 }]}>
        <View>
          <Text style={styles.greeting}>Good {getGreeting()}</Text>
          <Text style={styles.headerTitle}>Operations Hub</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.push("/new-event")}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Date pill */}
      <View style={[styles.datePill, { backgroundColor: colors.primary }]}>
        <Text style={styles.datePillText}>
          {today.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
        </Text>
      </View>

      <View style={styles.body}>
        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatCard label="Active Projects" value={activeProjects.length} color="#2563EB" icon="briefcase" />
          <StatCard label="At Risk" value={atRiskCount} color="#F59E0B" icon="alert-triangle" />
          <StatCard label="Pending Approval" value={pendingEvents} color="#7C3AED" icon="clock" />
          <StatCard label="Overdue Tasks" value={overdueTasks} color="#EF4444" icon="alert-circle" />
        </View>

        {/* Upcoming Events */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Upcoming Events</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/calendar")} activeOpacity={0.7}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
          {upcomingEvents.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.muted }]}>
              <Feather name="calendar" size={24} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No upcoming events</Text>
            </View>
          ) : (
            upcomingEvents.map(ev => <EventCard key={ev.id} event={ev} compact />)
          )}
        </View>

        {/* Active Projects */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Active Projects</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/projects")} activeOpacity={0.7}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>
          {activeProjects.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.muted }]}>
              <Feather name="briefcase" size={24} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No active projects</Text>
            </View>
          ) : (
            activeProjects.slice(0, 2).map(p => (
              <ProjectCard key={p.id} project={p} tasks={tasks.filter(t => t.projectId === p.id)} compact />
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  greeting: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 2,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  datePill: {
    marginHorizontal: 20,
    marginTop: -12,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  datePillText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  body: {
    padding: 20,
    gap: 4,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: "44%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  statValue: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  seeAll: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  empty: {
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
});
