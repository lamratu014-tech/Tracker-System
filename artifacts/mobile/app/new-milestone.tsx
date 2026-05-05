import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  getListProjectMilestonesQueryKey,
  useCreateMilestone,
  useListProjects,
  useListTeams,
} from "@workspace/api-client-react";
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

import { ErrorBanner } from "@/components/ErrorBanner";
import { useColors } from "@/hooks/useColors";
import { canCreateForTeam, useMe } from "@/lib/permissions";

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
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const me = useMe();

  const projectsQ = useListProjects();
  const teamsQ = useListTeams();
  const projects = projectsQ.data ?? [];
  const teams = teamsQ.data ?? [];

  const allowedProjects = useMemo(() => {
    return projects.filter((p) => {
      const team = teams.find((t) => t.id === p.teamId);
      return canCreateForTeam(me, team ? { id: team.id, streamId: team.streamId } : null);
    });
  }, [projects, teams, me]);

  const initialProjectId =
    params.projectId && allowedProjects.some((p) => p.id === params.projectId)
      ? params.projectId
      : allowedProjects[0]?.id ?? "";

  const [projectId, setProjectId] = useState<string>(initialProjectId);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<string>(isoFromDays(7));

  const createMilestone = useCreateMilestone({
    mutation: {
      onSuccess: (m) => {
        if (m?.projectId) {
          qc.invalidateQueries({ queryKey: getListProjectMilestonesQueryKey(m.projectId) });
        }
        router.back();
      },
    },
  });

  if (allowedProjects.length === 0 && !projectsQ.isLoading) {
    return (
      <View style={[styles.gate, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>You don't have a project to add a milestone to.</Text>
      </View>
    );
  }

  function save() {
    if (!title.trim()) return Alert.alert("Title required", "Please enter a milestone title.");
    if (!projectId) return Alert.alert("Project required", "Pick a project.");
    if (!date) return Alert.alert("Date required", "Pick a date.");
    const project = projects.find((p) => p.id === projectId);
    const team = project ? teams.find((t) => t.id === project.teamId) : null;
    if (!canCreateForTeam(me, team ? { id: team.id, streamId: team.streamId } : null)) {
      return Alert.alert("Not allowed", "You can't add a milestone to this team.");
    }
    createMilestone.mutate({ data: { projectId, title: title.trim(), date } });
  }

  const dl = new Date(date);
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
        {allowedProjects.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: projectId === p.id ? colors.primary : colors.muted }]}
            onPress={() => setProjectId(p.id)}
          >
            <Text style={[styles.chipText, { color: projectId === p.id ? "#fff" : colors.foreground }]}>
              {p.teamName ? `${p.teamName} · ` : ""}{p.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Date * — {dlLabel}</Text>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {DAY_OFFSETS.map((o) => (
          <TouchableOpacity
            key={o.label}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.muted }]}
            onPress={() => setDate(isoFromDays(o.days))}
          >
            <Text style={[styles.chipText, { color: colors.foreground }]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {createMilestone.isError ? <ErrorBanner error={createMilestone.error} /> : null}

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted }]} onPress={() => router.back()}>
          <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: title.trim() && projectId ? colors.primary : colors.border }]}
          onPress={save}
          disabled={!title.trim() || !projectId || createMilestone.isPending}
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
