import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
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
import {
  canManageTeam,
  findProject,
  useCurrentUser,
  useStore,
} from "@/store/useStore";

export default function ProjectDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useCurrentUser();
  const streams = useStore((s) => s.streams);
  const users = useStore((s) => s.users);
  const updateProject = useStore((s) => s.updateProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const setMilestoneStatus = useStore((s) => s.setMilestoneStatus);
  const deleteMilestone = useStore((s) => s.deleteMilestone);

  const found = id ? findProject(streams, id) : null;
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(found?.project.title ?? "");
  const [draftDesc, setDraftDesc] = useState(found?.project.description ?? "");

  if (!found) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>Project not found.</Text>
      </View>
    );
  }
  const { stream, team, project } = found;
  const canEdit = canManageTeam(me, team.id);

  function save() {
    if (!draftTitle.trim()) return;
    updateProject(project!.id, { title: draftTitle.trim(), description: draftDesc.trim() });
    setEditing(false);
  }

  function confirmDelete() {
    const msg = `Delete project "${project.title}"?`;
    if (Platform.OS === "web") {
      if (window.confirm(msg)) { deleteProject(project.id); router.back(); }
    } else {
      Alert.alert("Delete project", msg, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => { deleteProject(project.id); router.back(); } },
      ]);
    }
  }

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
            style={[styles.input, styles.multi, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
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
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Milestones ({project.milestones.length})
        </Text>
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

      {project.milestones.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.muted }]}>
          <Text style={{ color: colors.mutedForeground }}>No milestones yet.</Text>
        </View>
      ) : (
        project.milestones
          .slice()
          .sort((a, b) => +new Date(a.deadline) - +new Date(b.deadline))
          .map((m) => (
            <MilestoneRow
              key={m.id}
              milestone={m}
              canEdit={canEdit}
              assigneeName={m.assignedTo ? users.find((u) => u.id === m.assignedTo)?.name : undefined}
              onCycleStatus={(next) => setMilestoneStatus(m.id, next)}
              onDelete={() => deleteMilestone(m.id)}
            />
          ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 10 },
  crumb: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  titleInput: { fontSize: 24, fontFamily: "Inter_700Bold", borderBottomWidth: 1, paddingVertical: 4 },
  desc: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4 },
  input: { padding: 12, borderRadius: 10, borderWidth: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  multi: { minHeight: 80, textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  actionText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  smallBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  empty: { padding: 16, borderRadius: 10, alignItems: "center" },
});
