import { Feather } from "@expo/vector-icons";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  getListEventsQueryKey,
  getListProgrammesQueryKey,
  getListStreamsQueryKey,
  getListTeamMembersQueryKey,
  getListTeamMembersQueryOptions,
  getListTeamsQueryKey,
  getListUsersQueryKey,
  useCreateProgramme,
  useDeleteEvent,
  useDeleteMember,
  useDeleteProgramme,
  useDeleteStream,
  useDeleteTeam,
  useDeleteUser,
  useListEvents,
  useListProgrammes,
  useListStreams,
  useListTeams,
  useListUsers,
  useUpdateProgramme,
  useUpdateUserRole,
} from "@workspace/api-client-react";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingRow } from "@/components/LoadingRow";
import { useColors } from "@/hooks/useColors";
import { useMe } from "@/lib/permissions";
import type { Role } from "@/models/types";

type AdminTab = "structure" | "programmes" | "users" | "members" | "events";

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  programme_overseer: "Prog. Overseer",
  stream_overseer: "Overseer",
  leader: "Leader",
};

const ROLE_COLOR: Record<Role, string> = {
  admin: "#7C3AED",
  programme_overseer: "#6366F1",
  stream_overseer: "#0EA5E9",
  leader: "#2563EB",
};

const ROLE_CYCLE: Role[] = ["admin", "programme_overseer", "stream_overseer", "leader"];

function confirm(message: string, onYes: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(message)) onYes();
  } else {
    Alert.alert("Confirm", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Yes", style: "destructive", onPress: onYes },
    ]);
  }
}

