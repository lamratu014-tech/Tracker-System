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
import type { ProjectStatus } from "@/context/DataContext";
import { useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

type TabType = "overview" | "tasks" | "milestones" | "events";

const STATUS_OPTIONS: { label: string; value: ProjectStatus }[] = [
  { label: "Not Started", value: "not_started" },
  { label: "In Progress", value: "in_progress" },
  { label: "At Risk", value: "at_risk" },
  { label: "Completed", value: "completed" },
];

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isProgrammeLead, isTeamLead, currentUser } = useAuth();
  const {
    projects, tasks, milestones, events,
    updateProject, deleteProject,
    updateTask, createTask, deleteTask,
    createMilestone, updateMilestone, deleteMilestone,
  } = useData();

  const project = projects.find(p => p.id === id);
  const [tab, setTab] = useState<TabType>("overview");
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(project?.title ?? "");
  const [draftDescription, setDraftDescription] = useState(project?.description ?? "");
  const [draftPhase, setDraftPhase] = useState(project?.phase ?? "");
  const [draftNotes, setDraftNotes] = useState(project?.notes ?? "");
  const [draftStatus, setDraftStatus] = useState<ProjectStatus>(project?.status ?? "not_started");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [msTitle, setMsTitle] = useState("");
  const [msDateOffsetDays, setMsDateOffsetDays] = useState<number>(14);
  const [msSaving, setMsSaving] = useState(false);

  const projectTasks = useMemo(() => tasks.filter(t => t.projectId === id), [tasks, id]);
  const projectMilestones = useMemo(() => milestones.filter(m => m.projectId === id), [milestones, id]);
  const projectEvents = useMemo(() => events.filter(e => e.projectId === id), [events, id]);

  if (!project) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Project not found.</Text>
      </View>
    );
  }

  // Permissions
  const canEdit = isProgrammeLead || (isTeamLead && currentUser?.teamId === project.teamId);
  const canEditHighLevel = canEdit;
  const canDelete = isProgrammeLead || (isTeamLead && currentUser?.teamId === project.teamId);

  const total = projectTasks.length;
  const done = projectTasks.filter(t => t.status === "done").length;
  const progress = total > 0 ? done / total : 0;

  function startEditing() {
    setDraftTitle(project!.title);
    setDraftDescription(project!.description);
    setDraftPhase(project!.phase);
    setDraftNotes(project!.notes);
    setDraftStatus(project!.status);
    setEditing(true);
  }

  async function save() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateProject(id!, {
      title: draftTitle,
      description: draftDescription,
      phase: draftPhase,
      notes: draftNotes,
      status: draftStatus,
    });
    setEditing(false);
  }

  function handleDelete() {
    Alert.alert("Delete Project", "Delete this project and all its tasks?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteProject(project!.id);
          router.back();
        }
      },
    ]);
  }

  async function addQuickTask() {
    if (!newTaskTitle.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await createTask({
        projectId: id,
        title: newTaskTitle.trim(),
        description: "",
        status: "todo",
        priority: "medium",
        dueDate: null,
        assignedToUserId: null,
        assignedToMemberId: null,
      });
      setNewTaskTitle("");
    } catch (e) {
      console.error("createTask failed", e);
      Alert.alert("Error", "Could not create task.");
    }
  }

  function confirmDeleteTask(task: { id: string; title: string }) {
    if (!canEdit) return;
    const run = async () => {
      try { await deleteTask(task.id); }
      catch (e) { console.error(e); Alert.alert("Error", "Could not delete task."); }
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`Delete task "${task.title}"?`)) void run();
      return;
    }
    Alert.alert("Delete Task", `Delete "${task.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { void run(); } },
    ]);
  }

  async function handleCreateMilestone() {
    if (!msTitle.trim()) { Alert.alert("Title required", "Give the milestone a title."); return; }
    setMsSaving(true);
    try {
      const date = new Date();
      date.setDate(date.getDate() + msDateOffsetDays);
      await createMilestone({
        projectId: id,
        title: msTitle.trim(),
        date: date.toISOString(),
        completed: false,
      });
      setMsTitle("");
      setMsDateOffsetDays(14);
      setShowAddMilestone(false);
    } catch (e) {
      console.error("createMilestone failed", e);
      Alert.alert("Error", "Could not create milestone.");
    } finally {
      setMsSaving(false);
    }
  }

  function confirmDeleteMilestone(m: { id: string; title: string }) {
    if (!canEditHighLevel) return;
    const run = async () => {
      try { await deleteMilestone(m.id); }
      catch (e) { console.error(e); Alert.alert("Error", "Could not delete milestone."); }
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`Delete milestone "${m.title}"?`)) void run();
      return;
    }
    Alert.alert("Delete Milestone", `Delete "${m.title}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => { void run(); } },
    ]);
  }

  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  const TABS: { key: TabType; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    { key: "tasks", label: "Tasks", count: projectTasks.length },
    { key: "milestones", label: "Milestones", count: projectMilestones.length },
    { key: "events", label: "Events", count: projectEvents.length },
  ];

  const displayTitle = editing ? draftTitle : project.title;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.navyDark }]}>
        <View style={[styles.projectDot, { backgroundColor: project.color }]} />
        {editing && canEdit ? (
          <TextInput
            style={styles.titleInput}
            value={draftTitle}
            onChangeText={setDraftTitle}
            autoFocus
          />
        ) : (
          <Text style={styles.headerTitle} numberOfLines={1}>{displayTitle}</Text>
        )}
        <View style={styles.headerActions}>
          {editing ? (
            <>
              <TouchableOpacity style={styles.headerBtn} onPress={() => setEditing(false)} activeOpacity={0.7}>
                <Feather name="x" size={18} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.headerBtn, { backgroundColor: colors.primary }]} onPress={save} activeOpacity={0.7}>
                <Feather name="check" size={18} color="#fff" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              {canEditHighLevel && (
                <TouchableOpacity style={styles.headerBtn} onPress={startEditing} activeOpacity={0.7}>
                  <Feather name="edit-2" size={18} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              )}
              {canDelete && (
                <TouchableOpacity style={styles.headerBtn} onPress={handleDelete} activeOpacity={0.7}>
                  <Feather name="trash-2" size={18} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressSection, { backgroundColor: colors.navyMid }]}>
        <View style={styles.progressMeta}>
          <StatusBadge status={project.status} small />
          <Text style={styles.progressFraction}>{done}/{total} tasks</Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: project.color }]} />
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

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad }} showsVerticalScrollIndicator={false}>
        {tab === "overview" && (
          <View style={styles.tabContent}>
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {project.teamName && <InfoRow label="Team" value={project.teamName} />}

              {editing ? (
                <View style={{ paddingVertical: 10 }}>
                  <Text style={[infoStyles.label, { color: colors.mutedForeground }]}>Phase</Text>
                  <TextInput
                    style={[styles.inlineInput, { color: colors.foreground, borderBottomColor: colors.border }]}
                    value={draftPhase}
                    onChangeText={setDraftPhase}
                    placeholder="e.g. Phase 1: Planning"
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>
              ) : (
                <InfoRow label="Phase" value={project.phase || "—"} />
              )}

              {project.dueDate && (
                <InfoRow label="Due Date" value={new Date(project.dueDate).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })} />
              )}
              {project.tags.length > 0 && <InfoRow label="Tags" value={project.tags.join(", ")} />}
            </View>

            {/* Status — only editable by team_leader/admin */}
            {editing && canEdit && (
              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Status</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {STATUS_OPTIONS.map(s => (
                    <TouchableOpacity
                      key={s.value}
                      style={[styles.statusChip, { backgroundColor: draftStatus === s.value ? colors.primary : colors.muted }]}
                      onPress={() => setDraftStatus(s.value)}
                      activeOpacity={0.7}
                    >
                      {draftStatus === s.value && <Feather name="check" size={12} color="#fff" />}
                      <Text style={[{ fontSize: 13, fontFamily: "Inter_500Medium", color: draftStatus === s.value ? "#fff" : colors.mutedForeground }]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Description</Text>
              {editing && canEdit ? (
                <TextInput
                  style={[styles.textarea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                  value={draftDescription}
                  onChangeText={setDraftDescription}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor={colors.mutedForeground}
                  placeholder="Add a description..."
                />
              ) : (
                <Text style={[styles.bodyText, { color: project.description ? colors.foreground : colors.mutedForeground }]}>
                  {project.description || "No description"}
                </Text>
              )}
            </View>

            {/* Notes — editable by owner and above */}
            <View style={styles.fieldBlock}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Notes</Text>
              </View>
              {editing ? (
                <TextInput
                  style={[styles.textarea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                  value={draftNotes}
                  onChangeText={setDraftNotes}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor={colors.mutedForeground}
                  placeholder="Project notes or high-level observations..."
                />
              ) : (
                <Text style={[styles.bodyText, { color: project.notes ? colors.foreground : colors.mutedForeground }]}>
                  {project.notes || "No notes"}
                </Text>
              )}
            </View>
          </View>
        )}

        {tab === "tasks" && (
          <View>
            {canEdit && (
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
            )}

            {projectTasks.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.muted }]}>
                <Feather name="check-square" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No tasks yet</Text>
              </View>
            ) : (
              <View style={[styles.taskList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {projectTasks.map(t => (
                  <TaskItem
                    key={t.id}
                    task={t}
                    onToggle={(updated) => {
                      if (canEdit) updateTask(t.id, { status: updated.status });
                    }}
                    onLongPress={canEdit ? confirmDeleteTask : undefined}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {tab === "milestones" && (
          <View>
            {canEditHighLevel && (
              <TouchableOpacity
                style={[styles.addInlineBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowAddMilestone(true)}
                activeOpacity={0.8}
              >
                <Feather name="plus" size={16} color="#fff" />
                <Text style={styles.addInlineBtnText}>Add Milestone</Text>
              </TouchableOpacity>
            )}

            {showAddMilestone && (
              <View style={[styles.inlineForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Title</Text>
                <TextInput
                  style={[styles.inlineInput, { color: colors.foreground, borderBottomColor: colors.border }]}
                  value={msTitle}
                  onChangeText={setMsTitle}
                  placeholder="e.g. Design review"
                  placeholderTextColor={colors.mutedForeground}
                  autoFocus
                />
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 12 }]}>Target Date</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                  {[
                    { label: "Today", days: 0 },
                    { label: "+1 week", days: 7 },
                    { label: "+2 weeks", days: 14 },
                    { label: "+1 month", days: 30 },
                    { label: "+3 months", days: 90 },
                  ].map((opt) => (
                    <TouchableOpacity
                      key={opt.label}
                      style={[styles.statusChip, { backgroundColor: msDateOffsetDays === opt.days ? colors.primary : colors.muted }]}
                      onPress={() => setMsDateOffsetDays(opt.days)}
                    >
                      <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: msDateOffsetDays === opt.days ? "#fff" : colors.mutedForeground }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
                  <TouchableOpacity
                    style={[styles.formBtn, { backgroundColor: colors.muted, flex: 1 }]}
                    onPress={() => { setShowAddMilestone(false); setMsTitle(""); }}
                    disabled={msSaving}
                  >
                    <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 14 }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.formBtn, { backgroundColor: colors.primary, flex: 1, opacity: msSaving ? 0.7 : 1 }]}
                    onPress={handleCreateMilestone}
                    disabled={msSaving}
                  >
                    <Text style={{ color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 }}>{msSaving ? "Saving..." : "Save"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {projectMilestones.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.muted }]}>
                <Feather name="flag" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No milestones yet</Text>
              </View>
            ) : (
              <View style={[styles.taskList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {projectMilestones.map(m => (
                  <View key={m.id} style={[styles.milestoneRow, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity
                      onPress={() => {
                        if (!canEditHighLevel) return;
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        updateMilestone(m.id, { completed: !m.completed });
                      }}
                      activeOpacity={canEditHighLevel ? 0.7 : 1}
                      hitSlop={6}
                    >
                      <View style={[styles.milestoneCheck, { borderColor: m.completed ? colors.success : colors.border, backgroundColor: m.completed ? colors.success : "transparent" }]}>
                        {m.completed && <Feather name="check" size={12} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                    <View style={styles.milestoneInfo}>
                      <Text style={[styles.milestoneTitle, { color: colors.foreground, textDecorationLine: m.completed ? "line-through" : "none", opacity: m.completed ? 0.5 : 1 }]}>
                        {m.title}
                      </Text>
                      <Text style={[styles.milestoneDate, { color: colors.mutedForeground }]}>
                        {new Date(m.date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                      </Text>
                    </View>
                    {canEditHighLevel ? (
                      <TouchableOpacity onPress={() => confirmDeleteMilestone(m)} hitSlop={8} style={{ padding: 4 }}>
                        <Feather name="trash-2" size={14} color="#DC2626" />
                      </TouchableOpacity>
                    ) : (
                      <Feather name="flag" size={14} color={m.completed ? colors.success : colors.mutedForeground} />
                    )}
                  </View>
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
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
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
  inlineInput: { fontSize: 14, fontFamily: "Inter_400Regular", borderBottomWidth: 1, paddingBottom: 2 },
  textarea: { borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 80, textAlignVertical: "top" },
  statusChip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4 },
  quickAdd: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingLeft: 12, paddingRight: 6, paddingVertical: 6, marginBottom: 12, gap: 8 },
  quickInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", paddingVertical: 4 },
  quickBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  taskList: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  empty: { borderRadius: 12, padding: 32, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  addInlineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 10, marginBottom: 12 },
  addInlineBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  inlineForm: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 12 },
  formBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
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
