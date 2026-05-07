import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  getListProjectsQueryKey,
  getListStreamTeamsQueryKey,
  useCreateProject,
  useListStreams,
  useListStreamTeams,
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
import { canCreateForTeam, canManageTeam, useMe } from "@/lib/permissions";

export default function NewProjectScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ teamId?: string }>();
  const me = useMe();
  const teamsQ = useListTeams();
  const streamsQ = useListStreams();
  const teams = teamsQ.data ?? [];
  const streams = streamsQ.data ?? [];

  const programmeIdFor = (streamId?: string | null) =>
    streamId ? streams.find((s) => s.id === streamId)?.programmeId ?? null : null;

  const allowedTeams = useMemo(
    () =>
      teams.filter((t) =>
        canManageTeam(me, { id: t.id, streamId: t.streamId }, programmeIdFor(t.streamId)),
      ),
    [teams, streams, me],
  );

  const initialTeamId =
    params.teamId && allowedTeams.some((t) => t.id === params.teamId)
      ? params.teamId
      : allowedTeams[0]?.id ?? "";

  const [teamId, setTeamId] = useState<string>(initialTeamId);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [sharedTeamIds, setSharedTeamIds] = useState<string[]>([]);

  const ownerTeam = teams.find((t) => t.id === teamId) ?? null;
  // Use the stream-scoped teams endpoint so leaders (whose /teams call only
  // returns their own team) can still see peer teams in the same stream.
  const streamTeamsQ = useListStreamTeams(ownerTeam?.streamId ?? "", {
    query: {
      enabled: !!ownerTeam?.streamId,
      queryKey: getListStreamTeamsQueryKey(ownerTeam?.streamId ?? ""),
    },
  });
  const peerTeams = useMemo(
    () =>
      ownerTeam
        ? (streamTeamsQ.data ?? []).filter((t) => t.id !== ownerTeam.id)
        : [],
    [streamTeamsQ.data, ownerTeam],
  );

  function toggleShared(id: string) {
    setSharedTeamIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function pickOwner(id: string) {
    setTeamId(id);
    // Reset shared selection when owner changes — peers are stream-scoped.
    setSharedTeamIds([]);
  }

  const createProject = useCreateProject({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        router.back();
      },
    },
  });

  if (allowedTeams.length === 0 && !teamsQ.isLoading) {
    return (
      <View style={[styles.gate, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>You don't have a team to add a project to.</Text>
      </View>
    );
  }

  function save() {
    if (!title.trim()) return Alert.alert("Title required", "Please enter a project title.");
    if (!teamId) return Alert.alert("Team required", "Pick a team.");
    const team = teams.find((t) => t.id === teamId);
    if (
      !canCreateForTeam(
        me,
        team ? { id: team.id, streamId: team.streamId } : null,
        programmeIdFor(team?.streamId),
      )
    ) {
      return Alert.alert("Not allowed", "You don't have permission to add a project to this team.");
    }
    createProject.mutate({
      data: { teamId, title: title.trim(), description: desc.trim(), sharedTeamIds },
    });
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>Project title *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Spring Campaign"
        placeholderTextColor={colors.mutedForeground}
        autoFocus
      />

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Description</Text>
      <TextInput
        style={[styles.input, styles.multi, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        value={desc}
        onChangeText={setDesc}
        placeholder="What's this project about?"
        placeholderTextColor={colors.mutedForeground}
        multiline
        numberOfLines={3}
      />

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Owner team *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {allowedTeams.map((team) => (
          <TouchableOpacity
            key={team.id}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: teamId === team.id ? colors.primary : colors.muted }]}
            onPress={() => pickOwner(team.id)}
          >
            <Text style={[styles.chipText, { color: teamId === team.id ? "#fff" : colors.foreground }]}>
              {team.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {ownerTeam && peerTeams.length > 0 ? (
        <>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Share with other teams in this stream (optional)
          </Text>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            {peerTeams.map((team) => {
              const active = sharedTeamIds.includes(team.id);
              return (
                <TouchableOpacity
                  key={team.id}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primary + "22" : colors.muted,
                    },
                  ]}
                  onPress={() => toggleShared(team.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? colors.primary : colors.foreground },
                    ]}
                  >
                    {active ? "✓ " : ""}{team.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : null}

      {createProject.isError ? <ErrorBanner error={createProject.error} /> : null}

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted }]} onPress={() => router.back()}>
          <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: title.trim() && teamId ? colors.primary : colors.border }]}
          onPress={save}
          disabled={!title.trim() || !teamId || createProject.isPending}
        >
          <Text style={[styles.btnText, { color: "#fff" }]}>Create Project</Text>
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
  multi: { minHeight: 80, textAlignVertical: "top" },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  row: { flexDirection: "row", gap: 8, marginTop: 16 },
  btn: { flex: 1, padding: 14, borderRadius: 10, alignItems: "center" },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
