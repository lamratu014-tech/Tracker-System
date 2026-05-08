import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  getGetProjectQueryKey,
  getGetStreamQueryKey,
  getGetTeamQueryKey,
  getListProjectMilestonesQueryKey,
  getListProjectsQueryKey,
  useDeleteMilestone,
  useDeleteProject,
  useGetProject,
  useGetStream,
  useGetTeam,
  useListProjectMilestones,
  useListStreamTeams,
  useSetMilestoneStatus,
  useUpdateProject,
} from "@workspace/api-client-react";
import { getListStreamTeamsQueryKey } from "@workspace/api-client-react";
import type { Milestone } from "@workspace/api-client-react";
import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useDialog } from "@/components/Dialog";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingRow } from "@/components/LoadingRow";
import { MilestoneRow } from "@/components/MilestoneRow";
import { useColors } from "@/hooks/useColors";
import { useCanManageTeam } from "@/lib/permissions";
import { isDueToday, isOverdue } from "@/models/types";

type FilterKey = "all" | "today" | "upcoming" | "overdue" | "completed";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

function applyFilter(ms: Milestone[], key: FilterKey): Milestone[] {
  switch (key) {
    case "all": return ms;
    case "today": return ms.filter((m) => isDueToday(m));
    case "upcoming": return ms.filter((m) => !m.completed && !isOverdue(m));
    case "overdue": return ms.filter((m) => isOverdue(m));
    case "completed": return ms.filter((m) => m.completed);
  }
}

