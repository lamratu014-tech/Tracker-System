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
  useUpdateStream,
  useUpdateTeam,
  useUpdateUserRole,
} from "@workspace/api-client-react";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Keyboard,
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
import { useMe } from "@/lib/permissions";
import type { Role } from "@/models/types";

type AdminTab = "structure" | "programmes" | "users" | "members" | "events";

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  programme_overseer: "Prog. Overseer",
  stream_overseer: "Overseer",
  leader: "Leader",
  team_admin: "Team Admin",
};

const ROLE_COLOR: Record<Role, string> = {
  admin: "#7C3AED",
  programme_overseer: "#6366F1",
  stream_overseer: "#0EA5E9",
  leader: "#2563EB",
  team_admin: "#0EA5E9",
};

const ROLE_ORDER: Role[] = ["admin", "programme_overseer", "stream_overseer", "leader", "team_admin"];

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Full access everywhere — every programme, stream, team, user.",
  programme_overseer: "Full access inside one programme. Can't invite admins or other programme overseers.",
  stream_overseer: "Full access inside one stream — every team in that stream.",
  leader: "Manages one or more teams. Can add/remove leaders and team admins of teams they lead.",
  team_admin: "Same day-to-day powers as a leader on assigned teams, but can't change who the managers are.",
};

export default function AdminPanelScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const dialog = useDialog();

  async function confirm(message: string, onYes: () => void) {
    const ok = await dialog.confirm({
      title: "Confirm",
      message,
      destructive: true,
      confirmText: "Yes",
    });
    if (ok) onYes();
  }

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

  async function promptRename(p: { id: string; name: string }) {
    const next = await dialog.prompt({
      title: "Rename programme",
      defaultValue: p.name,
      placeholder: "Programme name",
      confirmText: "Save",
    });
    if (next && next.trim() && next.trim() !== p.name) {
      updateProgramme.mutate({ id: p.id, data: { name: next.trim() } });
    }
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
  const updateStream = useUpdateStream({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListStreamsQueryKey() }) },
  });
  const updateTeam = useUpdateTeam({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListTeamsQueryKey() }) },
  });
  const deleteEvent = useDeleteEvent({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListEventsQueryKey() }) },
  });
  const deleteMember = useDeleteMember();

  const [tab, setTab] = useState<AdminTab>("structure");
  const [structureView, setStructureView] = useState<{ programmeId: string | null; streamId: string | null }>({
    programmeId: null,
    streamId: null,
  });

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

  function applyRoleChange(
    userId: string,
    next: Role,
    overrides?: { programmeId?: string; streamId?: string; teamIds?: string[] },
  ) {
    const u = users.find((x) => x.id === userId);
    if (!u) return;
    updateUserRole.mutate({
      id: userId,
      data: {
        role: next,
        programmeId: overrides?.programmeId ?? u.programmeId ?? undefined,
        streamId: overrides?.streamId ?? u.streamId ?? undefined,
        teamIds:
          overrides?.teamIds ??
          [...(u.leaderTeamIds ?? []), ...(u.teamAdminTeamIds ?? [])],
      },
    });
  }

  async function pickProgrammeForRole(): Promise<string | null> {
    if (programmes.length === 0) {
      await dialog.confirm({
        title: "No programmes",
        message: "Create a programme first, then come back and assign this role.",
        confirmText: "OK",
      });
      return null;
    }
    return dialog.choice<string>({
      title: "Pick a programme",
      message: "Choose which programme this overseer manages.",
      options: programmes.map((p) => ({ label: p.name, value: p.id })),
    });
  }

  async function pickStreamForRole(): Promise<string | null> {
    if (streams.length === 0) {
      await dialog.confirm({
        title: "No streams",
        message: "Create a stream first, then come back and assign this role.",
        confirmText: "OK",
      });
      return null;
    }
    return dialog.choice<string>({
      title: "Pick a stream",
      message: "Choose which stream this overseer manages.",
      options: streams.map((s) => {
        const prog = programmes.find((p) => p.id === s.programmeId);
        return { label: prog ? `${prog.name}  ·  ${s.name}` : s.name, value: s.id };
      }),
    });
  }

  async function pickTeamForRole(): Promise<string | null> {
    if (teams.length === 0) {
      await dialog.confirm({
        title: "No teams",
        message: "Create a team first, then come back and assign this role.",
        confirmText: "OK",
      });
      return null;
    }
    return dialog.choice<string>({
      title: "Pick a team",
      message: "Choose a team for this person to manage. You can add them to more teams later from the team page.",
      options: teams.map((t) => {
        const s = streams.find((x) => x.id === t.streamId);
        return { label: s ? `${s.name}  ·  ${t.name}` : t.name, value: t.id };
      }),
    });
  }

  async function changeRole(userId: string, currentRole: Role) {
    const u = users.find((x) => x.id === userId);
    if (!u) return;
    const next = await dialog.choice<Role>({
      title: `Change role for ${u.name}`,
      message: `Currently ${ROLE_LABEL[currentRole]}. Pick a new role — only admins can do this.`,
      options: ROLE_ORDER.map((r) => ({
        label: `${ROLE_LABEL[r]}${r === currentRole ? "  (current)" : ""}\n${ROLE_DESCRIPTIONS[r]}`,
        value: r,
      })),
    });
    if (!next || next === currentRole) return;

    if (next === "programme_overseer") {
      const programmeId = await pickProgrammeForRole();
      if (!programmeId) return;
      applyRoleChange(userId, next, { programmeId });
      return;
    }
    if (next === "stream_overseer") {
      const streamId = u.streamId ?? (await pickStreamForRole());
      if (!streamId) return;
      applyRoleChange(userId, next, { streamId });
      return;
    }
    if (next === "leader" || next === "team_admin") {
      const hasTeam =
        (u.leaderTeamIds?.length ?? 0) > 0 || (u.teamAdminTeamIds?.length ?? 0) > 0;
      if (!hasTeam) {
        const teamId = await pickTeamForRole();
        if (!teamId) return;
        applyRoleChange(userId, next, { teamIds: [teamId] });
        return;
      }
      applyRoleChange(userId, next);
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
          <StructureDrillDown
            colors={colors}
            view={structureView}
            setView={setStructureView}
            programmes={programmes}
            streams={streams}
            teams={teams}
            streamsLoading={streamsQ.isLoading}
            streamsError={streamsQ.isError ? streamsQ.error : null}
            onStreamsRetry={() => streamsQ.refetch()}
            promptRenameStream={async (s) => {
              const next = await dialog.prompt({
                title: "Rename stream",
                defaultValue: s.name,
                placeholder: "Stream name",
                confirmText: "Save",
              });
              if (next && next.trim() && next.trim() !== s.name) {
                updateStream.mutate({ id: s.id, data: { name: next.trim() } });
              }
            }}
            promptRenameTeam={async (t) => {
              const next = await dialog.prompt({
                title: "Rename team",
                defaultValue: t.name,
                placeholder: "Team name",
                confirmText: "Save",
              });
              if (next && next.trim() && next.trim() !== t.name) {
                updateTeam.mutate({ id: t.id, data: { name: next.trim() } });
              }
            }}
            onDeleteStream={(s) =>
              confirm(`Delete stream "${s.name}"? Teams and projects inside will be removed too.`, () =>
                deleteStream.mutate({ id: s.id }),
              )
            }
            onDeleteTeam={(t) =>
              confirm(`Delete team "${t.name}"?`, () => deleteTeam.mutate({ id: t.id }))
            }
            onAddStream={(programmeId) =>
              router.push({ pathname: "/new-stream", params: { programmeId } })
            }
            onAddTeam={(streamId) =>
              router.push({ pathname: "/new-team", params: { streamId } })
            }
            onOpenStream={(id) => router.push({ pathname: "/stream/[id]", params: { id } })}
            onOpenTeam={(id) => router.push({ pathname: "/team/[id]", params: { id } })}
          />
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
                    : teamLabel(u.leaderTeamIds?.[0] ?? u.teamAdminTeamIds?.[0] ?? null);
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
                      style={[styles.roleChip, { backgroundColor: ROLE_COLOR[role], flexDirection: "row", alignItems: "center", gap: 4 }]}
                      onPress={() => changeRole(u.id, role)}
                      hitSlop={6}
                      accessibilityLabel={`Change role for ${u.name}`}
                    >
                      <Text style={styles.roleChipText}>{ROLE_LABEL[role]}</Text>
                      <Feather name="edit-2" size={9} color="#fff" />
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
              Tap a role chip to change someone's primary login role. Only admins see this.
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

type Programme = { id: string; name: string };
type StreamLite = { id: string; name: string; programmeId: string };
type TeamLite = { id: string; name: string; streamId?: string | null };

function StructureDrillDown({
  colors,
  view,
  setView,
  programmes,
  streams,
  teams,
  streamsLoading,
  streamsError,
  onStreamsRetry,
  promptRenameStream,
  promptRenameTeam,
  onDeleteStream,
  onDeleteTeam,
  onAddStream,
  onAddTeam,
  onOpenStream,
  onOpenTeam,
}: {
  colors: ReturnType<typeof useColors>;
  view: { programmeId: string | null; streamId: string | null };
  setView: (v: { programmeId: string | null; streamId: string | null }) => void;
  programmes: Programme[];
  streams: StreamLite[];
  teams: TeamLite[];
  streamsLoading: boolean;
  streamsError: unknown;
  onStreamsRetry: () => void;
  promptRenameStream: (s: StreamLite) => void;
  promptRenameTeam: (t: TeamLite) => void;
  onDeleteStream: (s: StreamLite) => void;
  onDeleteTeam: (t: TeamLite) => void;
  onAddStream: (programmeId: string) => void;
  onAddTeam: (streamId: string) => void;
  onOpenStream: (id: string) => void;
  onOpenTeam: (id: string) => void;
}) {
  const programme = view.programmeId ? programmes.find((p) => p.id === view.programmeId) ?? null : null;
  const stream = view.streamId ? streams.find((s) => s.id === view.streamId) ?? null : null;

  // Programmes level
  if (!programme) {
    return (
      <>
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Programmes ({programmes.length})
          </Text>
        </View>
        {programmes.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.muted }]}>
            <Text style={{ color: colors.mutedForeground }}>
              No programmes yet. Add one on the Programmes tab.
            </Text>
          </View>
        ) : (
          programmes.map((p) => {
            const pStreams = streams.filter((s) => s.programmeId === p.id);
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 10 }]}
                onPress={() => setView({ programmeId: p.id, streamId: null })}
                activeOpacity={0.85}
              >
                <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{p.name}</Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                    {pStreams.length} stream{pStreams.length !== 1 ? "s" : ""}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            );
          })
        )}
      </>
    );
  }

  // Streams level (inside a programme)
  if (!stream) {
    const pStreams = streams.filter((s) => s.programmeId === programme.id);
    return (
      <>
        <View style={[styles.sectionRow, { gap: 8 }]}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setView({ programmeId: null, streamId: null })}
            accessibilityLabel="Back to programmes"
          >
            <Feather name="chevron-left" size={20} color={colors.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>Programme</Text>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]} numberOfLines={1}>
              {programme.name}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.smallBtn, { backgroundColor: colors.primary }]}
            onPress={() => onAddStream(programme.id)}
          >
            <Feather name="plus" size={12} color="#fff" />
            <Text style={[styles.smallBtnText, { color: "#fff" }]}>Stream</Text>
          </TouchableOpacity>
        </View>
        {streamsError ? <ErrorBanner error={streamsError} onRetry={onStreamsRetry} /> : null}
        {streamsLoading ? <LoadingRow /> : null}
        {pStreams.length === 0 && !streamsLoading ? (
          <View style={[styles.empty, { backgroundColor: colors.muted }]}>
            <Text style={{ color: colors.mutedForeground }}>No streams in this programme yet.</Text>
          </View>
        ) : (
          pStreams.map((s) => {
            const sTeams = teams.filter((t) => t.streamId === s.id);
            return (
              <View
                key={s.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 8 }]}
              >
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}
                  onPress={() => setView({ programmeId: programme.id, streamId: s.id })}
                  activeOpacity={0.85}
                >
                  <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]}>{s.name}</Text>
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                      {sTeams.length} team{sTeams.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => promptRenameStream(s)}>
                  <Feather name="edit-2" size={13} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => onOpenStream(s.id)}>
                  <Feather name="external-link" size={13} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => onDeleteStream(s)}>
                  <Feather name="trash-2" size={13} color="#DC2626" />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </>
    );
  }

  // Teams level (inside a stream)
  const sTeams = teams.filter((t) => t.streamId === stream.id);
  return (
    <>
      <View style={[styles.sectionRow, { gap: 8 }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setView({ programmeId: programme.id, streamId: null })}
          accessibilityLabel="Back to streams"
        >
          <Feather name="chevron-left" size={20} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
            {programme.name}  ·  Stream
          </Text>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]} numberOfLines={1}>
            {stream.name}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.smallBtn, { backgroundColor: colors.primary }]}
          onPress={() => onAddTeam(stream.id)}
        >
          <Feather name="plus" size={12} color="#fff" />
          <Text style={[styles.smallBtnText, { color: "#fff" }]}>Team</Text>
        </TouchableOpacity>
      </View>
      {sTeams.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.muted }]}>
          <Text style={{ color: colors.mutedForeground }}>No teams in this stream yet.</Text>
        </View>
      ) : (
        sTeams.map((t) => (
          <View
            key={t.id}
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 8 }]}
          >
            <TouchableOpacity
              style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}
              onPress={() => onOpenTeam(t.id)}
              activeOpacity={0.85}
            >
              <Feather name="users" size={14} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.foreground, flex: 1 }]}>{t.name}</Text>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => promptRenameTeam(t)}>
              <Feather name="edit-2" size={13} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => onDeleteTeam(t)}>
              <Feather name="trash-2" size={13} color="#DC2626" />
            </TouchableOpacity>
          </View>
        ))
      )}
    </>
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
