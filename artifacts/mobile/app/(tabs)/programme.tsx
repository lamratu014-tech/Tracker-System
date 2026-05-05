import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Team, Stream } from "@/context/DataContext";
import { useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { StatusBadge } from "@/components/StatusBadge";

function getTeamStatus(tasks: { status: string }[]): { label: string; color: string } {
  if (tasks.length === 0) return { label: "No Tasks", color: "#64748B" };
  const atRisk = tasks.filter((t) => t.status === "at_risk").length;
  const done = tasks.filter((t) => t.status === "done").length;
  if (atRisk > 0) return { label: "At Risk", color: "#F59E0B" };
  if (done === tasks.length) return { label: "Completed", color: "#10B981" };
  return { label: "On Track", color: "#3B82F6" };
}

function TeamCard({
  team,
  canAccess,
  taskCount,
  doneCount,
  atRiskCount,
  onPress,
}: {
  team: Team;
  canAccess: boolean;
  taskCount: number;
  doneCount: number;
  atRiskCount: number;
  onPress: () => void;
}) {
  const colors = useColors();
  const progress = taskCount > 0 ? doneCount / taskCount : 0;
  const statusColor = atRiskCount > 0 ? "#F59E0B" : taskCount > 0 && doneCount === taskCount ? "#10B981" : "#3B82F6";
  const statusLabel = atRiskCount > 0 ? "At Risk" : taskCount > 0 && doneCount === taskCount ? "Completed" : "On Track";

  if (!canAccess) {
    return (
      <View style={[styles.teamCard, styles.lockedCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <View style={styles.teamCardHeader}>
          <View style={styles.teamCardLeft}>
            <View style={[styles.lockIcon, { backgroundColor: colors.border }]}>
              <Feather name="lock" size={12} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.teamCardName, { color: colors.mutedForeground }]} numberOfLines={1}>{team.name}</Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        </View>
        <View style={styles.teamCardProgress}>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: statusColor + "60" }]} />
          </View>
          <Text style={[styles.progressText, { color: colors.mutedForeground }]}>{doneCount}/{taskCount}</Text>
        </View>
        <Text style={[styles.lockedLabel, { color: colors.mutedForeground }]}>
          <Feather name="eye-off" size={10} /> Restricted Access
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.teamCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.teamCardHeader}>
        <View style={styles.teamCardLeft}>
          <View style={[styles.teamIcon, { backgroundColor: colors.primary + "20" }]}>
            <Feather name="users" size={12} color={colors.primary} />
          </View>
          <Text style={[styles.teamCardName, { color: colors.foreground }]} numberOfLines={1}>{team.name}</Text>
        </View>
        <View style={styles.teamStatusRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>
      {team.functionLabel ? (
        <Text style={[styles.teamFunction, { color: colors.mutedForeground }]}>{team.functionLabel}</Text>
      ) : null}
      <View style={styles.teamCardProgress}>
        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: statusColor }]} />
        </View>
        <Text style={[styles.progressText, { color: colors.mutedForeground }]}>{doneCount}/{taskCount}</Text>
      </View>
      <Feather name="chevron-right" size={14} color={colors.mutedForeground} style={{ alignSelf: "flex-end" }} />
    </TouchableOpacity>
  );
}

