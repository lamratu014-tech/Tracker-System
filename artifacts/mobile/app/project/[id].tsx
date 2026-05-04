import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBadge } from "@/components/StatusBadge";
import { TaskItem } from "@/components/TaskItem";
import type { Project, Task } from "@/context/DataContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

type TabType = "overview" | "tasks" | "milestones" | "events";

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { projects, tasks, milestones, events, updateProject, deleteProject, updateTask, addTask, updateMilestone } = useData();

  const project = projects.find(p => p.id === id);
  const [tab, setTab] = useState<TabType>("overview");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Project | null>(project ?? null);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const projectTasks = useMemo(() => tasks.filter(t => t.projectId === id), [tasks, id]);
  const projectMilestones = useMemo(() => milestones.filter(m => m.projectId === id), [milestones, id]);
  const projectEvents = useMemo(() => events.filter(e => e.projectId === id), [events, id]);

  if (!project || !draft) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Project not found.</Text>
      </View>
    );
  }

  const total = projectTasks.length;
  const done = projectTasks.filter(t => t.status === "done").length;
  const progress = total > 0 ? done / total : 0;

  function save() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateProject(draft!);
    setEditing(false);
  }

  function handleDelete() {
    Alert.alert("Delete Project", "Delete this project and all its tasks?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteProject(project.id);
          router.back();
        }
      },
    ]);
  }

  function addQuickTask() {
    if (!newTaskTitle.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addTask({
      projectId: id,
      title: newTaskTitle.trim(),
      description: "",
      status: "todo",
      assignee: "",
      dueDate: new Date().toISOString(),
      priority: "medium",
    });
    setNewTaskTitle("");
  }

  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  const TABS: { key: TabType; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "tasks", label: "Tasks", count: projectTasks.length },
    { key: "milestones", label: "Milestones", count: projectMilestones.length },
    { key: "events", label: "Events", count: projectEvents.length },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.navyDark }]}>
        <View style={[styles.projectDot, { backgroundColor: draft.color }]} />
        {editing ? (
          <TextInput
            style={[styles.titleInput]}
            value={draft.title}
            onChangeText={t => setDraft({ ...draft, title: t })}
            autoFocus
          />
        ) : (
          <Text style={styles.headerTitle} numberOfLines={1}>{draft.title}</Text>
        )}
        <View style={styles.headerActions}>
          {editing ? (
            <>
              <TouchableOpacity style={styles.headerBtn} onPress={() => { setDraft(project); setEditing(false); }} activeOpacity={0.7}>
                <Feather name="x" size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.headerBtn, { backgroundColor: colors.primary }]} onPress={save} activeOpacity={0.7}>
                <Feather name="check" size={18} color="#fff" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.headerBtn} onPress={() => setEditing(true)} activeOpacity={0.7}>
                <Feather name="edit-2" size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerBtn} onPress={handleDelete} activeOpacity={0.7}>
                <Feather name="trash-2" size={18} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressSection, { backgroundColor: colors.navyMid }]}>
        <View style={styles.progressMeta}>
          <StatusBadge status={draft.status} small />
          <Text style={styles.progressFraction}>{done}/{total} tasks</Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: draft.color }]} />
        </View>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 4 }}
      >
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, { color: tab === t.key ? colors.primary : colors.mutedForeground }]}>
              {t.label}{t.count !== undefined ? ` (${t.count})` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: botPad }}
        showsVerticalScrollIndicator={false}
      >
        {tab === "overview" && (
          <View style={styles.tabContent}>
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <InfoRow label="Phase" value={draft.phase} />
              <InfoRow label="Owner" value={draft.owner} />
              <InfoRow label="Due Date" value={new Date(draft.dueDate).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })} />
              <InfoRow label="Tags" value={draft.tags.join(", ") || "—"} />
            </View>
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Description</Text>
              {editing ? (
                <TextInput
                  style={[styles.textarea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                  value={draft.description}
                  onChangeText={t => setDraft({ ...draft, description: t })}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor={colors.mutedForeground}
                  placeholder="Add a description..."
                />
              ) : (
                <Text style={[styles.bodyText, { color: draft.description ? colors.foreground : colors.mutedForeground }]}>
                  {draft.description || "No description"}
                </Text>
              )}
            </View>
          </View>
        )}

        {tab === "tasks" && (
          <View>
            {/* Quick add */}
            <View style={[styles.quickAdd, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.quickInput, { color: colors.foreground }]}
                value={newTaskTitle}
                onChangeText={setNewTaskTitle}
                placeholder="Add a task..."
                placeholderTextColor={colors.mutedForeground}
                onSubmitEditing={addQuickTask}
                returnKeyType="done"
              />
              <TouchableOpacity onPress={addQuickTask} style={[styles.quickBtn, { backgroundColor: colors.primary }]} activeOpacity={0.7}>
                <Feather name="plus" size={16} color="#fff" />
              </TouchableOpacity>
            </View>

            {projectTasks.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.muted }]}>
                <Feather name="check-square" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No tasks yet</Text>
              </View>
            ) : (
              <View style={[styles.taskList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {projectTasks.map(t => (
                  <TaskItem key={t.id} task={t} onToggle={updateTask} />
                ))}
              </View>
            )}
          </View>
        )}

        {tab === "milestones" && (
          <View>
            {projectMilestones.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.muted }]}>
                <Feather name="flag" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No milestones yet</Text>
              </View>
            ) : (
              <View style={[styles.taskList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {projectMilestones.map(m => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.milestoneRow, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      updateMilestone({ ...m, completed: !m.completed });
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.milestoneCheck, { borderColor: m.completed ? colors.success : colors.border, backgroundColor: m.completed ? colors.success : "transparent" }]}>
                      {m.completed && <Feather name="check" size={12} color="#fff" />}
                    </View>
                    <View style={styles.milestoneInfo}>
                      <Text style={[styles.milestoneTitle, { color: colors.foreground, textDecorationLine: m.completed ? "line-through" : "none", opacity: m.completed ? 0.5 : 1 }]}>
                        {m.title}
                      </Text>
                      <Text style={[styles.milestoneDate, { color: colors.mutedForeground }]}>
                        {new Date(m.date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                      </Text>
                    </View>
                    <Feather name="flag" size={14} color={m.completed ? colors.success : colors.mutedForeground} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {tab === "events" && (
          <View>
            {projectEvents.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.muted }]}>
                <Feather name="calendar" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No linked events</Text>
              </View>
            ) : (
              projectEvents.map(ev => (
                <TouchableOpacity
                  key={ev.id}
                  style={[styles.eventRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push({ pathname: "/event/[id]", params: { id: ev.id } })}
                  activeOpacity={0.7}
                >
                  <View style={[styles.eventDot, { backgroundColor: ev.color }]} />
                  <View style={styles.eventInfo}>
                    <Text style={[styles.eventTitle, { color: colors.foreground }]}>{ev.title}</Text>
                    <Text style={[styles.eventDate, { color: colors.mutedForeground }]}>
                      {new Date(ev.startDate).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                      {!ev.isAllDay && ` · ${new Date(ev.startDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                    </Text>
                  </View>
                  <StatusBadge status={ev.status} small />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={infoStyles.row}>
      <Text style={[infoStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[infoStyles.value, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}
const infoStyles = StyleSheet.create({
  row: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E2E8F0" },
  label: { width: 90, fontSize: 13, fontFamily: "Inter_500Medium" },
  value: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  projectDot: { width: 10, height: 10, borderRadius: 5 },
  headerTitle: { flex: 1, color: "#fff", fontSize: 18, fontFamily: "Inter_600SemiBold" },
  titleInput: { flex: 1, color: "#fff", fontSize: 18, fontFamily: "Inter_600SemiBold", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.3)" },
  headerActions: { flexDirection: "row", gap: 6 },
  headerBtn: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" },
  progressSection: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  progressMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressFraction: { color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "Inter_400Regular" },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  tabBar: { borderBottomWidth: StyleSheet.hairlineWidth, maxHeight: 44 },
  tab: { paddingHorizontal: 12, paddingVertical: 12 },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  tabContent: { gap: 16 },
  infoCard: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  fieldBlock: { gap: 6 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  bodyText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  textarea: { borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 80, textAlignVertical: "top" },
  quickAdd: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingLeft: 12, paddingRight: 6, paddingVertical: 6, marginBottom: 12, gap: 8 },
  quickInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 4 },
  quickBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  taskList: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  empty: { borderRadius: 12, padding: 32, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  milestoneRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  milestoneCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  milestoneInfo: { flex: 1 },
  milestoneTitle: { fontSize: 14, fontFamily: "Inter_500Medium" },
  milestoneDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  eventRow: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8, gap: 10 },
  eventDot: { width: 8, height: 8, borderRadius: 4 },
  eventInfo: { flex: 1 },
  eventTitle: { fontSize: 14, fontFamily: "Inter_500Medium" },
  eventDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
