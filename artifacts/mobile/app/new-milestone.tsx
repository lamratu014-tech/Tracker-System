import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  getGetProjectQueryKey,
  getGetTeamQueryKey,
  getListProjectMilestonesQueryKey,
  useCreateMilestone,
  useGetProject,
  useGetTeam,
} from "@workspace/api-client-react";
import React, { useState } from "react";
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
import { useCanManageTeam } from "@/lib/permissions";

const DAY_OFFSETS: { label: string; days: number }[] = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "In 2 days", days: 2 },
  { label: "In 3 days", days: 3 },
  { label: "In 1 week", days: 7 },
  { label: "In 2 weeks", days: 14 },
];

const DEFAULT_OFFSET = 1;

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
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();

  const projectQ = useGetProject(projectId ?? "", {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId ?? "") },
  });
  const project = projectQ.data ?? null;

  const teamQ = useGetTeam(project?.teamId ?? "", {
    query: {
      enabled: !!project?.teamId,
      queryKey: getGetTeamQueryKey(project?.teamId ?? ""),
    },
  });
  const team = teamQ.data ?? null;

  const canEdit = useCanManageTeam(team ? { id: team.id, streamId: team.streamId } : null);

  const [title, setTitle] = useState("");
  const [offsetDays, setOffsetDays] = useState<number>(DEFAULT_OFFSET);

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

  if (!projectId) {
    return (
      <View style={[styles.gate, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 16 }}>
          Pick a project first
        </Text>
        <Text style={{ color: colors.mutedForeground, textAlign: "center", marginTop: 6 }}>
          Milestones are added from a project's detail screen.
        </Text>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary, marginTop: 16, alignSelf: "stretch" }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.btnText, { color: "#fff" }]}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (projectQ.isLoading) {
    return (
      <View style={[styles.gate, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Loading…</Text>
      </View>
    );
  }

  if (!project) {
    return (
      <View style={[styles.gate, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Project not found.</Text>
      </View>
    );
  }

  if (!canEdit) {
    return (
      <View style={[styles.gate, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>
          You don't have permission to add a milestone here.
        </Text>
      </View>
    );
  }

  function save() {
    if (!title.trim()) return Alert.alert("Title required", "Please enter a milestone title.");
    createMilestone.mutate({
      data: { projectId: projectId!, title: title.trim(), date: isoFromDays(offsetDays) },
    });
  }

  const dl = new Date(isoFromDays(offsetDays));
  const dlLabel = dl.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.crumb, { color: colors.mutedForeground }]}>
        {team?.name ? `${team.name} · ` : ""}{project.title}
      </Text>

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Milestone title *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Concept signed off"
        placeholderTextColor={colors.mutedForeground}
        autoFocus
      />

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Due — {dlLabel}</Text>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {DAY_OFFSETS.map((o) => {
          const active = offsetDays === o.days;
          return (
            <TouchableOpacity
              key={o.label}
              style={[
                styles.chip,
                {
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primary : colors.muted,
                },
              ]}
              onPress={() => setOffsetDays(o.days)}
            >
              <Text style={[styles.chipText, { color: active ? "#fff" : colors.foreground }]}>
                {o.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {createMilestone.isError ? <ErrorBanner error={createMilestone.error} /> : null}

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted }]} onPress={() => router.back()}>
          <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: title.trim() ? colors.primary : colors.border }]}
          onPress={save}
          disabled={!title.trim() || createMilestone.isPending}
        >
          <Text style={[styles.btnText, { color: "#fff" }]}>Create</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 10 },
  gate: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, gap: 6 },
  crumb: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 4 },
  input: { padding: 12, borderRadius: 10, borderWidth: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  row: { flexDirection: "row", gap: 8, marginTop: 16 },
  btn: { flex: 1, padding: 14, borderRadius: 10, alignItems: "center" },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
