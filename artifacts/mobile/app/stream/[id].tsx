import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

export default function StreamDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isProgrammeLead, currentUser } = useAuth();
  const { streams, teams, tasks, projects, updateStream, deleteStream, createTeam } = useData();

  const stream = streams.find((s) => s.id === id);
  const streamTeams = useMemo(() => teams.filter((t) => t.streamId === id), [teams, id]);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(stream?.name ?? "");
  const [draftDesc, setDraftDesc] = useState(stream?.description ?? "");

  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  if (!stream) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Stream not found</Text>
      </View>
    );
  }

  function handleSaveEdit() {
    if (!draftName.trim()) return;
    updateStream(id!, { name: draftName.trim(), description: draftDesc.trim() });
    setEditing(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function handleDelete() {
    Alert.alert("Delete Stream", `Delete "${stream!.name}"? This will not delete the teams within it.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: () => {
          deleteStream(id!);
          router.back();
        }
      }
    ]);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: botPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stream Info */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {editing ? (
            <View style={styles.editForm}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Stream Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                value={draftName}
                onChangeText={setDraftName}
                autoFocus
              />
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Description</Text>
              <TextInput
                style={[styles.input, styles.multiline, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                value={draftDesc}
                onChangeText={setDraftDesc}
                multiline
                numberOfLines={3}
              />
              <View style={styles.editActions}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted }]} onPress={() => setEditing(false)}>
                  <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={handleSaveEdit}>
                  <Text style={[styles.btnText, { color: "#fff" }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.streamInfo}>
              <View style={styles.streamInfoHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.streamName, { color: colors.foreground }]}>{stream.name}</Text>
                  {stream.description ? (
                    <Text style={[styles.streamDesc, { color: colors.mutedForeground }]}>{stream.description}</Text>
                  ) : null}
                </View>
                {isProgrammeLead && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity onPress={() => setEditing(true)} style={styles.iconBtn}>
                      <Feather name="edit-2" size={16} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
                      <Feather name="trash-2" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {streamTeams.length} team{streamTeams.length !== 1 ? "s" : ""} · Created {new Date(stream.createdAt).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        {/* Teams */}
        <View style={styles.teamsSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Teams</Text>
            {isProgrammeLead && (
              <TouchableOpacity
                style={[styles.addTeamBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push({ pathname: "/new-team", params: { streamId: id } })}
              >
                <Feather name="plus" size={14} color="#fff" />
                <Text style={styles.addTeamBtnText}>Add Team</Text>
              </TouchableOpacity>
            )}
          </View>

          {streamTeams.length === 0 ? (
            <View style={[styles.emptyTeams, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="users" size={24} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No teams in this stream</Text>
            </View>
          ) : (
            streamTeams.map((team) => {
              const teamProjects = projects.filter((p) => p.teamId === team.id);
              const teamTasks = tasks.filter((t) => teamProjects.some((p) => p.id === t.projectId));
              const done = teamTasks.filter((t) => t.status === "done").length;
              const atRisk = teamTasks.filter((t) => t.status === "at_risk").length;
              const progress = teamTasks.length > 0 ? done / teamTasks.length : 0;
              const canAccess = isProgrammeLead || currentUser?.teamId === team.id;
              const statusColor = atRisk > 0 ? "#F59E0B" : teamTasks.length > 0 && done === teamTasks.length ? "#10B981" : "#3B82F6";

              return (
                <TouchableOpacity
                  key={team.id}
                  style={[styles.teamRow, { backgroundColor: canAccess ? colors.card : colors.muted, borderColor: colors.border }]}
                  onPress={() => canAccess && router.push({ pathname: "/team/[id]", params: { id: team.id } })}
                  activeOpacity={canAccess ? 0.75 : 1}
                >
                  <View style={styles.teamRowLeft}>
                    <View style={[styles.teamIcon, { backgroundColor: canAccess ? colors.primary + "20" : colors.border }]}>
                      {canAccess
                        ? <Feather name="users" size={14} color={colors.primary} />
                        : <Feather name="lock" size={14} color={colors.mutedForeground} />
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.teamName, { color: canAccess ? colors.foreground : colors.mutedForeground }]}>{team.name}</Text>
                      {team.functionLabel ? (
                        <Text style={[styles.teamFunc, { color: colors.mutedForeground }]}>{team.functionLabel}</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.teamRowRight}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.taskCount, { color: colors.mutedForeground }]}>{done}/{teamTasks.length}</Text>
                    {canAccess && <Feather name="chevron-right" size={14} color={colors.mutedForeground} />}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: { margin: 16, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  streamInfo: { padding: 16, gap: 8 },
  streamInfoHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  streamName: { fontSize: 20, fontFamily: "Inter_700Bold" },
  streamDesc: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4, lineHeight: 20 },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actionRow: { flexDirection: "row", gap: 4 },
  iconBtn: { padding: 8 },
  editForm: { padding: 16, gap: 10 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontFamily: "Inter_400Regular" },
  multiline: { height: 80, textAlignVertical: "top" },
  editActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  btn: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  btnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  teamsSection: { marginHorizontal: 16, gap: 8 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  addTeamBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addTeamBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  emptyTeams: { borderRadius: 12, borderWidth: 1, padding: 24, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  teamRow: { borderRadius: 12, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  teamRowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  teamIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  teamName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  teamFunc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  teamRowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  taskCount: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
