import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  useListProgrammes,
  useListProjects,
  useListStreams,
  useListTeams,
  useListUsers,
} from "@workspace/api-client-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingRow } from "@/components/LoadingRow";
import { useColors } from "@/hooks/useColors";
import {
  canManageEverything,
  canManageStream,
  teamVisibility,
  useMe,
} from "@/lib/permissions";

export default function ProgrammeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useMe();

  const programmesQ = useListProgrammes();
  const streamsQ = useListStreams();
  const teamsQ = useListTeams();
  const projectsQ = useListProjects();
  const usersQ = useListUsers();
  const programmes = programmesQ.data ?? [];
  const streams = streamsQ.data ?? [];
  const teams = teamsQ.data ?? [];
  const projects = projectsQ.data ?? [];
  const users = usersQ.data ?? [];

  const [expandedStreamId, setExpandedStreamId] = useState<string | null>(null);
  const [expandedProgrammes, setExpandedProgrammes] = useState<Set<string>>(
    () => new Set(),
  );
  const didInit = useRef(false);
  const didInitProgrammes = useRef(false);

  const teamsByStream = useMemo(() => {
    const m = new Map<string, typeof teams>();
    for (const t of teams) {
      const k = t.streamId ?? "";
      if (!k) continue;
      const arr = m.get(k) ?? [];
      arr.push(t);
      m.set(k, arr);
    }
    return m;
  }, [teams]);

  const projectsByTeam = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of projects) m.set(p.teamId, (m.get(p.teamId) ?? 0) + 1);
    return m;
  }, [projects]);

  // Streams the current user is allowed to see at all.
  // - admin: see every stream.
  // - stream_overseer / leader: see only their own stream (always, even
  //   when it has no teams). Inside that stream, teamVisibility decides
  //   whether each team is `full` or `locked`.
  const visibleStreams = useMemo(() => {
    if (me?.role === "leader" || me?.role === "stream_overseer") {
      return me.streamId ? streams.filter((s) => s.id === me.streamId) : [];
    }
    return streams;
  }, [streams, me]);

  useEffect(() => {
    if (!didInit.current && visibleStreams.length > 0) {
      didInit.current = true;
      const own = me?.streamId
        ? visibleStreams.find((s) => s.id === me.streamId)
        : null;
      setExpandedStreamId(own ? own.id : visibleStreams[0].id);
    }
  }, [visibleStreams, me]);

  function toggle(id: string) {
    setExpandedStreamId((cur) => (cur === id ? null : id));
  }

  function toggleProgramme(id: string) {
    setExpandedProgrammes((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const isAdmin = canManageEverything(me);
  const loading = streamsQ.isLoading || teamsQ.isLoading || programmesQ.isLoading;

  // Group visible streams by programme. Programmes with no visible
  // streams are skipped (overseers/leaders only see their own stream's
  // programme). When there is exactly one programme, hide the header
  // so the tab looks identical to before.
  const grouped = useMemo(() => {
    const byId = new Map<string, typeof visibleStreams>();
    for (const s of visibleStreams) {
      const arr = byId.get(s.programmeId) ?? [];
      arr.push(s);
      byId.set(s.programmeId, arr);
    }
    return programmes
      .filter((p) => (byId.get(p.id) ?? []).length > 0)
      .map((p) => ({ programme: p, streams: byId.get(p.id) ?? [] }));
  }, [programmes, visibleStreams]);
  const showProgrammeHeaders = programmes.length > 1;

  // First time we have data, auto-expand the user's own programme (the
  // one containing their stream) so they don't have to tap to find it.
  // Admins / users without a stream see all programmes collapsed.
  useEffect(() => {
    if (didInitProgrammes.current || !showProgrammeHeaders || grouped.length === 0) return;
    didInitProgrammes.current = true;
    const ownProgrammeId = me?.streamId
      ? streams.find((s) => s.id === me.streamId)?.programmeId
      : null;
    if (ownProgrammeId && grouped.some((g) => g.programme.id === ownProgrammeId)) {
      setExpandedProgrammes(new Set([ownProgrammeId]));
    }
  }, [grouped, me, streams, showProgrammeHeaders]);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: 100 }]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Programme</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {visibleStreams.length} stream{visibleStreams.length !== 1 ? "s" : ""}
          </Text>
        </View>
        {isAdmin ? (
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/new-stream")}
          >
            <Feather name="plus" size={14} color="#fff" />
            <Text style={styles.headerBtnText}>Stream</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {streamsQ.isError ? (
        <ErrorBanner error={streamsQ.error} onRetry={() => streamsQ.refetch()} />
      ) : null}

      {loading ? (
        <LoadingRow />
      ) : visibleStreams.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.muted }]}>
          <Feather name="layers" size={28} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No streams yet. {isAdmin ? "Tap + Stream above to begin." : "Ask an admin to create one."}
          </Text>
        </View>
      ) : (
        grouped.map(({ programme, streams: progStreams }) => {
          const programmeExpanded =
            !showProgrammeHeaders || expandedProgrammes.has(programme.id);
          return (
          <View key={programme.id} style={{ marginBottom: showProgrammeHeaders ? 12 : 0 }}>
            {showProgrammeHeaders ? (
              <TouchableOpacity
                style={[
                  styles.programmeHeader,
                  {
                    backgroundColor: colors.muted,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => toggleProgramme(programme.id)}
                activeOpacity={0.7}
              >
                <Feather
                  name={programmeExpanded ? "chevron-down" : "chevron-right"}
                  size={16}
                  color={colors.mutedForeground}
                />
                <Text style={[styles.programmeName, { color: colors.foreground, flex: 1 }]}>
                  {programme.name}
                </Text>
                <Text style={[styles.programmeMeta, { color: colors.mutedForeground }]}>
                  {progStreams.length} stream{progStreams.length !== 1 ? "s" : ""}
                </Text>
              </TouchableOpacity>
            ) : null}
            {programmeExpanded ? progStreams.map((stream) => {
              const expanded = expandedStreamId === stream.id;
              const allTeamsHere = teamsByStream.get(stream.id) ?? [];
              const visibleTeamsHere = allTeamsHere.filter(
                (t) => teamVisibility(me, t, stream.programmeId) !== "hidden",
              );
              const canAddTeamHere = canManageStream(me, { id: stream.id, programmeId: stream.programmeId });
              return (
                <View
                  key={stream.id}
                  style={[styles.streamCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <TouchableOpacity
                    style={styles.streamHeader}
                    onPress={() => toggle(stream.id)}
                    activeOpacity={0.85}
                  >
                    <Feather
                      name={expanded ? "chevron-down" : "chevron-right"}
                      size={18}
                      color={colors.mutedForeground}
                    />
                    <View style={[styles.streamDot, { backgroundColor: colors.primary }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.streamName, { color: colors.foreground }]}>{stream.name}</Text>
                      <Text style={[styles.streamMeta, { color: colors.mutedForeground }]}>
                        {visibleTeamsHere.length} team{visibleTeamsHere.length !== 1 ? "s" : ""}
                      </Text>
                    </View>
                    <TouchableOpacity
                      hitSlop={8}
                      onPress={() => router.push({ pathname: "/stream/[id]", params: { id: stream.id } })}
                      style={styles.openBtn}
                    >
                      <Feather name="external-link" size={15} color={colors.primary} />
                    </TouchableOpacity>
                  </TouchableOpacity>

                  {expanded ? (
                    <View style={styles.streamBody}>
                      {visibleTeamsHere.length === 0 ? (
                        <Text style={[styles.muted, { color: colors.mutedForeground }]}>
                          No teams in this stream yet.
                        </Text>
                      ) : (
                        visibleTeamsHere.map((team) => {
                          const vis = teamVisibility(me, team, stream.programmeId);
                          const teamLeaderId = team.leaderIds?.[0] ?? null;
                          const leader = teamLeaderId
                            ? users.find((u) => u.id === teamLeaderId)
                            : null;
                          const leaderLabel = leader?.name ?? "Unassigned";
                          if (vis === "locked") {
                            return (
                              <View
                                key={team.id}
                                style={[styles.teamRow, { borderColor: colors.border, opacity: 0.85 }]}
                              >
                                <View style={[styles.teamIcon, { backgroundColor: colors.muted }]}>
                                  <Feather name="users" size={14} color={colors.mutedForeground} />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.teamName, { color: colors.foreground }]}>{team.name}</Text>
                                  <Text style={[styles.teamMeta, { color: colors.mutedForeground }]}>
                                    Leader: {leaderLabel}
                                  </Text>
                                </View>
                                <Feather name="lock" size={14} color={colors.mutedForeground} />
                              </View>
                            );
                          }
                          const pCount = projectsByTeam.get(team.id) ?? 0;
                          return (
                            <TouchableOpacity
                              key={team.id}
                              style={[styles.teamRow, { borderColor: colors.border }]}
                              onPress={() => router.push({ pathname: "/team/[id]", params: { id: team.id } })}
                              activeOpacity={0.7}
                            >
                              <View style={[styles.teamIcon, { backgroundColor: colors.primary + "15" }]}>
                                <Feather name="users" size={14} color={colors.primary} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.teamName, { color: colors.foreground }]}>{team.name}</Text>
                                <Text style={[styles.teamMeta, { color: colors.mutedForeground }]}>
                                  {pCount} project{pCount !== 1 ? "s" : ""}
                                </Text>
                              </View>
                              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                            </TouchableOpacity>
                          );
                        })
                      )}
                      {canAddTeamHere ? (
                        <TouchableOpacity
                          style={[styles.addInline, { borderColor: colors.border }]}
                          onPress={() => router.push({ pathname: "/new-team", params: { streamId: stream.id } })}
                        >
                          <Feather name="plus" size={14} color={colors.primary} />
                          <Text style={[styles.addInlineText, { color: colors.primary }]}>Add team</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            }) : null}
          </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20 },
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
  },
  headerBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  programmeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  programmeName: { fontSize: 13, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.6 },
  programmeMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  empty: { padding: 32, alignItems: "center", borderRadius: 12, gap: 8 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  streamCard: { borderWidth: 1, borderRadius: 12, marginBottom: 8, overflow: "hidden" },
  streamHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  streamDot: { width: 10, height: 10, borderRadius: 5 },
  streamName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  streamMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  openBtn: { padding: 6 },
  streamBody: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  muted: { fontSize: 13, fontFamily: "Inter_400Regular", padding: 8, textAlign: "center" },
  teamRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 10, borderRadius: 8, borderWidth: 1,
  },
  teamIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  teamName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  teamMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  addInline: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderStyle: "dashed",
  },
  addInlineText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
