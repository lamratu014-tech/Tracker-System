import { Feather } from "@expo/vector-icons";
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

import { MilestoneRow } from "@/components/MilestoneRow";
import { useColors } from "@/hooks/useColors";
import type { Milestone } from "@/models/types";
import { isDueToday, isOverdue } from "@/models/types";
import {
  findProject,
  useCanManageTeam,
  useStore,
} from "@/store/useStore";

type FilterKey = "all" | "today" | "upcoming" | "overdue" | "completed";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

function applyFilter(ms: Milestone[], key: FilterKey): Milestone[] {
  const now = new Date();
  switch (key) {
    case "all":
      return ms;
    case "today":
      return ms.filter((m) => isDueToday(m, now));
    case "upcoming":
      return ms.filter((m) => {
        if (m.status === "completed") return false;
        if (isOverdue(m, now)) return false;
        return true;
      });
    case "overdue":
      return ms.filter((m) => isOverdue(m, now));
    case "completed":
      return ms.filter((m) => m.status === "completed");
  }
}

export default function ProjectDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const streams = useStore((s) => s.streams);
  const users = useStore((s) => s.users);
  const updateProject = useStore((s) => s.updateProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const setStatus = useStore((s) => s.setMilestoneStatus);
  const deleteMilestone = useStore((s) => s.deleteMilestone);

  const found = id ? findProject(streams, id) : null;
  const canEdit = useCanManageTeam(found?.team.id ?? null);

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(found?.project.title ?? "");
  const [draftDesc, setDraftDesc] = useState(found?.project.description ?? "");
  const [filter, setFilter] = useState<FilterKey>("all");

  const counts = useMemo(() => {
    if (!found) return { all: 0, today: 0, upcoming: 0, overdue: 0, completed: 0 };
    const ms = found.project.milestones;
    return {
      all: ms.length,
      today: applyFilter(ms, "today").length,
      upcoming: applyFilter(ms, "upcoming").length,
      overdue: applyFilter(ms, "overdue").length,
      completed: applyFilter(ms, "completed").length,
    };
  }, [found]);

  if (!found) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>Project not found.</Text>
      </View>
    );
  }
  const { stream, team, project } = found;

  function save() {
    if (!draftTitle.trim()) return;
    updateProject(project.id, { title: draftTitle.trim(), description: draftDesc.trim() });
    setEditing(false);
  }

  function confirmDelete() {
    const msg = `Delete project "${project.title}"?`;
    if (Platform.OS === "web") {
      if (window.confirm(msg)) {
        deleteProject(project.id);
        router.back();
      }
    } else {
      Alert.alert("Delete project", msg, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => { deleteProject(project.id); router.back(); } },
      ]);
    }
  }

  const filtered = applyFilter(project.milestones, filter)
    .slice()
    .sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline));

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.crumb, { color: colors.mutedForeground }]}>
        {stream.name} · {team.name}
      </Text>
      {editing ? (
        <>
          <TextInput
            value={draftTitle}
            onChangeText={setDraftTitle}
            style={[styles.titleInput, { color: colors.foreground, borderColor: colors.border }]}
            autoFocus
          />
          <TextInput
            value={draftDesc}
            onChangeText={setDraftDesc}
            multiline
            style={[
              styles.input, styles.multi,
              { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted },
            ]}
            placeholder="Description"
            placeholderTextColor={colors.mutedForeground}
          />
        </>
      ) : (
        <>
          <Text style={[styles.title, { color: colors.foreground }]}>{project.title}</Text>
          {project.description ? (
            <Text style={[styles.desc, { color: colors.mutedForeground }]}>{project.description}</Text>
          ) : null}
        </>
      )}

      {canEdit ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.muted }]}
            onPress={() => {
              if (editing) save();
              else { setDraftTitle(project.title); setDraftDesc(project.description); setEditing(true); }
            }}
          >
            <Feather name={editing ? "check" : "edit-2"} size={14} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>{editing ? "Save" : "Edit"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#FEE2E2" }]}
            onPress={confirmDelete}
          >
            <Feather name="trash-2" size={14} color="#DC2626" />
            <Text style={[styles.actionText, { color: "#DC2626" }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.sectionRow}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Milestones</Text>
        {canEdit ? (
          <TouchableOpacity
            style={[styles.smallBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push({ pathname: "/new-milestone", params: { projectId: project.id } })}
          >
            <Feather name="plus" size={12} color="#fff" />
            <Text style={styles.smallBtnText}>Milestone</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {FILTERS.map((f) => {
          const c = counts[f.key];
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
                {f.label} · {c}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.muted }]}>
          <Text style={{ color: colors.mutedForeground }}>
            {project.milestones.length === 0 ? "No milestones yet." : "Nothing in this view."}
          </Text>
        </View>
      ) : (
        filtered.map((m) => (
          <MilestoneRow
            key={m.id}
            milestone={m}
            canEdit={canEdit}
            assigneeName={
              m.assignedTo ? users.find((u) => u.id === m.assignedTo)?.name : undefined
            }
            onCycleStatus={(next) => setStatus(m.id, next)}
            onDelete={() => deleteMilestone(m.id)}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 10 },
  crumb: {
    fontSize: 12, fontFamily: "Inter_500Medium",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  titleInput: {
    fontSize: 24, fontFamily: "Inter_700Bold",
    borderBottomWidth: 1, paddingVertical: 4,
  },
  desc: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4 },
  input: { padding: 12, borderRadius: 10, borderWidth: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  multi: { minHeight: 80, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
  },
  actionText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sectionRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginTop: 12,
  },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  smallBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  smallBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tabs: { gap: 6, paddingVertical: 4 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  tabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  empty: { padding: 16, borderRadius: 10, alignItems: "center" },
});
