import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddUserModal } from "@/components/AddUserModal";
import { EventCard } from "@/components/EventCard";
import { ProjectCard } from "@/components/ProjectCard";
import { TaskItem } from "@/components/TaskItem";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

type DashFocus = "calendar" | "project";

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Feather name={icon as any} size={16} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function WeekMiniCalendar() {
  const colors = useColors();
  const { events } = useData();
  const router = useRouter();
  const today = new Date();

  const days = useMemo(() => {
    const result = [];
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      result.push(d);
    }
    return result;
  }, []);

  function hasEvents(date: Date): boolean {
    return events.some((e) => {
      const s = new Date(e.startDate);
      return (
        s.getFullYear() === date.getFullYear() &&
        s.getMonth() === date.getMonth() &&
        s.getDate() === date.getDate()
      );
    });
  }

  function isToday(date: Date): boolean {
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <TouchableOpacity
      style={[styles.weekCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push("/(tabs)/calendar")}
      activeOpacity={0.8}
    >
      <View style={styles.weekHeader}>
        <Text style={[styles.widgetTitle, { color: colors.foreground }]}>This Week</Text>
        <Text style={[styles.weekMonth, { color: colors.mutedForeground }]}>
          {today.toLocaleDateString([], { month: "long", year: "numeric" })}
        </Text>
      </View>
      <View style={styles.weekRow}>
        {days.map((d, i) => {
          const isT = isToday(d);
          const hasEv = hasEvents(d);
          return (
            <View key={i} style={styles.weekDay}>
              <Text style={[styles.weekDayLabel, { color: colors.mutedForeground }]}>
                {DAY_LABELS[i]}
              </Text>
              <View
                style={[
                  styles.weekDayNum,
                  isT && { backgroundColor: colors.primary },
                ]}
              >
                <Text
                  style={[
                    styles.weekDayText,
                    { color: isT ? "#fff" : colors.foreground },
                  ]}
                >
                  {d.getDate()}
                </Text>
              </View>
              <View
                style={[
                  styles.weekDot,
                  { backgroundColor: hasEv ? colors.primary : "transparent" },
                ]}
              />
            </View>
          );
        })}
      </View>
    </TouchableOpacity>
  );
}

