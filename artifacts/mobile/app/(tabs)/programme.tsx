import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { isOverdue } from "@/models/types";
import { canManageEverything, useCurrentUser, useStore } from "@/store/useStore";

export default function ProgrammeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useCurrentUser();
  const streams = useStore((s) => s.streams);

  const [expandedStreamId, setExpandedStreamId] = useState<string | null>(null);
  const didInitRef = useRef(false);

  useEffect(() => {
    if (!didInitRef.current && streams.length > 0) {
      didInitRef.current = true;
      setExpandedStreamId(streams[0].id);
    }
  }, [streams]);

  function toggle(id: string) {
    setExpandedStreamId((cur) => (cur === id ? null : id));
  }

  const isAdmin = canManageEverything(me);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: 100 }]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Programme</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {streams.length} stream{streams.length !== 1 ? "s" : ""} · {streams.reduce((n, s) => n + s.teams.length, 0)} teams
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

      {streams.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.muted }]}>
          <Feather name="layers" size={28} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            No streams yet. {isAdmin ? "Tap + Stream above to begin." : "Ask an admin to create one."}
          </Text>
        </View>
      ) : (
        streams.map((stream) => {
          const expanded = expandedStreamId === stream.id;
          const allMilestones = stream.teams.flatMap((t) => t.projects.flatMap((p) => p.milestones));
          const completed = allMilestones.filter((m) => m.status === "completed").length;
          const overdue = allMilestones.filter((m) => isOverdue(m)).length;

          return (
            <View key={stream.id} style={[styles.streamCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity style={styles.streamHeader} onPress={() => toggle(stream.id)} activeOpacity={0.85}>
                <Feather
                  name={expanded ? "chevron-down" : "chevron-right"}
                  size={18}
                  color={colors.mutedForeground}
                />
                <View style={[styles.streamDot, { backgroundColor: colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.streamName, { color: colors.foreground }]}>{stream.name}</Text>
                  <Text style={[styles.streamMeta, { color: colors.mutedForeground }]}>
                    {stream.teams.length} team{stream.teams.length !== 1 ? "s" : ""} · {completed}/{allMilestones.length} done
                    {overdue > 0 ? ` · ${overdue} overdue` : ""}
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
                  {stream.teams.length === 0 ? (
                    <Text style={[styles.muted, { color: colors.mutedForeground }]}>
                      No teams in this stream yet.
                    </Text>
                  ) : (
                    stream.teams.map((team) => {
                      const teamMs = team.projects.flatMap((p) => p.milestones);
                      const tDone = teamMs.filter((m) => m.status === "completed").length;
                      const tOverdue = teamMs.filter((m) => isOverdue(m)).length;
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
                              {team.projects.length} project{team.projects.length !== 1 ? "s" : ""} · {tDone}/{teamMs.length} done
                              {tOverdue > 0 ? ` · ${tOverdue} overdue` : ""}
                            </Text>
                          </View>
                          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      );
                    })
                  )}
                  {isAdmin ? (
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
  headerBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  headerBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
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
  teamRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 8, borderWidth: 1 },
  teamIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  teamName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  teamMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  addInline: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderStyle: "dashed" },
  addInlineText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