export default function AdminPanelScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();

  const usersQ = useListUsers();
  const programmesQ = useListProgrammes();
  const streamsQ = useListStreams();
  const teamsQ = useListTeams();
  const eventsQ = useListEvents();

  const users = usersQ.data ?? [];
  const programmes = programmesQ.data ?? [];
  const streams = streamsQ.data ?? [];
  const teams = teamsQ.data ?? [];
  const events = eventsQ.data ?? [];

  const invalidateProgrammes = () =>
    qc.invalidateQueries({ queryKey: getListProgrammesQueryKey() });
  const createProgramme = useCreateProgramme({
    mutation: {
      onSuccess: invalidateProgrammes,
      onError: (err: unknown) => {
        const e = err as { message?: string };
        Alert.alert("Couldn't create programme", e?.message ?? "Unknown error");
      },
    },
  });
  const updateProgramme = useUpdateProgramme({
    mutation: {
      onSuccess: invalidateProgrammes,
      onError: (err: unknown) => {
        const e = err as { message?: string };
        Alert.alert("Couldn't rename programme", e?.message ?? "Unknown error");
      },
    },
  });
  const deleteProgramme = useDeleteProgramme({
    mutation: {
      onSuccess: invalidateProgrammes,
      onError: (err: unknown) => {
        const e = err as { status?: number; message?: string };
        if (e?.status === 409) {
          Alert.alert(
            "Cannot delete",
            "This programme still has streams. Remove the streams first.",
          );
        } else {
          Alert.alert("Error", e?.message ?? "Failed to delete programme");
        }
      },
    },
  });
  const [newProgrammeName, setNewProgrammeName] = useState("");
  const streamCountByProgramme = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of streams) m.set(s.programmeId, (m.get(s.programmeId) ?? 0) + 1);
    return m;
  }, [streams]);

  function promptRename(p: { id: string; name: string }) {
    if (Platform.OS === "web") {
      const next = window.prompt("Rename programme", p.name);
      if (next && next.trim() && next.trim() !== p.name) {
        updateProgramme.mutate({ id: p.id, data: { name: next.trim() } });
      }
      return;
    }
    Alert.prompt(
      "Rename programme",
      p.name,
      (next) => {
        if (next && next.trim() && next.trim() !== p.name) {
          updateProgramme.mutate({ id: p.id, data: { name: next.trim() } });
        }
      },
      "plain-text",
      p.name,
    );
  }

  function addProgramme() {
    if (createProgramme.isPending) return;
    const trimmed = newProgrammeName.trim();
    if (!trimmed) {
      Alert.alert("Name required", "Please enter a programme name.");
      return;
    }
    Keyboard.dismiss();
    createProgramme.mutate(
      { data: { name: trimmed } },
      { onSuccess: () => setNewProgrammeName("") },
    );
  }

  const updateUserRole = useUpdateUserRole({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListUsersQueryKey() }) },
  });
  const deleteUser = useDeleteUser({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListUsersQueryKey() }) },
  });
  const deleteStream = useDeleteStream({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListStreamsQueryKey() });
        qc.invalidateQueries({ queryKey: getListTeamsQueryKey() });
      },
    },
  });
  const deleteTeam = useDeleteTeam({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListTeamsQueryKey() }) },
  });
  const deleteEvent = useDeleteEvent({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListEventsQueryKey() }) },
  });
  const deleteMember = useDeleteMember();

  const [tab, setTab] = useState<AdminTab>("structure");
  const [expandedStreamId, setExpandedStreamId] = useState<string | null>(streams[0]?.id ?? null);

  // Members tab — fetch members for each team and merge
  const memberQueries = useQueries({
    queries: teams.map((t) => getListTeamMembersQueryOptions(t.id)),
  });
  const allMembers = useMemo(() => {
    const out: Array<{ id: string; name: string; teamId: string; teamName: string; streamName: string }> = [];
    teams.forEach((t, i) => {
      const list = memberQueries[i]?.data ?? [];
      const stream = streams.find((s) => s.id === t.streamId);
      for (const m of list) {
        out.push({
          id: m.id,
          name: m.name,
          teamId: t.id,
          teamName: t.name,
          streamName: stream?.name ?? "—",
        });
      }
    });
    return out;
  }, [teams, streams, memberQueries]);

  if (me?.role !== "admin") return null;

  function teamLabel(teamId: string | null | undefined): string {
    if (!teamId) return "—";
    const t = teams.find((x) => x.id === teamId);
    if (!t) return "—";
    const s = streams.find((x) => x.id === t.streamId);
    return s ? `${s.name} · ${t.name}` : t.name;
  }

  function streamLabel(streamId: string | null | undefined): string {
    if (!streamId) return "—";
    return streams.find((s) => s.id === streamId)?.name ?? "—";
  }

  function applyRoleChange(userId: string, next: Role, programmeIdOverride?: string) {
    const u = users.find((x) => x.id === userId);
    if (!u) return;
    updateUserRole.mutate({
      id: userId,
      data: {
        role: next,
        programmeId: programmeIdOverride ?? u.programmeId ?? undefined,
        streamId: u.streamId ?? undefined,
        teamId: u.teamId ?? undefined,
      },
    });
  }

  function pickProgramme(userId: string, next: Role) {
    if (programmes.length === 0) {
      Alert.alert("No programmes", "Create a programme before assigning a Programme Overseer.");
      return;
    }
    if (Platform.OS === "web") {
      const list = programmes.map((p, i) => `${i + 1}. ${p.name}`).join("\n");
      const choice = window.prompt(`Pick a programme (1-${programmes.length}):\n${list}`, "1");
      if (!choice) return;
      const idx = parseInt(choice, 10) - 1;
      const p = programmes[idx];
      if (!p) {
        Alert.alert("Invalid choice", "Programme not found.");
        return;
      }
      applyRoleChange(userId, next, p.id);
      return;
    }
    Alert.alert(
      "Pick a programme",
      "Choose which programme this overseer manages.",
      [
        ...programmes.map((p) => ({
          text: p.name,
          onPress: () => applyRoleChange(userId, next, p.id),
        })),
        { text: "Cancel", style: "cancel" as const },
      ],
    );
  }

  function changeRole(userId: string, currentRole: Role) {
    const u = users.find((x) => x.id === userId);
    if (!u) return;
    const idx = ROLE_CYCLE.indexOf(currentRole);
    const next = ROLE_CYCLE[(idx + 1) % ROLE_CYCLE.length];
    if (next === "programme_overseer") {
      // Always (re)pick a programme when promoting to PO so the assignment
      // is explicit, even if a stale programmeId already exists.
      pickProgramme(userId, next);
      return;
    }
    if (next === "stream_overseer" && !u.streamId) {
      Alert.alert("Stream required", "Assign this user to a stream first before making them an Overseer.");
      return;
    }
    if (next === "leader" && !u.teamId) {
      Alert.alert("Team required", "Assign this user to a team first before making them a Leader.");
      return;
    }
    applyRoleChange(userId, next);
  }

  function teamsForStream(streamId: string) {
    return teams.filter((t) => t.streamId === streamId);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {(["structure", "programmes", "users", "members", "events"] as AdminTab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && { borderBottomColor: colors.primary }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {tab === "structure" ? (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Streams ({streams.length}) · Teams ({teams.length})
              </Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TouchableOpacity
                  style={[styles.smallBtn, { backgroundColor: colors.muted }]}
                  onPress={() => router.push("/new-team")}
                >
                  <Feather name="users" size={12} color={colors.primary} />
                  <Text style={[styles.smallBtnText, { color: colors.primary }]}>Team</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push("/new-stream")}
                >
                  <Feather name="plus" size={12} color="#fff" />
                  <Text style={[styles.smallBtnText, { color: "#fff" }]}>Stream</Text>
                </TouchableOpacity>
              </View>
            </View>
            {streamsQ.isError ? (
              <ErrorBanner error={streamsQ.error} onRetry={() => streamsQ.refetch()} />
            ) : null}
            {streamsQ.isLoading ? (
              <LoadingRow />
            ) : streams.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.muted }]}>
                <Text style={{ color: colors.mutedForeground }}>No streams yet.</Text>
              </View>
            ) : (
              streams.map((stream) => {
                const expanded = expandedStreamId === stream.id;
                const stTeams = teamsForStream(stream.id);
                return (
                  <View key={stream.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 0 }]}>
                    <TouchableOpacity
                      style={styles.cardHeader}
                      onPress={() => setExpandedStreamId(expanded ? null : stream.id)}
                      activeOpacity={0.85}
                    >
                      <Feather name={expanded ? "chevron-down" : "chevron-right"} size={16} color={colors.mutedForeground} />
                      <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{stream.name}</Text>
                        <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                          {stTeams.length} team{stTeams.length !== 1 ? "s" : ""}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 4 }}>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={(e) => { e.stopPropagation(); router.push({ pathname: "/stream/[id]", params: { id: stream.id } }); }}
                        >
                          <Feather name="external-link" size={14} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            confirm(`Delete stream "${stream.name}"?`, () => deleteStream.mutate({ id: stream.id }));
                          }}
                        >
                          <Feather name="trash-2" size={14} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>

                    {expanded ? (
                      <View style={styles.cardBody}>
                        {stTeams.length === 0 ? (
                          <Text style={{ color: colors.mutedForeground, padding: 8, textAlign: "center" }}>
                            No teams in this stream.
                          </Text>
                        ) : (
                          stTeams.map((team) => (
                            <View key={team.id} style={[styles.subRow, { borderColor: colors.border }]}>
                              <Feather name="users" size={14} color={colors.primary} />
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.subTitle, { color: colors.foreground }]}>{team.name}</Text>
                              </View>
                              <TouchableOpacity
                                style={styles.iconBtn}
                                onPress={() => router.push({ pathname: "/team/[id]", params: { id: team.id } })}
                              >
                                <Feather name="external-link" size={13} color={colors.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.iconBtn}
                                onPress={() => confirm(`Delete team "${team.name}"?`, () => deleteTeam.mutate({ id: team.id }))}
                              >
                                <Feather name="trash-2" size={13} color="#DC2626" />
                              </TouchableOpacity>
                            </View>
                          ))
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </>
        ) : null}

        {tab === "programmes" ? (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Programmes ({programmes.length})
              </Text>
            </View>
            {programmesQ.isError ? (
              <ErrorBanner error={programmesQ.error} onRetry={() => programmesQ.refetch()} />
            ) : null}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", gap: 8, alignItems: "center" }]}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border, flex: 1 }]}
                value={newProgrammeName}
                onChangeText={setNewProgrammeName}
                placeholder="New programme name"
                placeholderTextColor={colors.mutedForeground}
                onSubmitEditing={addProgramme}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: newProgrammeName.trim() && !createProgramme.isPending ? colors.primary : colors.border }]}
                onPressIn={addProgramme}
                disabled={createProgramme.isPending}
              >
                <Feather name="plus" size={12} color="#fff" />
                <Text style={[styles.smallBtnText, { color: "#fff" }]}>
                  {createProgramme.isPending ? "Adding…" : "Add"}
                </Text>
              </TouchableOpacity>
            </View>
            {createProgramme.isError ? (
              <ErrorBanner error={createProgramme.error} />
            ) : null}
            {updateProgramme.isError ? (
              <ErrorBanner error={updateProgramme.error} />
            ) : null}
            {programmesQ.isLoading ? <LoadingRow /> : null}
            {programmes.length === 0 && !programmesQ.isLoading ? (
              <View style={[styles.empty, { backgroundColor: colors.muted }]}>
                <Text style={{ color: colors.mutedForeground }}>No programmes yet.</Text>
              </View>
            ) : (
              programmes.map((p) => {
                const count = streamCountByProgramme.get(p.id) ?? 0;
                return (
                  <View key={p.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 10 }]}>
                    <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: colors.foreground }]}>{p.name}</Text>
                      <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                        {count} stream{count !== 1 ? "s" : ""}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => promptRename(p)}>
                      <Feather name="edit-2" size={14} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => {
                        if (count > 0) {
                          Alert.alert(
                            "Cannot delete",
                            "This programme still has streams. Remove the streams first.",
                          );
                          return;
                        }
                        confirm(`Delete programme "${p.name}"?`, () =>
                          deleteProgramme.mutate({ id: p.id }),
                        );
                      }}
                    >
                      <Feather name="trash-2" size={14} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </>
        ) : null}

        {tab === "users" ? (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Users ({users.length})</Text>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/new-user")}
              >
                <Feather name="user-plus" size={12} color="#fff" />
                <Text style={[styles.smallBtnText, { color: "#fff" }]}>Invite</Text>
              </TouchableOpacity>
            </View>
            {usersQ.isError ? (
              <ErrorBanner error={usersQ.error} onRetry={() => usersQ.refetch()} />
            ) : null}
            {usersQ.isLoading ? <LoadingRow /> : null}
            {users.map((u) => {
              const role = u.role as Role;
              const scope =
                role === "admin"
                  ? "All streams"
                  : role === "stream_overseer"
                    ? streamLabel(u.streamId)
                    : teamLabel(u.teamId);
              return (
                <View key={u.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={[styles.avatar, { backgroundColor: ROLE_COLOR[role] + "22" }]}>
                      <Text style={[styles.avatarText, { color: ROLE_COLOR[role] }]}>
                        {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                        {u.name} {me?.id === u.id ? <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>(you)</Text> : null}
                      </Text>
                      <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {u.email} · {scope}
                        {u.active === false ? " · Inactive" : ""}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.roleChip, { backgroundColor: ROLE_COLOR[role] }]}
                      onPress={() => changeRole(u.id, role)}
                      hitSlop={6}
                    >
                      <Text style={styles.roleChipText}>{ROLE_LABEL[role]}</Text>
                    </TouchableOpacity>
                    {me?.id !== u.id ? (
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => confirm(`Delete user "${u.name}"?`, () => deleteUser.mutate({ id: u.id }))}
                      >
                        <Feather name="trash-2" size={14} color="#DC2626" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })}
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Tap the role chip to cycle: Admin → Overseer → Leader.
            </Text>
          </>
        ) : null}

        {tab === "members" ? (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Members ({allMembers.length})</Text>
              <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Add via team page</Text>
            </View>
            {teamsQ.isError ? (
              <ErrorBanner error={teamsQ.error} onRetry={() => teamsQ.refetch()} />
            ) : null}
            {memberQueries.some((q) => q.isLoading) ? <LoadingRow /> : null}
            {allMembers.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.muted }]}>
                <Text style={{ color: colors.mutedForeground }}>No members yet.</Text>
              </View>
            ) : (
              allMembers.map((m) => (
                <View
                  key={m.id}
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 10 }]}
                >
                  <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                      {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]}>{m.name}</Text>
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {m.streamName} · {m.teamName}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => router.push({ pathname: "/team/[id]", params: { id: m.teamId } })}
                  >
                    <Feather name="external-link" size={14} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() =>
                      confirm(`Remove "${m.name}"?`, () =>
                        deleteMember.mutate(
                          { id: m.id },
                          {
                            onSuccess: () =>
                              qc.invalidateQueries({ queryKey: getListTeamMembersQueryKey(m.teamId) }),
                          },
                        ),
                      )
                    }
                  >
                    <Feather name="trash-2" size={14} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              ))
            )}
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Members are roster entries — they don't log in.
            </Text>
          </>
        ) : null}

        {tab === "events" ? (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Events ({events.length})</Text>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/new-event")}
              >
                <Feather name="plus" size={12} color="#fff" />
                <Text style={[styles.smallBtnText, { color: "#fff" }]}>Event</Text>
              </TouchableOpacity>
            </View>
            {eventsQ.isError ? (
              <ErrorBanner error={eventsQ.error} onRetry={() => eventsQ.refetch()} />
            ) : null}
            {eventsQ.isLoading ? <LoadingRow /> : null}
            {events.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.muted }]}>
                <Text style={{ color: colors.mutedForeground }}>No events.</Text>
              </View>
            ) : (
              events
                .slice()
                .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))
                .map((ev) => {
                  const d = new Date(ev.startDate);
                  const teamId = ev.invitedTeamIds[0] ?? ev.createdByTeamId ?? null;
                  return (
                    <View key={ev.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 10 }]}>
                      <View style={[styles.dateBox, { backgroundColor: colors.primary + "15" }]}>
                        <Text style={[styles.dateBoxDay, { color: colors.primary }]}>{d.getDate()}</Text>
                        <Text style={[styles.dateBoxMo, { color: colors.primary }]}>
                          {d.toLocaleDateString([], { month: "short" })}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{ev.title}</Text>
                        <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                          {ev.isAllDay ? "All day" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {teamLabel(teamId)}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => router.push({ pathname: "/event/[id]", params: { id: ev.id } })}
                      >
                        <Feather name="external-link" size={14} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => confirm(`Delete event "${ev.title}"?`, () => deleteEvent.mutate({ id: ev.id }))}
                      >
                        <Feather name="trash-2" size={14} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  );
                })
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { paddingVertical: 12, paddingHorizontal: 18, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  smallBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  card: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8, overflow: "hidden", gap: 8 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  cardBody: { paddingHorizontal: 10, paddingBottom: 10, gap: 6 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  iconBtn: { width: 28, height: 28, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  subRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderRadius: 8, borderWidth: 1 },
  subTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  empty: { padding: 16, borderRadius: 10, alignItems: "center" },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  roleChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  roleChipText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  hint: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 12 },
  dateBox: { width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  dateBoxDay: { fontSize: 16, fontFamily: "Inter_700Bold" },
  dateBoxMo: { fontSize: 9, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  input: { padding: 10, borderRadius: 8, borderWidth: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
});
