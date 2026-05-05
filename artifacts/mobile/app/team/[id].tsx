import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { isOverdue } from "@/models/types";
import {
  canManageTeam,
  findTeam,
  useCurrentUser,
  useStore,
} from "@/store/useStore";

export default function TeamDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useCurrentUser();
  const streams = useStore((s) => s.streams);
  const users = useStore((s) => s.users);
  const updateTeam = useStore((s) => s.updateTeam);
  const deleteTeam = useStore((s) => s.deleteTeam);
  const assignLeader = useStore((s) => s.assignTeamLeader);

  const found = id ? findTeam(streams, id) : null;
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(found?.team.name ?? "");

  if (!found) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>Team not found.</Text>
      </View>
    );
  }

  const { stream, team } = found;
  const canEdit = canManageTeam(me, team.id);
  const isAdmin = me?.role === "admin";
  const leader = team.leaderId ? users.find((u) => u.id === team.leaderId) : null;
  const teamMembers = users.filter((u) => u.teamId === team.id);

  function saveName() {
    if (!draftName.trim()) return;
    updateTeam(team!.id, { name: draftName.trim() });
    setEditing(false);
  }

  function confirmDelete() {
    const msg = `Delete team "${team.name}" and all its projects?`;
    if (Platform.OS === "web") {
      if (window.confirm(msg)) {
        deleteTeam(team.id);
        router.back();
      }
    } else {
      Alert.alert("Delete team", msg, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => { deleteTeam(team.id); router.back(); } },
      ]);
    }
  }

  function pickLeader() {
    if (!isAdmin) return;
    const candidates = users.filter((u) => u.role === "leader" || u.role === "admin");
    if (candidates.length === 0) {
      Alert.alert("No candidates", "Create a leader user first.");
      return;
    }
    if (Platform.OS === "web") {
      const names = candidates.map((u, i) => `${i + 1}. ${u.name}`).join("\n");
      const choice = window.prompt(`Choose new leader (1-${candidates.length}):\n${names}\n\nLeave blank to clear.`);
      if (choice === null) return;
      if (choice.trim() === "") {
        assignLeader(team.id, null);
      } else {
        const idx = parseInt(choice, 10) - 1;
        if (idx >= 0 && idx < candidates.length) assignLeader(team.id, candidates[idx].id);
      }
    } else {
      const buttons = candidates.map((u) => ({ text: u.name, onPress: () => assignLeader(team.id, u.id) }));
      Alert.alert("Assign leader", "", [
        ...buttons,
        { text: "Clear", style: "destructive", onPress: () => assignLeader(team.id, null) },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.crumb, { color: colors.mutedForeground }]}>
        {stream.name} · Team
      </Text>
      {editing ? (
        <TextInput
          value={draftName}
          onChangeText={setDraftName}
          onBlur={saveName}
          style={[styles.titleInput, { color: colors.foreground, borderColor: colors.border }]}
          autoFocus
        />
      ) : (
        <Text style={[styles.title, { color: colors.foreground }]}>{team.name}</Text>
      )}

      <TouchableOpacity
        onPress={pickLeader}
        disabled={!isAdmin}
        style={[styles.leaderBox, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Feather name="award" size={14} color={colors.primary} />
        <Text style={[styles.leaderText, { color: colors.foreground }]}>
          Leader: <Text style={{ fontFamily: "Inter_600SemiBold" }}>{leader?.name ?? "Unassigned"}</Text>
        </Text>
        {isAdmin ? <Feather name="chevron-right" size={14} color={colors.mutedForeground} /> : null}
      </TouchableOpacity>

      {canEdit ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.muted }]}
            onPress={() => { setDraftName(team.name); setEditing((v) => !v); }}
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

      <View style={styles.sectionRow}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Projects</Text>
        {canEdit ? (
          <TouchableOpacity
            style={[styles.smallBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push({ pathname: "/new-project", params: { teamId: team.id } })}
          >
            <Feather name="plus" size={12} color="#fff" />
            <Text style={styles.smallBtnText}>Project</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {team.projects.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.muted }]}>
          <Text style={{ color: colors.mutedForeground }}>No projects yet.</Text>
        </View>
      ) : (
        team.projects.map((p) => {
          const done = p.milestones.filter((m) => m.status === "completed").length;
          const overdue = p.milestones.filter((m) => isOverdue(m)).length;
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: "/project/[id]", params: { id: p.id } })}
              activeOpacity={0.8}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.primary + "15" }]}>
                <Feather name="folder" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>{p.title}</Text>
                <Text style={[styles.rowMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {done}/{p.milestones.length} milestones done{overdue > 0 ? ` · ${overdue} overdue` : ""}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          );
        })
      )}

      <View style={styles.sectionRow}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Members ({teamMembers.length})</Text>
      </View>
      {teamMembers.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.muted }]}>
          <Text style={{ color: colors.mutedForeground }}>No members assigned to this team.</Text>
        </View>
      ) : (
        teamMembers.map((u) => (
          <View key={u.id} style={[styles.memberRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>{u.name}</Text>
              <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>{u.role}</Text>
            </View>
          </View>
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
  leaderBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  leaderText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  actions: { flexDirection: "row", gap: 8 },
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
  memberRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderWidth: 1, borderRadius: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 11, fontFamily: "Inter_700Bold" },
});
