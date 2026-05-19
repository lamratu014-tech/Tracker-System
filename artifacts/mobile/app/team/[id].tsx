import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  getGetStreamQueryKey,
  getGetTeamQueryKey,
  getListProjectsQueryKey,
  getListStreamTeamsQueryKey,
  getListTeamMembersQueryKey,
  getListTeamNotesQueryKey,
  getListTeamsQueryKey,
  getListUsersQueryKey,
  useAddTeamManager,
  useCreateTeamMember,
  useRemoveTeamManager,
  useCreateTeamNote,
  useDeleteMember,
  useDeleteTeam,
  useDeleteTeamNote,
  useGetStream,
  useGetTeam,
  useListProjects,
  useListTeamMembers,
  useListTeamNotes,
  useListUsers,
  useUpdateTeam,
  useUpdateTeamNote,
} from "@workspace/api-client-react";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
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
  teamVisibility,
  useCanManageTeam,
  useCanManageTeamAdmins,
  useCanManageTeamLeaders,
  useMe,
} from "@/lib/permissions";

export default function TeamDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const dialog = useDialog();

  const teamQ = useGetTeam(id ?? "", {
    query: { enabled: !!id, queryKey: getGetTeamQueryKey(id ?? "") },
  });
  const team = teamQ.data ?? null;

  // Once the team has loaded, decide whether the current user has full
  // access. If not, we keep all dependent queries disabled so we never
  // fetch members / notes / projects / users for a team the user
  // shouldn't be able to inspect.
  const teamLoaded = !!team;
  // Eagerly load the stream so we have programmeId for visibility checks.
  // Programme overseers need the team's stream's programmeId to know
  // whether the team falls inside their programme.
  const streamQ = useGetStream(team?.streamId ?? "", {
    query: {
      enabled: teamLoaded && !!team?.streamId,
      queryKey: getGetStreamQueryKey(team?.streamId ?? ""),
    },
  });
  const stream = streamQ.data ?? null;

  const visibility = team
    ? teamVisibility(me, { id: team.id, streamId: team.streamId }, stream?.programmeId)
    : "hidden";
  const canFetchTeamData = teamLoaded && visibility === "full";

  const usersQ = useListUsers({
    query: { enabled: canFetchTeamData, queryKey: getListUsersQueryKey() },
  });
  const users = usersQ.data ?? [];

  const membersQ = useListTeamMembers(id ?? "", {
    query: {
      enabled: canFetchTeamData && !!id,
      queryKey: getListTeamMembersQueryKey(id ?? ""),
    },
  });
  const members = membersQ.data ?? [];

  const notesQ = useListTeamNotes(id ?? "", {
    query: {
      enabled: canFetchTeamData && !!id,
      queryKey: getListTeamNotesQueryKey(id ?? ""),
    },
  });
  const notes = useMemo(
    () => [...(notesQ.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [notesQ.data],
  );

  const projectsQ = useListProjects({
    query: { enabled: canFetchTeamData, queryKey: getListProjectsQueryKey() },
  });
  const teamProjects = useMemo(
    () => (projectsQ.data ?? []).filter((p) => p.teamId === id),
    [projectsQ.data, id],
  );
  const sharedProjects = useMemo(
    () =>
      (projectsQ.data ?? []).filter(
        (p) => p.teamId !== id && (p.sharedTeamIds ?? []).includes(id ?? ""),
      ),
    [projectsQ.data, id],
  );

  const canEdit = useCanManageTeam(
    team ? { id: team.id, streamId: team.streamId } : null,
  );
  const canManageLeaders = useCanManageTeamLeaders(
    team ? { id: team.id, streamId: team.streamId } : null,
  );
  const canManageAdmins = useCanManageTeamAdmins(
    team ? { id: team.id, streamId: team.streamId } : null,
  );
  const isAdmin = me?.role === "admin";

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [newMember, setNewMember] = useState("");
  const [newNote, setNewNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteBody, setEditingNoteBody] = useState("");

  useEffect(() => {
    if (team && !editing) setDraftName(team.name);
  }, [team, editing]);

  const invalidateTeam = () => {
    if (id) qc.invalidateQueries({ queryKey: getGetTeamQueryKey(id) });
    qc.invalidateQueries({ queryKey: getListTeamsQueryKey() });
    if (team?.streamId) qc.invalidateQueries({ queryKey: getListStreamTeamsQueryKey(team.streamId) });
  };

  const updateTeam = useUpdateTeam({ mutation: { onSuccess: invalidateTeam } });
  const deleteTeam = useDeleteTeam({ mutation: { onSuccess: invalidateTeam } });
  const addManager = useAddTeamManager({ mutation: { onSuccess: invalidateTeam } });
  const removeManager = useRemoveTeamManager({ mutation: { onSuccess: invalidateTeam } });
  const createMember = useCreateTeamMember({
    mutation: {
      onSuccess: () => {
        if (id) qc.invalidateQueries({ queryKey: getListTeamMembersQueryKey(id) });
      },
    },
  });
  const deleteMember = useDeleteMember({
    mutation: {
      onSuccess: () => {
        if (id) qc.invalidateQueries({ queryKey: getListTeamMembersQueryKey(id) });
      },
    },
  });
  const createNote = useCreateTeamNote({
    mutation: {
      onSuccess: () => {
        if (id) qc.invalidateQueries({ queryKey: getListTeamNotesQueryKey(id) });
      },
    },
  });
  const updateNote = useUpdateTeamNote({
    mutation: {
      onSuccess: () => {
        if (id) qc.invalidateQueries({ queryKey: getListTeamNotesQueryKey(id) });
      },
    },
  });
  const deleteNote = useDeleteTeamNote({
    mutation: {
      onSuccess: () => {
        if (id) qc.invalidateQueries({ queryKey: getListTeamNotesQueryKey(id) });
      },
    },
  });

  if (teamQ.isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingRow />
      </View>
    );
  }
  if (!team) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>Team not found.</Text>
      </View>
    );
  }

  if (visibility !== "full") {
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
          You don&apos;t have access to this team.
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

  const leaderIds = team.leaderIds ?? [];
  const teamAdminIds = team.teamAdminIds ?? [];
  const leaderUsers = leaderIds
    .map((uid) => users.find((u) => u.id === uid))
    .filter((u): u is NonNullable<typeof u> => !!u);
  const teamAdminUsers = teamAdminIds
    .map((uid) => users.find((u) => u.id === uid))
    .filter((u): u is NonNullable<typeof u> => !!u);

  function saveName() {
    if (!draftName.trim()) return;
    updateTeam.mutate(
      { id: team!.id, data: { name: draftName.trim() } },
      { onSuccess: () => setEditing(false) },
    );
  }

  async function confirmDelete() {
    const ok = await dialog.confirm({
      title: "Delete team",
      message: `Delete team "${team!.name}" and all its projects/members?`,
      destructive: true,
      confirmText: "Delete",
    });
    if (ok) deleteTeam.mutate({ id: team!.id }, { onSuccess: () => router.back() });
  }

  async function addLeader() {
    if (!canManageLeaders) return;
    const taken = new Set([...leaderIds, ...teamAdminIds]);
    const candidates = users.filter(
      (u) => !taken.has(u.id) && u.role === "leader",
    );
    if (candidates.length === 0) {
      await dialog.confirm({
        title: "No candidates",
        message: "There are no users with the Leader role available. Invite a new user with role Leader first, then come back here to add them.",
        confirmText: "OK",
      });
      return;
    }
    const choice = await dialog.choice<string>({
      title: "Add leader",
      message: "Pick a user to add as a leader of this team.",
      options: candidates.map((u) => ({ label: u.name, value: u.id })),
    });
    if (!choice) return;
    addManager.mutate({ id: team!.id, data: { userId: choice, role: "leader" } });
  }

  async function addTeamAdmin() {
    if (!canManageAdmins) return;
    const taken = new Set([...leaderIds, ...teamAdminIds]);
    const candidates = users.filter(
      (u) => !taken.has(u.id) && (u.role === "leader" || u.role === "team_admin"),
    );
    if (candidates.length === 0) {
      await dialog.confirm({
        title: "No candidates",
        message: "There are no users with the Team admin (or Leader) role available. Invite a new user with role Team admin first, then come back here to add them.",
        confirmText: "OK",
      });
      return;
    }
    const choice = await dialog.choice<string>({
      title: "Add team admin",
      message: "Pick a user to add as a team admin.",
      options: candidates.map((u) => ({ label: u.name, value: u.id })),
    });
    if (!choice) return;
    addManager.mutate({ id: team!.id, data: { userId: choice, role: "team_admin" } });
  }

  async function removeLeaderFor(userId: string, label: string) {
    if (!canManageLeaders) return;
    const ok = await dialog.confirm({
      title: "Remove leader",
      message: `Remove ${label} as a leader of this team?`,
      destructive: true,
      confirmText: "Remove",
    });
    if (ok) removeManager.mutate({ id: team!.id, userId });
  }

  async function removeTeamAdminFor(userId: string, label: string) {
    if (!canManageAdmins) return;
    const ok = await dialog.confirm({
      title: "Remove team admin",
      message: `Remove ${label} as a team admin?`,
      destructive: true,
      confirmText: "Remove",
    });
    if (ok) removeManager.mutate({ id: team!.id, userId });
  }

  function addNewMember() {
    if (!newMember.trim()) return;
    createMember.mutate(
      { id: team!.id, data: { name: newMember.trim() } },
      { onSuccess: () => setNewMember("") },
    );
  }

  function postNote() {
    if (!newNote.trim()) return;
    createNote.mutate(
      { id: team!.id, data: { body: newNote.trim() } },
      { onSuccess: () => setNewNote("") },
    );
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
    updateNote.mutate(
      { id: editingNoteId, data: { body: editingNoteBody.trim() } },
      {
        onSuccess: () => {
          setEditingNoteId(null);
          setEditingNoteBody("");
        },
      },
    );
  }

  async function confirmDeleteNote(noteId: string) {
    const ok = await dialog.confirm({
      title: "Delete note",
      message: "Delete this note?",
      destructive: true,
      confirmText: "Delete",
    });
    if (ok) deleteNote.mutate({ id: noteId });
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

  async function confirmDeleteMember(memberId: string, name: string) {
    const ok = await dialog.confirm({
      title: "Remove member",
      message: `Remove "${name}" from this team?`,
      destructive: true,
      confirmText: "Remove",
    });
    if (ok) deleteMember.mutate({ id: memberId });
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.crumb, { color: colors.mutedForeground }]}>
        {stream?.name ?? "—"} · Team
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

      <View style={[styles.leaderBox, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "column", alignItems: "stretch", gap: 8 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="award" size={14} color={colors.primary} />
          <Text style={[styles.leaderText, { color: colors.foreground, flex: 1 }]}>
            Leaders {leaderUsers.length > 0 ? `(${leaderUsers.length})` : ""}
          </Text>
          {canManageLeaders ? (
            <TouchableOpacity onPress={addLeader} style={{ padding: 4 }}>
              <Feather name="plus" size={16} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>
        {leaderUsers.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Unassigned</Text>
        ) : (
          leaderUsers.map((u) => (
            <View key={u.id} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: colors.foreground, flex: 1, fontFamily: "Inter_600SemiBold" }}>{u.name}</Text>
              {canManageLeaders ? (
                <TouchableOpacity onPress={() => removeLeaderFor(u.id, u.name)}>
                  <Feather name="x" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
          <Feather name="shield" size={14} color={colors.primary} />
          <Text style={[styles.leaderText, { color: colors.foreground, flex: 1 }]}>
            Team admins {teamAdminUsers.length > 0 ? `(${teamAdminUsers.length})` : ""}
          </Text>
          {canManageAdmins ? (
            <TouchableOpacity onPress={addTeamAdmin} style={{ padding: 4 }}>
              <Feather name="plus" size={16} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>
        {teamAdminUsers.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>None</Text>
        ) : (
          teamAdminUsers.map((u) => (
            <View key={u.id} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: colors.foreground, flex: 1 }}>{u.name}</Text>
              {canManageAdmins ? (
                <TouchableOpacity onPress={() => removeTeamAdminFor(u.id, u.name)}>
                  <Feather name="x" size={14} color={colors.mutedForeground} />
                </TouchableOpacity>
              ) : null}
            </View>
          ))
        )}
      </View>

      {canEdit ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.muted }]}
            onPress={() => {
              if (editing) saveName();
              else { setDraftName(team.name); setEditing(true); }
            }}
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

      {projectsQ.isError ? (
        <ErrorBanner error={projectsQ.error} onRetry={() => projectsQ.refetch()} />
      ) : null}
      {projectsQ.isLoading ? <LoadingRow /> : null}

      {teamProjects.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.muted }]}>
          <Text style={{ color: colors.mutedForeground }}>No projects yet.</Text>
        </View>
      ) : (
        teamProjects.map((p) => (
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
              {p.description ? (
                <Text style={[styles.rowMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {p.description}
                </Text>
              ) : null}
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ))
      )}

      {sharedProjects.length > 0 ? (
        <>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Shared with us</Text>
          </View>
          {sharedProjects.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push({ pathname: "/project/[id]", params: { id: p.id } })}
              activeOpacity={0.8}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.primary + "15" }]}>
                <Feather name="share-2" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>{p.title}</Text>
                <Text style={[styles.rowMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                  Owned by {p.teamName ?? "another team"}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </>
      ) : null}

      <View style={styles.sectionRow}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Members ({members.length})
        </Text>
      </View>

      {membersQ.isLoading ? <LoadingRow /> : null}
      {members.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.muted }]}>
          <Text style={{ color: colors.mutedForeground }}>No members yet.</Text>
        </View>
      ) : (
        members.map((mb) => (
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
              <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>
                {mb.roleLabel ?? "Member"}
              </Text>
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
        <View style={[styles.addMemberRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
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
            disabled={!newMember.trim() || createMember.isPending}
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
        <View style={[styles.noteComposer, { borderColor: colors.border, backgroundColor: colors.card }]}>
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
              disabled={!newNote.trim() || createNote.isPending}
              style={[styles.postBtn, { backgroundColor: newNote.trim() ? colors.primary : colors.border }]}
            >
              <Feather name="send" size={12} color="#fff" />
              <Text style={styles.postBtnText}>Post</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {notesQ.isLoading ? <LoadingRow /> : null}
      {notes.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.muted }]}>
          <Text style={{ color: colors.mutedForeground }}>
            {canEdit ? "No notes yet — post the first update above." : "No notes yet."}
          </Text>
        </View>
      ) : (
        <View style={styles.timeline}>
          {notes.map((n, idx) => {
            const authorName =
              n.authorName ??
              users.find((u) => u.id === n.authorId)?.name ??
              "Removed user";
            const mine = me?.id === n.authorId;
            const canEditNote = canEdit && (mine || isAdmin);
            const isEditing = editingNoteId === n.id;
            const wasEdited = n.updatedAt && n.updatedAt !== n.createdAt;
            return (
              <View key={n.id} style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                  {idx < notes.length - 1 ? (
                    <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                  ) : null}
                </View>
                <View
                  style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={styles.noteHeader}>
                    <Text style={[styles.noteAuthor, { color: colors.foreground }]}>
                      {authorName}
                    </Text>
                    <Text style={[styles.noteMeta, { color: colors.mutedForeground }]}>
                      {formatNoteDate(n.createdAt)}{wasEdited ? " · edited" : ""}
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
                          <Text style={[styles.noteActionText, { color: colors.mutedForeground }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={saveEditNote}
                          disabled={!editingNoteBody.trim() || updateNote.isPending}
                          style={[styles.noteActionBtn, { backgroundColor: editingNoteBody.trim() ? colors.primary : colors.border }]}
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
                        <Text style={[styles.noteActionText, { color: colors.mutedForeground }]}>Edit</Text>
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
  addMemberRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderWidth: 1, borderRadius: 10, borderStyle: "dashed" },
  addMemberInput: { flex: 1, paddingHorizontal: 8, paddingVertical: 8, fontSize: 14, fontFamily: "Inter_400Regular" },
  addMemberBtn: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  note: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", paddingTop: 12, paddingHorizontal: 8, lineHeight: 16 },
  noteComposer: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 8 },
  noteInput: { fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 48, textAlignVertical: "top" },
  noteComposerFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  noteHint: { fontSize: 11, fontFamily: "Inter_400Regular" },
  postBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  postBtnText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: "row", gap: 10 },
  timelineRail: { width: 14, alignItems: "center", paddingTop: 14 },
  timelineDot: { width: 10, height: 10, borderRadius: 5 },
  timelineLine: { width: 2, flex: 1, marginTop: 4, minHeight: 12 },
  noteCard: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10, gap: 4 },
  noteHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  noteAuthor: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  noteMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  noteBody: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, marginTop: 2 },
  noteActionsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  noteActionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  noteActionText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  noteIconBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 4 },
});
