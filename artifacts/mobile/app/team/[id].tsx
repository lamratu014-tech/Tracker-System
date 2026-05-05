import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useData, type Task, type Project } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";
import { StatusBadge } from "@/components/StatusBadge";
import { TaskItem } from "@/components/TaskItem";

type WorkspaceTab = "tasks" | "projects" | "members" | "notes";

const STATUS_COLORS: Record<string, string> = {
  not_started: "#64748B",
  in_progress: "#3B82F6",
  at_risk: "#F59E0B",
  completed: "#10B981",
};

export default function TeamWorkspaceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isProgrammeLead, currentUser } = useAuth();
  const { teams, streams, projects, tasks, personnel, getPersonnelByTeam, getProjectsByTeam, getTasksByProject, updateTask, deleteTask } = useData();

  const team = teams.find((t) => t.id === id);
  const stream = streams.find((s) => s.id === team?.streamId);
  const isMyTeam = currentUser?.teamId === id;
  const canEdit = isProgrammeLead || isMyTeam;

  const teamProjects = useMemo(() => getProjectsByTeam(id!), [projects, id]);
  const teamTasks = useMemo(() => tasks.filter((t) => teamProjects.some((p) => p.id === t.projectId)), [tasks, teamProjects]);
  const teamMembers = useMemo(() => getPersonnelByTeam(id!), [personnel, id]);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("tasks");
  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  if (!team) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Team not found</Text>
      </View>
    );
  }

  const todoTasks = teamTasks.filter((t) => t.status === "todo");
  const inProgressTasks = teamTasks.filter((t) => t.status === "in_progress");
  const atRiskTasks = teamTasks.filter((t) => t.status === "at_risk");
  const doneTasks = teamTasks.filter((t) => t.status === "done");
  const overdueTasks = teamTasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done");

  function TaskSection({ label, items, color }: { label: string; items: Task[]; color: string }) {
    if (items.length === 0) return null;
    return (
      <View style={{ marginBottom: 12 }}>
        <View style={styles.taskSectionHeader}>
          <View style={[styles.taskSectionDot, { backgroundColor: color }]} />
          <Text style={[styles.taskSectionLabel, { color: colors.foreground }]}>{label}</Text>
          <Text style={[styles.taskSectionCount, { color: colors.mutedForeground }]}>{items.length}</Text>
        </View>
        {items.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onToggle={() => {
              if (!canEdit) return;
              const next = task.status === "done" ? "todo" : "done";
              updateTask(task.id, { status: next });
            }}
            onPress={() => {}}
          />
        ))}
      </View>
    );
  }

  const tabs: { id: WorkspaceTab; label: string; icon: string }[] = [
    { id: "tasks", label: "Tasks", icon: "check-square" },
    { id: "projects", label: "Projects", icon: "briefcase" },
    { id: "members", label: "Members", icon: "users" },
    { id: "notes", label: "Notes", icon: "file-text" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.navyDark }]}>
        <View style={styles.breadcrumb}>
          {stream ? (
            <Text style={styles.breadcrumbText}>{stream.name} · </Text>
          ) : null}
          <Text style={styles.breadcrumbActive}>{team.name}</Text>
        </View>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>{team.name}</Text>
            {team.functionLabel ? (
              <Text style={styles.headerSub}>{team.functionLabel}</Text>
            ) : null}
          </View>
          {canEdit && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => router.push({ pathname: "/new-project", params: { teamId: id } })}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.headerStats}>
          {[
            { label: "Tasks", value: teamTasks.length, color: "#94A3B8" },
            { label: "Active", value: inProgressTasks.length, color: "#3B82F6" },
            { label: "At Risk", value: atRiskTasks.length, color: "#F59E0B" },
            { label: "Done", value: doneTasks.length, color: "#10B981" },
          ].map((s) => (
            <View key={s.label} style={styles.statPill}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { borderBottomColor: colors.border }]}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 0 }}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && [styles.activeTab, { borderBottomColor: colors.primary }]]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Feather name={tab.icon as any} size={14} color={activeTab === tab.id ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.tabLabel, { color: activeTab === tab.id ? colors.primary : colors.mutedForeground }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: botPad }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "tasks" && (
          <>
            {overdueTasks.length > 0 && (
              <View style={[styles.overdueAlert, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }]}>
                <Feather name="alert-triangle" size={14} color="#D97706" />
                <Text style={styles.overdueText}>{overdueTasks.length} overdue task{overdueTasks.length !== 1 ? "s" : ""}</Text>
              </View>
            )}
            {teamTasks.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.muted }]}>
                <Feather name="check-square" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No tasks yet</Text>
                {canEdit && (
                  <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>Create a project to add tasks</Text>
                )}
              </View>
            ) : (
              <>
                <TaskSection label="At Risk" items={atRiskTasks} color="#F59E0B" />
                <TaskSection label="In Progress" items={inProgressTasks} color="#3B82F6" />
                <TaskSection label="To Do" items={todoTasks} color="#64748B" />
                <TaskSection label="Done" items={doneTasks} color="#10B981" />
              </>
            )}
          </>
        )}

        {activeTab === "projects" && (
          <>
            {teamProjects.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.muted }]}>
                <Feather name="briefcase" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No projects yet</Text>
              </View>
            ) : (
              teamProjects.map((project) => {
                const pTasks = getTasksByProject(project.id);
                const pDone = pTasks.filter((t) => t.status === "done").length;
                const progress = pTasks.length > 0 ? pDone / pTasks.length : 0;
                return (
                  <TouchableOpacity
                    key={project.id}
                    style={[styles.projectRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => router.push({ pathname: "/project/[id]", params: { id: project.id } })}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.projectDot, { backgroundColor: project.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.projectName, { color: colors.foreground }]}>{project.title}</Text>
                      <View style={styles.projectMeta}>
                        <StatusBadge status={project.status} small />
                        {project.phase ? <Text style={[styles.projectPhase, { color: colors.mutedForeground }]}>{project.phase}</Text> : null}
                      </View>
                      <View style={[styles.miniProgress, { backgroundColor: colors.muted }]}>
                        <View style={[styles.miniProgressFill, { width: `${progress * 100}%` as any, backgroundColor: project.color }]} />
                      </View>
                    </View>
                    <View style={styles.projectRight}>
                      <Text style={[styles.taskCountText, { color: colors.mutedForeground }]}>{pDone}/{pTasks.length}</Text>
                      <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}

        {activeTab === "members" && (
          <>
            {canEdit && (
              <TouchableOpacity
                style={[styles.addMemberBtn, { backgroundColor: colors.primary }]}
                onPress={() => Alert.alert("Add Member", "Navigate to Personnel management in the team workspace.")}
              >
                <Feather name="user-plus" size={14} color="#fff" />
                <Text style={styles.addMemberBtnText}>Add Member Record</Text>
              </TouchableOpacity>
            )}
            {teamMembers.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.muted }]}>
                <Feather name="user" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No member records</Text>
                <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>Members are non-user records assigned to tasks</Text>
              </View>
            ) : (
              teamMembers.map((member) => (
                <View
                  key={member.id}
                  style={[styles.memberRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={[styles.memberAvatar, { backgroundColor: colors.primary + "20" }]}>
                    <Text style={[styles.memberInitial, { color: colors.primary }]}>{member.name[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberName, { color: colors.foreground }]}>{member.name}</Text>
                    {member.roleLabel ? (
                      <Text style={[styles.memberRole, { color: colors.mutedForeground }]}>{member.roleLabel}</Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {activeTab === "notes" && (
          <View style={[styles.notesBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="file-text" size={24} color={colors.mutedForeground} style={{ alignSelf: "center", marginBottom: 8 }} />
            <Text style={[styles.notesHint, { color: colors.mutedForeground, textAlign: "center" }]}>
              Team notes are stored at the project level.{"\n"}Open a project to view or edit its notes.
            </Text>
            {teamProjects.length > 0 && (
              <View style={{ marginTop: 16, gap: 8 }}>
                {teamProjects.filter((p) => p.notes).map((project) => (
                  <TouchableOpacity
                    key={project.id}
                    style={[styles.noteProjectRow, { backgroundColor: colors.muted, borderColor: colors.border }]}
                    onPress={() => router.push({ pathname: "/project/[id]", params: { id: project.id } })}
                  >
                    <View style={[styles.projectDot, { backgroundColor: project.color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.projectName, { color: colors.foreground }]}>{project.title}</Text>
                      <Text style={[styles.notePreview, { color: colors.mutedForeground }]} numberOfLines={1}>{project.notes}</Text>
                    </View>
                    <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 16, gap: 8 },
  breadcrumb: { flexDirection: "row" },
  breadcrumbText: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "Inter_400Regular" },
  breadcrumbActive: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_500Medium" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerTitle: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerStats: { flexDirection: "row", gap: 8, marginTop: 4 },
  statPill: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 8, paddingVertical: 6, alignItems: "center" },
  statValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statLabel: { color: "rgba(255,255,255,0.45)", fontSize: 10, fontFamily: "Inter_400Regular" },
  tabBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 6, borderBottomWidth: 2, borderBottomColor: "transparent" },
  activeTab: {},
  tabLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  overdueAlert: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, borderWidth: 1, padding: 10, marginBottom: 12 },
  overdueText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#D97706" },
  taskSectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6, marginTop: 4 },
  taskSectionDot: { width: 6, height: 6, borderRadius: 3 },
  taskSectionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  taskSectionCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  projectRow: { borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  projectDot: { width: 10, height: 10, borderRadius: 5 },
  projectName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  projectMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  projectPhase: { fontSize: 11, fontFamily: "Inter_400Regular" },
  miniProgress: { height: 3, borderRadius: 2, marginTop: 6, overflow: "hidden" },
  miniProgressFill: { height: "100%", borderRadius: 2 },
  projectRight: { alignItems: "flex-end", gap: 4 },
  taskCountText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  memberInitial: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  memberName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  memberRole: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  addMemberBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, padding: 12, marginBottom: 12, justifyContent: "center" },
  addMemberBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  notesBox: { borderRadius: 14, borderWidth: 1, padding: 20, gap: 4 },
  notesHint: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  noteProjectRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 10, borderWidth: 1, padding: 12 },
  notePreview: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  empty: { borderRadius: 16, padding: 32, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  emptyHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
});
