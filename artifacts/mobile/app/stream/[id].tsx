import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  getGetStreamQueryKey,
  getListStreamTeamsQueryKey,
  getListStreamsQueryKey,
  getListTeamsQueryKey,
  useDeleteStream,
  useGetStream,
  useListProjects,
  useListStreamTeams,
  useListUsers,
  useUpdateStream,
} from "@workspace/api-client-react";
import React, { useEffect, useState } from "react";
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
import { useColors } from "@/hooks/useColors";
import {
  canManageEverything,
  teamVisibility,
  useCanManageStream,
  useMe,
} from "@/lib/permissions";

export default function StreamDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const dialog = useDialog();

  const streamQ = useGetStream(id ?? "", {
    query: { enabled: !!id, queryKey: getGetStreamQueryKey(id ?? "") },
  });
  const teamsQ = useListStreamTeams(id ?? "", {
    query: { enabled: !!id, queryKey: getListStreamTeamsQueryKey(id ?? "") },
  });
  const projectsQ = useListProjects();
  const usersQ = useListUsers();

  const stream = streamQ.data ?? null;
  const allTeams = teamsQ.data ?? [];
  const projects = projectsQ.data ?? [];
  const users = usersQ.data ?? [];

  // Drop teams the current user must not see at all.
  const teams = allTeams.filter(
    (t) => teamVisibility(me, t, stream?.programmeId) !== "hidden",
  );
  // Leaders and stream overseers may only view their own stream; any other
  // stream (even if empty) is access-restricted. Admins can view every
  // stream.
  const accessRestricted =
    !!stream &&
    (me?.role === "leader" || me?.role === "stream_overseer") &&
    me.streamId !== stream.id;

  const canManage = useCanManageStream(stream?.id ?? null);
  const isAdmin = canManageEverything(me);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");

  useEffect(() => {
    if (stream && !editing) setDraftName(stream.name);
  }, [stream, editing]);

  const updateStream = useUpdateStream({
    mutation: {
      onSuccess: () => {
        if (id) qc.invalidateQueries({ queryKey: getGetStreamQueryKey(id) });
        qc.invalidateQueries({ queryKey: getListStreamsQueryKey() });
      },
    },
  });
  const deleteStream = useDeleteStream({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListStreamsQueryKey() });
        qc.invalidateQueries({ queryKey: getListTeamsQueryKey() });
      },
    },
  });

  if (streamQ.isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingRow />
      </View>
    );
  }
  if (!stream) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>Stream not found.</Text>
      </View>
    );
  }
  if (accessRestricted) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, alignItems: "center", justifyContent: "center", gap: 12 },
        ]}
      >
        <Feather name="lock" size={32} color={colors.mutedForeground} />
        <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 18 }}>
          Access restricted
        </Text>
        <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>
          You don&apos;t have access to this stream.
        </Text>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.muted }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={14} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.primary }]}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function confirmDelete() {
    if (!stream) return;
    const ok = await dialog.confirm({
      title: "Delete stream",
      message: `Delete stream "${stream.name}" and all its teams/projects?`,
      destructive: true,
      confirmText: "Delete",
    });
    if (ok) deleteStream.mutate({ id: stream.id }, { onSuccess: () => router.back() });
  }

  function saveName() {
    if (!stream || !draftName.trim()) return;
    updateStream.mutate(
      { id: stream.id, data: { name: draftName.trim() } },
      { onSuccess: () => setEditing(false) },
    );
  }

  function projectsForTeam(teamId: string): number {
    return projects.filter((p) => p.teamId === teamId).length;
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        {editing ? (
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            onBlur={saveName}
            style={[styles.titleInput, { color: colors.foreground, borderColor: colors.border }]}
            autoFocus
          />
        ) : (
          <Text style={[styles.title, { color: colors.foreground }]}>{stream.name}</Text>
        )}
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {teams.length} team{teams.length !== 1 ? "s" : ""}
        </Text>
        {canManage ? (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.muted }]}
              onPress={() => {
                if (editing) saveName();
                else { setDraftName(stream.name); setEditing(true); }
              }}
            >
              <Feather name={editing ? "check" : "edit-2"} size={14} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.primary }]}>{editing ? "Save" : "Rename"}</Text>
            </TouchableOpacity>
            {isAdmin ? (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#FEE2E2" }]}
                onPress={confirmDelete}
              >
                <Feather name="trash-2" size={14} color="#DC2626" />
                <Text style={[styles.actionText, { color: "#DC2626" }]}>Delete</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.sectionRow}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Teams</Text>
        {canManage ? (
          <TouchableOpacity
            style={[styles.smallBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push({ pathname: "/new-team", params: { streamId: stream.id } })}
          >
            <Feather name="plus" size={12} color="#fff" />
            <Text style={styles.smallBtnText}>Team</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {teamsQ.isError ? (
        <ErrorBanner error={teamsQ.error} onRetry={() => teamsQ.refetch()} />
      ) : null}
      {teamsQ.isLoading ? <LoadingRow /> : null}

      {teams.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.muted }]}>
          <Text style={{ color: colors.mutedForeground }}>No teams yet.</Text>
        </View>
      ) : (
        teams.map((team) => {
          const vis = teamVisibility(me, team, stream?.programmeId);
          if (vis === "locked") {
            const leaderId = team.leaderIds?.[0] ?? null;
            const leader = leaderId ? users.find((u) => u.id === leaderId) : null;
            return (
              <View
                key={team.id}
                style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.85 }]}
              >
                <View style={[styles.iconBox, { backgroundColor: colors.muted }]}>
                  <Feather name="users" size={16} color={colors.mutedForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>{team.name}</Text>
                  <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>
                    Leader: {leader?.name ?? "Unassigned"}
                  </Text>
                </View>
                <Feather name="lock" size={16} color={colors.mutedForeground} />
              </View>
            );
          }
          const pCount = projectsForTeam(team.id);
          return (
            <TouchableOpacity
              key={team.id}
              style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: "/team/[id]", params: { id: team.id } })}
              activeOpacity={0.8}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.primary + "15" }]}>
                <Feather name="users" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>{team.name}</Text>
                <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>
                  {pCount} project{pCount !== 1 ? "s" : ""}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          );
        })
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  header: { gap: 6 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  titleInput: { fontSize: 26, fontFamily: "Inter_700Bold", borderBottomWidth: 1, paddingVertical: 4 },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  actionText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  smallBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  empty: { padding: 16, borderRadius: 10, alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderWidth: 1, borderRadius: 10 },
  iconBox: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  rowMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
});