export default function ProjectDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dialog = useDialog();

  const projectQ = useGetProject(id ?? "", {
    query: { enabled: !!id, queryKey: getGetProjectQueryKey(id ?? "") },
  });
  const project = projectQ.data ?? null;
  const teamQ = useGetTeam(project?.teamId ?? "", {
    query: { enabled: !!project?.teamId, queryKey: getGetTeamQueryKey(project?.teamId ?? "") },
  });
  const team = teamQ.data ?? null;
  const streamQ = useGetStream(team?.streamId ?? "", {
    query: { enabled: !!team?.streamId, queryKey: getGetStreamQueryKey(team?.streamId ?? "") },
  });
  const stream = streamQ.data ?? null;

  // Stream-scoped teams so leaders (whose /teams call only returns their own
  // team) can still see peer team names in the share UI and shared chips.
  const streamTeamsQ = useListStreamTeams(team?.streamId ?? "", {
    query: {
      enabled: !!team?.streamId,
      queryKey: getListStreamTeamsQueryKey(team?.streamId ?? ""),
    },
  });
  const streamTeams = streamTeamsQ.data ?? [];

  const peerTeams = useMemo(
    () => (team ? streamTeams.filter((t) => t.id !== team.id) : []),
    [streamTeams, team],
  );
  const teamNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of streamTeams) m.set(t.id, t.name);
    return m;
  }, [streamTeams]);

  const milestonesQ = useListProjectMilestones(id ?? "", {
    query: { enabled: !!id, queryKey: getListProjectMilestonesQueryKey(id ?? "") },
  });
  const milestones = milestonesQ.data ?? [];

  const canEdit = useCanManageTeam(team ? { id: team.id, streamId: team.streamId } : null);

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftSharedTeamIds, setDraftSharedTeamIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    if (project && !editing) {
      setDraftTitle(project.title);
      setDraftDesc(project.description ?? "");
      setDraftSharedTeamIds(project.sharedTeamIds ?? []);
    }
  }, [project, editing]);

  const updateProject = useUpdateProject({
    mutation: {
      onSuccess: () => {
        if (id) qc.invalidateQueries({ queryKey: getGetProjectQueryKey(id) });
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      },
    },
  });
  const deleteProject = useDeleteProject({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListProjectsQueryKey() }) },
  });
  const setStatus = useSetMilestoneStatus({
    mutation: {
      onSuccess: () => {
        if (id) qc.invalidateQueries({ queryKey: getListProjectMilestonesQueryKey(id) });
      },
    },
  });
  const deleteMilestone = useDeleteMilestone({
    mutation: {
      onSuccess: () => {
        if (id) qc.invalidateQueries({ queryKey: getListProjectMilestonesQueryKey(id) });
      },
    },
  });

  const counts = useMemo(() => ({
    all: milestones.length,
    today: applyFilter(milestones, "today").length,
    upcoming: applyFilter(milestones, "upcoming").length,
    overdue: applyFilter(milestones, "overdue").length,
    completed: applyFilter(milestones, "completed").length,
  }), [milestones]);

  if (projectQ.isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingRow />
      </View>
    );
  }
  if (!project) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>Project not found.</Text>
      </View>
    );
  }

  function toggleDraftShared(tid: string) {
    setDraftSharedTeamIds((prev) =>
      prev.includes(tid) ? prev.filter((x) => x !== tid) : [...prev, tid],
    );
  }

  function save() {
    if (!draftTitle.trim()) return;
    updateProject.mutate(
      {
        id: project!.id,
        data: {
          title: draftTitle.trim(),
          description: draftDesc.trim(),
          sharedTeamIds: draftSharedTeamIds,
        },
      },
      { onSuccess: () => setEditing(false) },
    );
  }

  async function confirmDelete() {
    const ok = await dialog.confirm({
      title: "Delete project",
      message: `Delete project "${project!.title}"?`,
      destructive: true,
      confirmText: "Delete",
    });
    if (ok) deleteProject.mutate({ id: project!.id }, { onSuccess: () => router.back() });
  }

  const filtered = applyFilter(milestones, filter)
    .slice()
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));

  const sharedTeamIds = project.sharedTeamIds ?? [];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.crumb, { color: colors.mutedForeground }]}>
        {(stream?.name ?? "—")} · {(team?.name ?? "—")}
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

      {/* Shared teams display / editor */}
      {editing ? (
        peerTeams.length > 0 ? (
          <View style={{ gap: 6 }}>
            <Text style={[styles.sharedLabel, { color: colors.mutedForeground }]}>
              Shared with
            </Text>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {peerTeams.map((t) => {
                const active = draftSharedTeamIds.includes(t.id);
                return (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => toggleDraftShared(t.id)}
                    style={[
                      styles.sharedChip,
                      {
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primary + "22" : colors.muted,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sharedChipText,
                        { color: active ? colors.primary : colors.foreground },
                      ]}
                    >
                      {active ? "✓ " : ""}{t.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null
      ) : sharedTeamIds.length > 0 ? (
        <View style={{ gap: 4 }}>
          <Text style={[styles.sharedLabel, { color: colors.mutedForeground }]}>
            Shared with
          </Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {sharedTeamIds.map((tid) => (
              <View
                key={tid}
                style={[
                  styles.sharedChip,
                  { backgroundColor: colors.primary + "15", borderColor: colors.primary + "33" },
                ]}
              >
                <Feather name="share-2" size={11} color={colors.primary} />
                <Text style={[styles.sharedChipText, { color: colors.primary }]}>
                  {teamNameById.get(tid) ?? tid}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {canEdit ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.muted }]}
            onPress={() => {
              if (editing) save();
              else {
                setDraftTitle(project.title);
                setDraftDesc(project.description ?? "");
                setDraftSharedTeamIds(project.sharedTeamIds ?? []);
                setEditing(true);
              }
            }}
          >
            <Feather name={editing ? "check" : "edit-2"} size={14} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.primary }]}>{editing ? "Save" : "Edit"}</Text>
          </TouchableOpacity>
          {editing ? (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.muted }]}
              onPress={() => setEditing(false)}
            >
              <Feather name="x" size={14} color={colors.mutedForeground} />
              <Text style={[styles.actionText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#FEE2E2" }]}
              onPress={confirmDelete}
            >
              <Feather name="trash-2" size={14} color="#DC2626" />
              <Text style={[styles.actionText, { color: "#DC2626" }]}>Delete</Text>
            </TouchableOpacity>
          )}
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

      {milestonesQ.isError ? (
        <ErrorBanner error={milestonesQ.error} onRetry={() => milestonesQ.refetch()} />
      ) : null}

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

      {milestonesQ.isLoading ? (
        <LoadingRow />
      ) : filtered.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.muted }]}>
          <Text style={{ color: colors.mutedForeground }}>
            {milestones.length === 0 ? "No milestones yet." : "Nothing in this view."}
          </Text>
        </View>
      ) : (
        filtered.map((m) => (
          <MilestoneRow
            key={m.id}
            milestone={m}
            canEdit={canEdit}
            onToggleCompleted={(next) =>
              setStatus.mutate({ id: m.id, data: { completed: next } })
            }
            onDelete={() => deleteMilestone.mutate({ id: m.id })}
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
  tabs: { gap: 6, paddingVertical: 4 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  tabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  empty: { padding: 16, borderRadius: 10, alignItems: "center" },
  sharedLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  sharedChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  sharedChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
