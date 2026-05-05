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
import { findTeam, useCanManageTeam, useCurrentUser, useStore } from "@/store/useStore";

export default function TeamDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useCurrentUser();
  const streams = useStore((s) => s.streams);
  const users = useStore((s) => s.users);
  const members = useStore((s) => s.members);
  const updateTeam = useStore((s) => s.updateTeam);
  const deleteTeam = useStore((s) => s.deleteTeam);
  const assignLeader = useStore((s) => s.assignTeamLeader);
  const addMember = useStore((s) => s.addMember);
  const deleteMember = useStore((s) => s.deleteMember);
  const addTeamNote = useStore((s) => s.addTeamNote);
  const updateTeamNote = useStore((s) => s.updateTeamNote);
  const deleteTeamNote = useStore((s) => s.deleteTeamNote);

  const found = id ? findTeam(streams, id) : null;
  const canEdit = useCanManageTeam(found?.team.id ?? null);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(found?.team.name ?? "");
  const [newMember, setNewMember] = useState("");
  const [newNote, setNewNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteBody, setEditingNoteBody] = useState("");

  if (!found) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>Team not found.</Text>
      </View>
    );
  }

  const { stream, team } = found;
  const isAdmin = me?.role === "admin";
  const leader = team.leaderId ? users.find((u) => u.id === team.leaderId) : null;
  const teamMembers = members.filter((m) => m.teamId === team.id);
  const notes = [...(team.notes ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  function saveName() {
    if (!draftName.trim()) return;
    updateTeam(team.id, { name: draftName.trim() });
    setEditing(false);
  }

  function confirmDelete() {
    const msg = `Delete team "${team.name}" and all its projects/members?`;
    if (Platform.OS === "web") {
      if (window.confirm(msg)) {
        deleteTeam(team.id);
        router.back();
      }
    } else {
      Alert.alert("Delete team", msg, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => { deleteTeam(team.id); router.back(); },
        },
      ]);
    }
  }

  function pickLeader() {
    if (!isAdmin) return;
    const candidates = users.filter((u) => u.role === "leader" || u.role === "admin");
    if (candidates.length === 0) {
      Alert.alert("No candidates", "Invite a leader user first.");
      return;
    }
    if (Platform.OS === "web") {
      const list = candidates.map((u, i) => `${i + 1}. ${u.name}`).join("\n");
      const choice = window.prompt(
        `Choose new leader (1-${candidates.length}):\n${list}\n\nLeave blank to clear.`,
      );
      if (choice === null) return;
      if (choice.trim() === "") {
        assignLeader(team.id, null);
      } else {
        const idx = parseInt(choice, 10) - 1;
        if (idx >= 0 && idx < candidates.length) assignLeader(team.id, candidates[idx].id);
      }
    } else {
      const buttons = candidates.map((u) => ({
        text: u.name,
        onPress: () => assignLeader(team.id, u.id),
      }));
      Alert.alert("Assign leader", "", [
        ...buttons,
        { text: "Clear", style: "destructive", onPress: () => assignLeader(team.id, null) },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }

  function addNewMember() {
    if (!newMember.trim()) return;
    addMember({ name: newMember.trim(), teamId: team.id });
    setNewMember("");
  }

  function postNote() {
    if (!newNote.trim() || !me) return;
    addTeamNote({ teamId: team.id, body: newNote.trim() }, me.id);
    setNewNote("");
  }

  function startEditNote(noteId: string, body: string) {
    setEditingNoteId(noteId);
    setEditingNoteBody(body);
  }

  function saveEditNote() {
    if (!editingNoteId || !editingNoteBody.trim()) {
      setEditingNoteId(null);
      return;
    }
    updateTeamNote(editingNoteId, editingNoteBody.trim());
    setEditingNoteId(null);
    setEditingNoteBody("");
  }

  function confirmDeleteNote(noteId: string) {
    const msg = "Delete this note?";
    if (Platform.OS === "web") {
      if (window.confirm(msg)) deleteTeamNote(noteId);
    } else {
      Alert.alert("Delete note", msg, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteTeamNote(noteId) },
      ]);
    }
  }

  function formatNoteDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (sameDay) return `Today, ${time}`;
    const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
    return `${date}, ${time}`;
  }

  function confirmDeleteMember(memberId: string, name: string) {
    const msg = `Remove "${name}" from this team?`;
    if (Platform.OS === "web") {
      if (window.confirm(msg)) deleteMember(memberId);
    } else {
      Alert.alert("Remove member", msg, [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => deleteMember(memberId) },
      ]);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.crumb, { color: colors.mutedForeground }]}>{stream.name} · Team</Text>
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
          Leader:{" "}
          <Text style={{ fontFamily: "Inter_600SemiBold" }}>{leader?.name ?? "Unassigned"}</Text>
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
            <Text style={[styles.actionText, { color: colors.primary }]}>
              {editing ? "Save" : "Rename"}
            </Text>
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
                  {done}/{p.milestones.length} milestones done
                  {overdue > 0 ? ` · ${overdue} overdue` : ""}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          );
        })
      )}

      <View style={styles.sectionRow}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Members ({teamMembers.length})
        </Text>
      </View>

      {teamMembers.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.muted }]}>
          <Text style={{ color: colors.mutedForeground }}>No members yet.</Text>
        </View>
      ) : (
        teamMembers.map((mb) => (
          <View
            key={mb.id}
            style={[styles.memberRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {mb.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>{mb.name}</Text>
              <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>Member</Text>
            </View>
            {canEdit ? (
              <TouchableOpacity
                onPress={() => confirmDeleteMember(mb.id, mb.name)}
                hitSlop={8}
                style={{ padding: 4 }}
              >
                <Feather name="trash-2" size={14} color="#DC2626" />
              </TouchableOpacity>
            ) : null}
          </View>
        ))
      )}

      {canEdit ? (
        <View
          style={[styles.addMemberRow, { borderColor: colors.border, backgroundColor: colors.card }]}
        >
          <TextInput
            value={newMember}
            onChangeText={setNewMember}
            placeholder="Add a team member by name"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.addMemberInput, { color: colors.foreground }]}
            returnKeyType="done"
            onSubmitEditing={addNewMember}
          />
          <TouchableOpacity
            onPress={addNewMember}
            disabled={!newMember.trim()}
            style={[styles.addMemberBtn, { backgroundColor: newMember.trim() ? colors.primary : colors.border }]}
          >
            <Feather name="plus" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.sectionRow}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Notes timeline ({notes.length})
        </Text>
      </View>

      {canEdit ? (
        <View
          style={[styles.noteComposer, { borderColor: colors.border, backgroundColor: colors.card }]}
        >
          <TextInput
            value={newNote}
            onChangeText={setNewNote}
            placeholder="Share an update with the team…"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.noteInput, { color: colors.foreground }]}
            multiline
          />
          <View style={styles.noteComposerFooter}>
            <Text style={[styles.noteHint, { color: colors.mutedForeground }]}>
              Posted as {me?.name}
            </Text>
            <TouchableOpacity
              onPress={postNote}
              disabled={!newNote.trim()}
              style={[
                styles.postBtn,
                { backgroundColor: newNote.trim() ? colors.primary : colors.border },
              ]}
            >
              <Feather name="send" size={12} color="#fff" />
              <Text style={styles.postBtnText}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {notes.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.muted }]}>
          <Text style={{ color: colors.mutedForeground }}>
            {canEdit ? "No notes yet — post the first update above." : "No notes yet."}
          </Text>
        </View>
      ) : (
        <View style={styles.timeline}>
          {notes.map((n, idx) => {
            const author = users.find((u) => u.id === n.authorId);
            const mine = me?.id === n.authorId;
            const canEditNote = canEdit && (mine || isAdmin);
            const isEditing = editingNoteId === n.id;
            return (
              <View key={n.id} style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                  {idx < notes.length - 1 ? (
                    <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                  ) : null}
                </View>
                <View
                  style={[
                    styles.noteCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.noteHeader}>
                    <Text style={[styles.noteAuthor, { color: colors.foreground }]}>
                      {author?.name ?? "Unknown"}
                    </Text>
                    <Text style={[styles.noteMeta, { color: colors.mutedForeground }]}>
                      {formatNoteDate(n.createdAt)}
                      {n.updatedAt ? " · edited" : ""}
                    </Text>
                  </View>
                  {isEditing ? (
                    <>
                      <TextInput
                        value={editingNoteBody}
                        onChangeText={setEditingNoteBody}
                        style={[
                          styles.noteInput,
                          {
                            color: colors.foreground,
                            borderColor: colors.border,
                            borderWidth: 1,
                            borderRadius: 8,
                            padding: 8,
                            marginTop: 6,
                          },
                        ]}
                        multiline
                        autoFocus
                      />
                      <View style={styles.noteActionsRow}>
                        <TouchableOpacity
                          onPress={() => { setEditingNoteId(null); setEditingNoteBody(""); }}
                          style={[styles.noteActionBtn, { backgroundColor: colors.muted }]}
                        >
                          <Text style={[styles.noteActionText, { color: colors.mutedForeground }]}>
                            Cancel
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={saveEditNote}
                          disabled={!editingNoteBody.trim()}
                          style={[
                            styles.noteActionBtn,
                            { backgroundColor: editingNoteBody.trim() ? colors.primary : colors.border },
                          ]}
                        >
                          <Text style={[styles.noteActionText, { color: "#fff" }]}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <Text style={[styles.noteBody, { color: colors.foreground }]}>{n.body}</Text>
                  )}
                  {canEditNote && !isEditing ? (
                    <View style={styles.noteActionsRow}>
                      <TouchableOpacity
                        onPress={() => startEditNote(n.id, n.body)}
                        hitSlop={6}
                        style={styles.noteIconBtn}
                      >
                        <Feather name="edit-2" size={12} color={colors.mutedForeground} />
                        <Text style={[styles.noteActionText, { color: colors.mutedForeground }]}>
                          Edit
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => confirmDeleteNote(n.id)}
                        hitSlop={6}
                        style={styles.noteIconBtn}
                      >
                        <Feather name="trash-2" size={12} color="#DC2626" />
                        <Text style={[styles.noteActionText, { color: "#DC2626" }]}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        Members are roster entries inside the team — they do not log in. Use "Invite User" from the dashboard "+" hub to give someone a login account.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 10 },
  crumb: {
    fontSize: 12, fontFamily: "Inter_500Medium",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  titleInput: {
    fontSize: 24, fontFamily: "Inter_700Bold",
    borderBottomWidth: 1, paddingVertical: 4,
  },
  leaderBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  leaderText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
  },
  actionText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sectionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 12,
  },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  smallBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  smallBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  empty: { padding: 16, borderRadius: 10, alignItems: "center" },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderWidth: 1, borderRadius: 10,
  },
  iconBox: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  rowMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  memberRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 10, borderWidth: 1, borderRadius: 10,
  },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  addMemberRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 8, borderWidth: 1, borderRadius: 10, borderStyle: "dashed",
  },
  addMemberInput: {
    flex: 1, paddingHorizontal: 8, paddingVertical: 8,
    fontSize: 14, fontFamily: "Inter_400Regular",
  },
  addMemberBtn: {
    width: 36, height: 36, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  note: {
    fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center",
    paddingTop: 12, paddingHorizontal: 8, lineHeight: 16,
  },
  noteComposer: {
    borderWidth: 1, borderRadius: 10, padding: 10, gap: 8,
  },
  noteInput: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    minHeight: 48, textAlignVertical: "top",
  },
  noteComposerFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  noteHint: { fontSize: 11, fontFamily: "Inter_400Regular" },
  postBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
  },
  postBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: "row", gap: 10 },
  timelineRail: { width: 14, alignItems: "center", paddingTop: 14 },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: { width: 2, flex: 1, marginTop: 4, minHeight: 12 },
  noteCard: {
    flex: 1, borderWidth: 1, borderRadius: 10, padding: 12,
    marginBottom: 10, gap: 4,
  },
  noteHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: 8,
  },
  noteAuthor: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  noteMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  noteBody: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, marginTop: 2 },
  noteActionsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  noteActionBtn: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
  },
  noteActionText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  noteIconBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 6, paddingVertical: 4,
  },
});