export default function ProgrammeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isProgrammeLead, currentUser } = useAuth();
  const { programme, streams, teams, tasks, projects } = useData();

  // Only one stream expanded at a time. Default: first stream expanded on first load.
  const [expandedStreamId, setExpandedStreamId] = useState<string | null>(null);
  const [unassignedExpanded, setUnassignedExpanded] = useState(false);
  const didInitExpandRef = React.useRef(false);
  React.useEffect(() => {
    if (!didInitExpandRef.current && streams.length > 0) {
      didInitExpandRef.current = true;
      setExpandedStreamId(streams[0].id);
    }
  }, [streams]);
  function toggleStream(id: string) {
    setUnassignedExpanded(false);
    setExpandedStreamId((cur) => (cur === id ? null : id));
  }
  function toggleUnassigned() {
    setExpandedStreamId(null);
    setUnassignedExpanded((v) => !v);
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const tabBarH = Platform.OS === "web" ? 84 : Platform.OS === "ios" ? 49 : 56;
  const botPad = (Platform.OS === "web" ? 0 : insets.bottom) + tabBarH + 24;

  const allTasksForTeam = useMemo(() => {
    const map: Record<string, { total: number; done: number; atRisk: number }> = {};
    teams.forEach((t) => { map[t.id] = { total: 0, done: 0, atRisk: 0 }; });
    projects.forEach((p) => {
      const teamTasks = tasks.filter((t) => t.projectId === p.id);
      if (!map[p.teamId]) map[p.teamId] = { total: 0, done: 0, atRisk: 0 };
      map[p.teamId].total += teamTasks.length;
      map[p.teamId].done += teamTasks.filter((t) => t.status === "done").length;
      map[p.teamId].atRisk += teamTasks.filter((t) => t.status === "at_risk").length;
    });
    return map;
  }, [teams, projects, tasks]);

  const unassignedTeams = teams.filter((t) => !t.streamId);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.navyDark, paddingTop: topPad + 16 }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerLabel}>{programme?.name ?? "Programme"}</Text>
            <Text style={styles.headerTitle}>Programme View</Text>
          </View>
          {isProgrammeLead && (
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => router.push("/new-stream")}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.summaryRow}>
          {[
            { label: "Streams", count: streams.length, color: "#94A3B8" },
            { label: "Teams", count: teams.length, color: "#3B82F6" },
            { label: "At Risk", count: Object.values(allTasksForTeam).reduce((a, v) => a + (v.atRisk > 0 ? 1 : 0), 0), color: "#F59E0B" },
            { label: "Complete", count: Object.values(allTasksForTeam).filter((v) => v.total > 0 && v.done === v.total).length, color: "#10B981" },
          ].map((s) => (
            <View key={s.label} style={styles.summaryPill}>
              <Text style={[styles.summaryCount, { color: s.color }]}>{s.count}</Text>
              <Text style={styles.summaryLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: botPad, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {streams.length === 0 && teams.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.muted }]}>
            <Feather name="grid" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Streams yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {isProgrammeLead ? "Create your first Stream to organise your Teams." : "Streams will appear here once created."}
            </Text>
            {isProgrammeLead && (
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/new-stream")}
              >
                <Text style={styles.emptyBtnText}>New Stream</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {streams.map((stream) => {
          const streamTeams = teams.filter((t) => t.streamId === stream.id);
          const expanded = expandedStreamId === stream.id;
          return (
            <View key={stream.id} style={[styles.streamCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.streamHeader}
                onPress={() => toggleStream(stream.id)}
                activeOpacity={0.8}
              >
                <Feather
                  name={expanded ? "chevron-down" : "chevron-right"}
                  size={18}
                  color={colors.mutedForeground}
                />
                <View style={[styles.streamDot, { backgroundColor: colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.streamName, { color: colors.foreground }]}>{stream.name}</Text>
                  {stream.description ? (
                    <Text style={[styles.streamDesc, { color: colors.mutedForeground }]} numberOfLines={1}>{stream.description}</Text>
                  ) : null}
                </View>
                <Text style={[styles.teamCount, { color: colors.mutedForeground }]}>{streamTeams.length} team{streamTeams.length !== 1 ? "s" : ""}</Text>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); router.push({ pathname: "/stream/[id]", params: { id: stream.id } }); }}
                  style={styles.streamIconBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="external-link" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
                {isProgrammeLead && (
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); router.push("/new-team"); }}
                    style={styles.streamIconBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="plus" size={16} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {expanded && (
                <View style={styles.streamBody}>
                  {streamTeams.length === 0 ? (
                    <View style={[styles.emptyStream, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                      <Text style={[styles.emptyStreamText, { color: colors.mutedForeground }]}>No teams in this stream yet</Text>
                    </View>
                  ) : (
                    <View style={styles.teamGrid}>
                      {streamTeams.map((team) => {
                        const stats = allTasksForTeam[team.id] ?? { total: 0, done: 0, atRisk: 0 };
                        const canAccess = isProgrammeLead || currentUser?.teamId === team.id;
                        return (
                          <TeamCard
                            key={team.id}
                            team={team}
                            canAccess={canAccess}
                            taskCount={stats.total}
                            doneCount={stats.done}
                            atRiskCount={stats.atRisk}
                            onPress={() => router.push({ pathname: "/team/[id]", params: { id: team.id } })}
                          />
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {unassignedTeams.length > 0 && (
          <View style={[styles.streamCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.streamHeader}
              onPress={toggleUnassigned}
              activeOpacity={0.8}
            >
              <Feather
                name={unassignedExpanded ? "chevron-down" : "chevron-right"}
                size={18}
                color={colors.mutedForeground}
              />
              <View style={[styles.streamDot, { backgroundColor: colors.mutedForeground }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.streamName, { color: colors.foreground }]}>Unassigned Teams</Text>
              </View>
              <Text style={[styles.teamCount, { color: colors.mutedForeground }]}>{unassignedTeams.length}</Text>
            </TouchableOpacity>
            {unassignedExpanded && (
              <View style={styles.streamBody}>
                <View style={styles.teamGrid}>
                  {unassignedTeams.map((team) => {
                    const stats = allTasksForTeam[team.id] ?? { total: 0, done: 0, atRisk: 0 };
                    const canAccess = isProgrammeLead || currentUser?.teamId === team.id;
                    return (
                      <TeamCard
                        key={team.id}
                        team={team}
                        canAccess={canAccess}
                        taskCount={stats.total}
                        doneCount={stats.done}
                        atRiskCount={stats.atRisk}
                        onPress={() => router.push({ pathname: "/team/[id]", params: { id: team.id } })}
                      />
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 },
  headerLabel: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 2 },
  headerTitle: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold" },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  summaryRow: { flexDirection: "row", gap: 8 },
  summaryPill: { flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  summaryCount: { fontSize: 18, fontFamily: "Inter_700Bold" },
  summaryLabel: { color: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 1 },
  streamCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  streamHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 12 },
  streamBody: { paddingHorizontal: 10, paddingBottom: 10 },
  streamDot: { width: 8, height: 8, borderRadius: 4 },
  streamName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  streamDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  teamCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  streamIconBtn: { padding: 4 },
  teamGrid: { gap: 8 },
  teamCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
  lockedCard: { opacity: 0.75 },
  teamCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  teamCardLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  teamIcon: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  lockIcon: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  teamCardName: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  teamStatusRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  teamFunction: { fontSize: 12, fontFamily: "Inter_400Regular" },
  teamCardProgress: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressTrack: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  progressText: { fontSize: 11, fontFamily: "Inter_500Medium", minWidth: 28, textAlign: "right" },
  lockedLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  emptyStream: { borderRadius: 10, borderWidth: 1, padding: 16, alignItems: "center", marginBottom: 8 },
  emptyStreamText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  empty: { borderRadius: 16, padding: 32, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  emptyBtn: { borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8, marginTop: 8 },
  emptyBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
