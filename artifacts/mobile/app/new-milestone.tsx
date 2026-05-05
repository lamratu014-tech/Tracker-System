import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import type { MilestoneStatus, Project } from "@/models/types";
import {
  canCreateForTeam,
  findProject,
  useCurrentUser,
  useStore,
} from "@/store/useStore";

const STATUSES: MilestoneStatus[] = ["pending", "in_progress", "blocked", "completed"];
const STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  blocked: "Blocked",
  completed: "Completed",
};

const DAY_OFFSETS = [
  { label: "Today", days: 0 },
  { label: "+1 wk", days: 7 },
  { label: "+2 wks", days: 14 },
  { label: "+1 mo", days: 30 },
  { label: "+3 mo", days: 90 },
];

function isoFromDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(17, 0, 0, 0);
  return d.toISOString();
}

export default function NewMilestoneScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const me = useCurrentUser();
  const streams = useStore((s) => s.streams);
  const addMilestone = useStore((s) => s.addMilestone);

  const allowedProjects = useMemo(() => {
    const flat: Array<{ project: Project; teamId: string; teamName: string; streamName: string }> = [];
    for (const s of streams) for (const t of s.teams) for (const p of t.projects) {
      if (canCreateForTeam(me, t.id, streams)) {
        flat.push({ project: p, teamId: t.id, teamName: t.name, streamName: s.name });
      }
    }
    return flat;
  }, [streams, me]);

  const initialProjectId = params.projectId && allowedProjects.some((x) => x.project.id === params.projectId)
    ? params.projectId
    : (allowedProjects[0]?.project.id ?? "");

  const [projectId, setProjectId] = useState<string>(initialProjectId);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<MilestoneStatus>("pending");
  const [deadline, setDeadline] = useState<string>(isoFromDays(7));

  if (allowedProjects.length === 0) {
    return (
      <View style={[styles.gate, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>You don't have a project to add a milestone to.</Text>
      </View>
    );
  }

  function save() {
    if (!title.trim()) return Alert.alert("Title required", "Please enter a milestone title.");
    if (!projectId) return Alert.alert("Project required", "Pick a project.");
    if (!deadline) return Alert.alert("Deadline required", "Pick a deadline.");
    const found = findProject(streams, projectId);
    if (!found) return Alert.alert("Error", "Project not found.");
    if (!canCreateForTeam(me, found.team.id, streams)) return Alert.alert("Not allowed", "You can't add a milestone to this team.");
    const ms = addMilestone(projectId, { title: title.trim(), status, deadline, assignedTo: null });
    if (ms) router.back();
    else Alert.alert("Error", "Could not create milestone.");
  }

  const dl = new Date(deadline);
  const dlLabel = isNaN(dl.getTime())
    ? "—"
    : dl.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>Milestone title *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Concept signed off"
        placeholderTextColor={colors.mutedForeground}
        autoFocus
      />

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Project *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {allowedProjects.map(({ project, teamName, streamName }) => (
          <TouchableOpacity
            key={project.id}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: projectId === project.id ? colors.primary : colors.muted }]}
            onPress={() => setProjectId(project.id)}
          >
            <Text style={[styles.chipText, { color: projectId === project.id ? "#fff" : colors.foreground }]}>
              {streamName} · {teamName} · {project.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Status</Text>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {STATUSES.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: status === s ? colors.primary : colors.muted }]}
            onPress={() => setStatus(s)}
          >
            <Text style={[styles.chipText, { color: status === s ? "#fff" : colors.foreground }]}>{STATUS_LABELS[s]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Deadline * — {dlLabel}</Text>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {DAY_OFFSETS.map((o) => (
          <TouchableOpacity
            key={o.label}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.muted }]}
            onPress={() => setDeadline(isoFromDays(o.days))}
          >
            <Text style={[styles.chipText, { color: colors.foreground }]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted }]} onPress={() => router.back()}>
          <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: title.trim() && projectId ? colors.primary : colors.border }]}
          onPress={save}
          disabled={!title.trim() || !projectId}
        >
          <Text style={[styles.btnText, { color: "#fff" }]}>Create</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 10 },
  gate: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 4 },
  input: { padding: 12, borderRadius: 10, borderWidth: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  row: { flexDirection: "row", gap: 8, marginTop: 16 },
  btn: { flex: 1, padding: 14, borderRadius: 10, alignItems: "center" },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