function ActivityFeed() {
  const colors = useColors();
  const { activityLogs } = useData();
  const recent = useMemo(() => activityLogs.slice(0, 5), [activityLogs]);

  const ACTION_ICON: Record<string, { icon: string; color: string }> = {
    create: { icon: "plus-circle", color: "#059669" },
    update: { icon: "edit-2", color: "#2563EB" },
    delete: { icon: "trash-2", color: "#EF4444" },
  };

  if (recent.length === 0) {
    return (
      <View style={[styles.widgetCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.widgetTitle, { color: colors.foreground }]}>Activity Feed</Text>
        <View style={styles.feedEmpty}>
          <Text style={[styles.feedEmptyText, { color: colors.mutedForeground }]}>No recent activity</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.widgetCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.widgetTitle, { color: colors.foreground }]}>Activity Feed</Text>
      {recent.map((entry) => {
        const si = ACTION_ICON[entry.actionType] ?? { icon: "activity", color: "#6B7280" };
        return (
          <View key={entry.id} style={[styles.feedRow, { borderBottomColor: colors.border }]}>
            <View style={[styles.feedIconWrap, { backgroundColor: si.color + "15" }]}>
              <Feather name={si.icon as any} size={12} color={si.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.feedSummary, { color: colors.foreground }]} numberOfLines={1}>
                {entry.entityTitle ?? entry.entityType}
              </Text>
              <Text style={[styles.feedMeta, { color: colors.mutedForeground }]}>
                {entry.userName ?? "System"} · {entry.actionType} ·{" "}
                {new Date(entry.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUser, isProgrammeLead, users } = useAuth();
  const [showAddUser, setShowAddUser] = useState(false);
  if (!currentUser) return null;
  const { events, projects, tasks, milestones, updateTask } = useData();
  const showTeamCta = isProgrammeLead && users.length < 3;

  function handleTaskToggle(task: { id: string; status: string }) {
    updateTask(task.id, { status: task.status });
  }

  const [focus, setFocus] = useState<DashFocus>("project");

  const today = new Date();

  const upcomingEvents = useMemo(
    () =>
      events
        .filter((e) => new Date(e.startDate) >= today)
        .sort(
          (a, b) =>
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        )
        .slice(0, focus === "calendar" ? 5 : 3),
    [events, focus]
  );

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === "in_progress" || p.status === "at_risk"),
    [projects]
  );

  const tasksDueSoon = useMemo(
    () =>
      tasks
        .filter((t) => {
          if (t.status === "done" || !t.dueDate) return false;
          const due = new Date(t.dueDate);
          const diff = (due.getTime() - today.getTime()) / 86400000;
          return diff <= 7;
        })
        .sort(
          (a, b) =>
            new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
        )
        .slice(0, 5),
    [tasks]
  );

  const upcomingMilestones = useMemo(
    () =>
      milestones
        .filter((m) => !m.completed && new Date(m.date) >= today)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 3),
    [milestones]
  );

  const atRiskCount = projects.filter((p) => p.status === "at_risk").length;
  const pendingEvents = events.filter((e) => e.status === "pending").length;
  const overdueTasks = tasks.filter(
    (t) => t.status !== "done" && !!t.dueDate && new Date(t.dueDate) < today
  ).length;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: botPad }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.navyDark, paddingTop: topPad + 16 },
        ]}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>
              {getGreeting()}, {currentUser.name.split(" ")[0]}
            </Text>
            <Text style={styles.headerTitle}>Operations Hub</Text>
          </View>
          <View style={styles.headerRight}>
            {isProgrammeLead && (
              <>
                <TouchableOpacity
                  style={styles.addUserBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowAddUser(true);
                  }}
                  activeOpacity={0.85}
                >
                  <Feather name="user-plus" size={14} color="#fff" />
                  <Text style={styles.addUserBtnText}>Add User</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.adminLink}
                  onPress={() => router.push("/admin")}
                  activeOpacity={0.7}
                  hitSlop={8}
                >
                  <Feather name="shield" size={14} color="rgba(255,255,255,0.75)" />
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => router.push("/new-event")}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Focus toggle */}
        <View style={styles.focusToggle}>
          {(["project", "calendar"] as DashFocus[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.focusBtn,
                focus === f && { backgroundColor: colors.primary },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setFocus(f);
              }}
              activeOpacity={0.7}
            >
              <Feather
                name={f === "project" ? "briefcase" : "calendar"}
                size={13}
                color={focus === f ? "#fff" : "rgba(255,255,255,0.6)"}
              />
              <Text
                style={[
                  styles.focusBtnText,
                  { color: focus === f ? "#fff" : "rgba(255,255,255,0.6)" },
                ]}
              >
                {f === "project" ? "Project Focus" : "Calendar Focus"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Date strip */}
      <View style={[styles.dateStrip, { backgroundColor: colors.primary }]}>
        <Text style={styles.dateStripText}>
          {today.toLocaleDateString([], {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </Text>
      </View>

      <View style={styles.body}>
        {/* Programme Lead empty-state CTA: build your team */}
        {showTeamCta && (
          <TouchableOpacity
            style={[styles.teamCta, { backgroundColor: "#EDE9FE", borderColor: "#C4B5FD" }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowAddUser(true);
            }}
            activeOpacity={0.85}
          >
            <View style={[styles.teamCtaIcon, { backgroundColor: "#7C3AED" }]}>
              <Feather name="user-plus" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.teamCtaTitle}>Build your team</Text>
              <Text style={styles.teamCtaSub}>
                You have {users.length} user{users.length !== 1 ? "s" : ""}. Add your team leads now — set their password directly or send an invite link.
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#7C3AED" />
          </TouchableOpacity>
        )}

        {/* Stats row */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Active Projects"
            value={activeProjects.length}
            color="#2563EB"
            icon="briefcase"
          />
          <StatCard
            label="At Risk"
            value={atRiskCount}
            color="#F59E0B"
            icon="alert-triangle"
          />
          <StatCard
            label="Pending"
            value={pendingEvents}
            color="#7C3AED"
            icon="clock"
          />
          <StatCard
            label="Overdue"
            value={overdueTasks}
            color="#EF4444"
            icon="alert-circle"
          />
        </View>

        {/* ── Calendar Focus ── */}
        {focus === "calendar" && (
          <>
            {/* Weekly mini calendar */}
            <WeekMiniCalendar />

            {/* Upcoming Events */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Upcoming Events
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/calendar")}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.seeAll, { color: colors.primary }]}>
                    See all
                  </Text>
                </TouchableOpacity>
              </View>
              {upcomingEvents.length === 0 ? (
                <EmptyState icon="calendar" text="No upcoming events" />
              ) : (
                upcomingEvents.map((ev) => <EventCard key={ev.id} event={ev} />)
              )}
            </View>

            {/* Tasks due soon */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Tasks Due This Week
                </Text>
              </View>
              {tasksDueSoon.length === 0 ? (
                <EmptyState icon="check-square" text="No tasks due this week" />
              ) : (
                <View style={[styles.taskBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {tasksDueSoon.map((t) => (
                    <TaskItem key={t.id} task={t} onToggle={handleTaskToggle} />
                  ))}
                </View>
              )}
            </View>

            {/* Activity feed */}
            <ActivityFeed />
          </>
        )}

        {/* ── Project Focus ── */}
        {focus === "project" && (
          <>
            {/* Active Projects */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Active Projects
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/projects")}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.seeAll, { color: colors.primary }]}>
                    See all
                  </Text>
                </TouchableOpacity>
              </View>
              {activeProjects.length === 0 ? (
                <EmptyState icon="briefcase" text="No active projects" />
              ) : (
                activeProjects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    tasks={tasks.filter((t) => t.projectId === p.id)}
                  />
                ))
              )}
            </View>

            {/* Upcoming Milestones */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Upcoming Milestones
                </Text>
              </View>
              {upcomingMilestones.length === 0 ? (
                <EmptyState icon="flag" text="No upcoming milestones" />
              ) : (
                <View style={[styles.taskBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {upcomingMilestones.map((m) => {
                    const project = projects.find((p) => p.id === m.projectId);
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.milestoneRow, { borderBottomColor: colors.border }]}
                        onPress={() =>
                          router.push({
                            pathname: "/project/[id]",
                            params: { id: m.projectId },
                          })
                        }
                        activeOpacity={0.7}
                      >
                        <Feather name="flag" size={14} color={project?.color ?? colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.milestoneTitle, { color: colors.foreground }]}>
                            {m.title}
                          </Text>
                          <Text style={[styles.milestoneMeta, { color: colors.mutedForeground }]}>
                            {project?.title} ·{" "}
                            {new Date(m.date).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}
                          </Text>
                        </View>
                        <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Tasks due soon */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Tasks Due Soon
                </Text>
              </View>
              {tasksDueSoon.length === 0 ? (
                <EmptyState icon="check-square" text="No tasks due this week" />
              ) : (
                <View style={[styles.taskBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {tasksDueSoon.map((t) => (
                    <TaskItem key={t.id} task={t} onToggle={handleTaskToggle} />
                  ))}
                </View>
              )}
            </View>

            {/* Upcoming Events (compact) */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Upcoming Events
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/calendar")}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.seeAll, { color: colors.primary }]}>
                    See all
                  </Text>
                </TouchableOpacity>
              </View>
              {upcomingEvents.length === 0 ? (
                <EmptyState icon="calendar" text="No upcoming events" />
              ) : (
                upcomingEvents.map((ev) => (
                  <EventCard key={ev.id} event={ev} compact />
                ))
              )}
            </View>

            {/* Activity feed */}
            <ActivityFeed />
          </>
        )}
      </View>

      {isProgrammeLead && (
        <AddUserModal
          visible={showAddUser}
          onClose={() => setShowAddUser(false)}
        />
      )}
    </ScrollView>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  const colors = useColors();
  return (
    <View style={[styles.empty, { backgroundColor: colors.muted }]}>
      <Feather name={icon as any} size={22} color={colors.mutedForeground} />
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{text}</Text>
    </View>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  greeting: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 2,
  },
  headerTitle: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold" },
  addUserBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#7C3AED",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: "#7C3AED",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  addUserBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  adminLink: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  teamCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 16,
  },
  teamCtaIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  teamCtaTitle: {
    color: "#5B21B6",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  teamCtaSub: {
    color: "#6D28D9",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    lineHeight: 16,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  focusToggle: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  focusBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  focusBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  dateStrip: {
    marginHorizontal: 20,
    marginTop: -10,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignSelf: "flex-start",
  },
  dateStripText: { color: "#fff", fontSize: 12, fontFamily: "Inter_500Medium" },
  body: { padding: 20, gap: 4 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 5,
    width: "47%",
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },

  weekCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 20 },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  weekMonth: { fontSize: 12, fontFamily: "Inter_400Regular" },
  weekRow: { flexDirection: "row", justifyContent: "space-between" },
  weekDay: { alignItems: "center", gap: 4, flex: 1 },
  weekDayLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  weekDayNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  weekDayText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  weekDot: { width: 4, height: 4, borderRadius: 2 },

  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  seeAll: { fontSize: 13, fontFamily: "Inter_500Medium" },
  taskBox: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  milestoneTitle: { fontSize: 13, fontFamily: "Inter_500Medium" },
  milestoneMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  empty: { borderRadius: 10, padding: 20, alignItems: "center", gap: 6 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  widgetCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 20 },
  widgetTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 10 },
  feedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  feedIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  feedSummary: { fontSize: 12, fontFamily: "Inter_500Medium" },
  feedMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  feedEmpty: { paddingVertical: 12, alignItems: "center" },
  feedEmptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
