import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, type UserRole, type AppUser } from "@/context/AuthContext";
import { useData, type Team, type Stream, type ActivityLog } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

type AdminTab = "users" | "structure" | "activity" | "settings";

const ROLE_COLORS: Record<UserRole, string> = {
  programme_lead: "#7C3AED",
  team_lead: "#2563EB",
};

const ROLE_LABELS: Record<UserRole, string> = {
  programme_lead: "Programme Lead",
  team_lead: "Team Lead",
};

export default function AdminPanelScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    users,
    currentUser,
    updateUserRole,
    inviteUser,
    deactivateUser,
    reactivateUser,
    deleteUser,
  } = useAuth();
  const {
    programme,
    streams,
    teams,
    activityLogs,
    createTeam,
    updateTeam,
    deleteTeam,
    createStream,
    updateStream,
    deleteStream,
    updateProgramme,
    refreshActivity,
  } = useData();

  const [tab, setTab] = useState<AdminTab>("users");
  const [showInvite, setShowInvite] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState<AppUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [activityLoading, setActivityLoading] = useState(false);

  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter === "active" && !u.active) return false;
      if (statusFilter === "inactive" && u.active) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  function handleRoleChange(user: AppUser, role: UserRole) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateUserRole(user.id, role);
    setShowRoleModal(null);
  }

  function handleDeactivate(user: AppUser) {
    Alert.alert("Deactivate User", `Suspend ${user.name}'s access?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Deactivate", style: "destructive", onPress: () => { deactivateUser(user.id); } },
    ]);
  }

  function handleDelete(user: AppUser) {
    Alert.alert("Delete User", `Permanently delete ${user.name}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete Permanently", style: "destructive", onPress: () => { deleteUser(user.id); } },
    ]);
  }

  function handleDeleteStream(stream: Stream) {
    Alert.alert("Delete Stream", `Delete "${stream.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteStream(stream.id) },
    ]);
  }

  function handleDeleteTeam(team: Team) {
    Alert.alert("Delete Team", `Delete "${team.name}"? All its projects will also be deleted.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteTeam(team.id) },
    ]);
  }

  const TABS: { key: AdminTab; label: string; icon: string }[] = [
    { key: "users", label: "Users", icon: "users" },
    { key: "structure", label: "Structure", icon: "grid" },
    { key: "activity", label: "Activity", icon: "activity" },
    { key: "settings", label: "Settings", icon: "settings" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <Feather name={t.icon as any} size={15} color={tab === t.key ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.tabText, { color: tab === t.key ? colors.primary : colors.mutedForeground }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Users Tab ─────────────────────────────────────── */}
      {tab === "users" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Users ({users.filter((u) => u.active).length} active)
            </Text>
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowInvite(true)} activeOpacity={0.7}>
              <Feather name="user-plus" size={14} color="#fff" />
              <Text style={styles.addBtnText}>Invite</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="search" size={15} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name, email or department…"
              placeholderTextColor={colors.mutedForeground}
              clearButtonMode="while-editing"
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 6, paddingRight: 4 }}>
            {(["all", "programme_lead", "team_lead"] as const).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.filterChipSmall, { backgroundColor: roleFilter === r ? (r === "all" ? colors.primary : ROLE_COLORS[r as UserRole] ?? colors.primary) : colors.muted }]}
                onPress={() => setRoleFilter(r)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, { color: roleFilter === r ? "#fff" : colors.mutedForeground }]}>
                  {r === "all" ? "All Roles" : ROLE_LABELS[r as UserRole]}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={[styles.filterDivider, { backgroundColor: colors.border }]} />
            {(["all", "active", "inactive"] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.filterChipSmall, { backgroundColor: statusFilter === s ? (s === "active" ? "#059669" : s === "inactive" ? "#6B7280" : colors.primary) : colors.muted }]}
                onPress={() => setStatusFilter(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, { color: statusFilter === s ? "#fff" : colors.mutedForeground }]}>
                  {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filteredUsers.map((user) => {
            const userTeam = teams.find((t) => t.id === user.teamId);
            return (
              <View
                key={user.id}
                style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }, !user.active && { opacity: 0.5 }]}
              >
                <View style={[styles.avatar, { backgroundColor: ROLE_COLORS[user.role] }]}>
                  <Text style={styles.avatarText}>{user.initials}</Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: colors.foreground }]}>{user.name}</Text>
                  <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{user.email}</Text>
                  {user.department ? <Text style={[styles.userDept, { color: colors.mutedForeground }]}>{user.department}</Text> : null}
                  {userTeam ? <Text style={[styles.userDept, { color: colors.primary }]}>{userTeam.name}</Text> : null}
                </View>
                <View style={styles.userRight}>
                  <TouchableOpacity
                    style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[user.role] + "20" }]}
                    onPress={() => currentUser && user.id !== currentUser.id && user.active && setShowRoleModal(user)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.roleText, { color: ROLE_COLORS[user.role] }]}>{ROLE_LABELS[user.role]}</Text>
                  </TouchableOpacity>
                  {currentUser && user.id !== currentUser.id && (
                    <View style={styles.userActions}>
                      {user.active ? (
                        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: "#FEF3C7" }]} onPress={() => handleDeactivate(user)} activeOpacity={0.7}>
                          <Feather name="user-x" size={13} color="#D97706" />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: "#D1FAE5" }]} onPress={() => { reactivateUser(user.id); }} activeOpacity={0.7}>
                          <Feather name="user-check" size={13} color="#059669" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={[styles.iconBtn, { backgroundColor: "#FEE2E2" }]} onPress={() => handleDelete(user)} activeOpacity={0.7}>
                        <Feather name="trash-2" size={13} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                  {currentUser && user.id === currentUser.id && (
                    <Text style={[styles.youTag, { color: colors.primary }]}>You</Text>
                  )}
                </View>
              </View>
            );
          })}

          {filteredUsers.length === 0 && (
            <View style={[styles.emptyState, { backgroundColor: colors.muted }]}>
              <Feather name="users" size={24} color={colors.mutedForeground} />
              <Text style={[styles.emptyStateText, { color: colors.mutedForeground }]}>No users match your filters</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Structure Tab (Streams + Teams) ───────────────── */}
      {tab === "structure" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad }}>
          {/* Streams */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Streams ({streams.length})
            </Text>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                Alert.prompt("New Stream", "Enter stream name:", (name) => {
                  if (name?.trim() && programme) {
                    createStream({ name: name.trim(), programmeId: programme.id });
                  }
                });
              }}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={14} color="#fff" />
              <Text style={styles.addBtnText}>New Stream</Text>
            </TouchableOpacity>
          </View>

          {streams.length === 0 && (
            <View style={[styles.emptyState, { backgroundColor: colors.muted }]}>
              <Feather name="grid" size={24} color={colors.mutedForeground} />
              <Text style={[styles.emptyStateText, { color: colors.mutedForeground }]}>
                No streams yet. Streams group teams into functional areas.
              </Text>
            </View>
          )}

          {streams.map((stream) => {
            const streamTeams = teams.filter((t) => t.streamId === stream.id);
            return (
              <View key={stream.id} style={[styles.streamCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.streamCardHeader}>
                  <View style={[styles.streamDot, { backgroundColor: colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.streamName, { color: colors.foreground }]}>{stream.name}</Text>
                    {stream.description ? <Text style={[styles.streamDesc, { color: colors.mutedForeground }]}>{stream.description}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteStream(stream)} style={styles.deleteBtn}>
                    <Feather name="trash-2" size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.streamMeta, { color: colors.mutedForeground }]}>{streamTeams.length} team{streamTeams.length !== 1 ? "s" : ""}</Text>
              </View>
            );
          })}

          {/* Teams */}
          <View style={[styles.sectionHeader, { marginTop: 20 }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Teams ({teams.length})
            </Text>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={() => {
                Alert.prompt("New Team", "Enter team name:", (name) => {
                  if (name?.trim()) createTeam({ name: name.trim() });
                });
              }}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={14} color="#fff" />
              <Text style={styles.addBtnText}>New Team</Text>
            </TouchableOpacity>
          </View>

          {teams.length === 0 && (
            <View style={[styles.emptyState, { backgroundColor: colors.muted }]}>
              <Feather name="briefcase" size={24} color={colors.mutedForeground} />
              <Text style={[styles.emptyStateText, { color: colors.mutedForeground }]}>
                No teams yet. Create teams to organise users and projects.
              </Text>
            </View>
          )}

          {teams.map((team) => {
            const teamUsers = users.filter((u) => u.teamId === team.id);
            const teamLead = teamUsers.find((u) => u.role === "team_lead");
            const stream = streams.find((s) => s.id === team.streamId);
            return (
              <View key={team.id} style={[styles.teamCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.teamCardHeader}>
                  <View style={[styles.teamIcon, { backgroundColor: colors.primary + "20" }]}>
                    <Feather name="briefcase" size={16} color={colors.primary} />
                  </View>
                  <View style={styles.teamMeta}>
                    <Text style={[styles.teamName, { color: colors.foreground }]}>{team.name}</Text>
                    <Text style={[styles.teamSub, { color: colors.mutedForeground }]}>
                      {stream ? `${stream.name} · ` : "Unassigned · "}
                      {teamUsers.length} user{teamUsers.length !== 1 ? "s" : ""}
                    </Text>
                    {teamLead && (
                      <Text style={[styles.teamLeadLabel, { color: colors.primary }]}>Lead: {teamLead.name}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteTeam(team)} style={styles.deleteBtn}>
                    <Feather name="trash-2" size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── Activity Tab ──────────────────────────────────── */}
      {tab === "activity" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Activity Log ({activityLogs.length})
            </Text>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.muted }]}
              onPress={async () => {
                setActivityLoading(true);
                await refreshActivity();
                setActivityLoading(false);
              }}
              activeOpacity={0.7}
            >
              {activityLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="refresh-cw" size={14} color={colors.primary} />
              )}
              <Text style={[styles.addBtnText, { color: colors.primary }]}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {activityLogs.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.muted }]}>
              <Feather name="activity" size={24} color={colors.mutedForeground} />
              <Text style={[styles.emptyStateText, { color: colors.mutedForeground }]}>No activity recorded yet</Text>
            </View>
          ) : (
            activityLogs.map((log) => (
              <View key={log.id} style={[styles.logRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.logIcon, { backgroundColor: log.actionType === "create" ? "#D1FAE5" : log.actionType === "delete" ? "#FEE2E2" : "#DBEAFE" }]}>
                  <Feather
                    name={log.actionType === "create" ? "plus" : log.actionType === "delete" ? "trash-2" : "edit-2"}
                    size={12}
                    color={log.actionType === "create" ? "#059669" : log.actionType === "delete" ? "#EF4444" : "#2563EB"}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.logTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {log.entityTitle ?? log.entityType}
                  </Text>
                  <Text style={[styles.logMeta, { color: colors.mutedForeground }]}>
                    {log.userName ?? "System"} · {log.actionType} · {log.entityType} · {new Date(log.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ── Settings Tab ─────────────────────────────────── */}
      {tab === "settings" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 12 }]}>Programme Settings</Text>
          <ProgrammeEditCard
            programme={programme}
            onSave={(name) => programme && updateProgramme(programme.id, { name })}
            colors={colors}
          />

          <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24, marginBottom: 8 }]}>User Roles</Text>
          <View style={[styles.roleInfoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {(["programme_lead", "team_lead"] as UserRole[]).map((role) => (
              <View key={role} style={[styles.roleInfoRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.roleDot, { backgroundColor: ROLE_COLORS[role] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roleInfoLabel, { color: colors.foreground }]}>{ROLE_LABELS[role]}</Text>
                  <Text style={[styles.roleInfoDesc, { color: colors.mutedForeground }]}>
                    {role === "programme_lead"
                      ? "Full access: manage streams, teams, users, all projects and events across the programme"
                      : "Manage tasks, milestones, events and members for their assigned team"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── Role Change Modal ─────────────────────────────── */}
      <Modal visible={!!showRoleModal} transparent animationType="fade" onRequestClose={() => setShowRoleModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Change Role</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>{showRoleModal?.name}</Text>
            <View style={{ gap: 10, marginTop: 16 }}>
              {(["programme_lead", "team_lead"] as UserRole[]).map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[styles.roleOption, { backgroundColor: showRoleModal?.role === role ? ROLE_COLORS[role] : colors.muted }]}
                  onPress={() => showRoleModal && handleRoleChange(showRoleModal, role)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.roleOptionText, { color: showRoleModal?.role === role ? "#fff" : colors.foreground }]}>
                    {ROLE_LABELS[role]}
                  </Text>
                  {showRoleModal?.role === role && <Feather name="check" size={14} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.muted, marginTop: 16 }]} onPress={() => setShowRoleModal(null)}>
              <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Invite Modal ──────────────────────────────────── */}
      <Modal visible={showInvite} transparent animationType="slide" onRequestClose={() => setShowInvite(false)}>
        <InviteForm
          onClose={() => setShowInvite(false)}
          onInvite={inviteUser}
          colors={colors}
        />
      </Modal>
    </View>
  );
}

function ProgrammeEditCard({ programme, onSave, colors }: { programme: any; onSave: (name: string) => void; colors: any }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(programme?.name ?? "Programme");

  if (!programme) return null;

  return (
    <View style={[styles.editCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.editLabel, { color: colors.mutedForeground }]}>Programme Name</Text>
      {editing ? (
        <View style={styles.editRow}>
          <TextInput
            style={[styles.editInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border, flex: 1 }]}
            value={draft}
            onChangeText={setDraft}
            autoFocus
          />
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={() => { onSave(draft); setEditing(false); }}>
            <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" }}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.muted }]} onPress={() => { setDraft(programme.name); setEditing(false); }}>
            <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.editRow}>
          <Text style={[styles.programmeNameText, { color: colors.foreground, flex: 1 }]}>{programme.name}</Text>
          <TouchableOpacity onPress={() => { setDraft(programme.name); setEditing(true); }}>
            <Feather name="edit-2" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function InviteForm({ onClose, onInvite, colors }: {
  onClose: () => void;
  onInvite: (email: string, name: string, role: UserRole, department?: string) => Promise<{ error?: string; acceptUrl?: string }>;
  colors: any;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("team_lead");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [acceptUrl, setAcceptUrl] = useState("");

  async function handleSubmit() {
    if (!email.trim() || !name.trim()) { setError("Email and name are required."); return; }
    setLoading(true);
    const result = await onInvite(email.trim(), name.trim(), role, department.trim() || undefined);
    setLoading(false);
    if (result.error) { setError(result.error); }
    else { setAcceptUrl(result.acceptUrl ?? ""); }
  }

  if (acceptUrl) {
    return (
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="check-circle" size={36} color="#059669" style={{ alignSelf: "center", marginBottom: 12 }} />
          <Text style={[styles.modalTitle, { color: colors.foreground, textAlign: "center" }]}>Invite Sent!</Text>
          <Text style={[styles.modalSub, { color: colors.mutedForeground, textAlign: "center", marginTop: 8 }]}>
            Share this link with the invited user:
          </Text>
          <View style={[styles.urlBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Text style={[styles.urlText, { color: colors.foreground }]} selectable>{acceptUrl}</Text>
          </View>
          <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.primary, marginTop: 16 }]} onPress={onClose}>
            <Text style={[styles.cancelBtnText, { color: "#fff" }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.modalOverlay}>
      <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.modalTitle, { color: colors.foreground }]}>Invite User</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <TextInput
          style={[styles.inviteInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          value={name}
          onChangeText={setName}
          placeholder="Full name"
          placeholderTextColor={colors.mutedForeground}
          autoFocus
        />
        <TextInput
          style={[styles.inviteInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          value={email}
          onChangeText={setEmail}
          placeholder="Email address"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={[styles.inviteInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          value={department}
          onChangeText={setDepartment}
          placeholder="Department (optional)"
          placeholderTextColor={colors.mutedForeground}
        />
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Role</Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          {(["programme_lead", "team_lead"] as UserRole[]).map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.roleChip, { backgroundColor: role === r ? ROLE_COLORS[r] : colors.muted }]}
              onPress={() => setRole(r)}
            >
              <Text style={[styles.roleChipText, { color: role === r ? "#fff" : colors.mutedForeground }]}>
                {ROLE_LABELS[r]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.muted, flex: 1 }]} onPress={onClose}>
            <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.primary, flex: 1 }]} onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.cancelBtnText, { color: "#fff" }]}>Send Invite</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 3, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  addBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  filterChipSmall: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  filterChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  filterDivider: { width: 1, marginHorizontal: 2 },
  userCard: { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  userInfo: { flex: 1, gap: 1 },
  userName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  userEmail: { fontSize: 12, fontFamily: "Inter_400Regular" },
  userDept: { fontSize: 11, fontFamily: "Inter_400Regular" },
  userRight: { alignItems: "flex-end", gap: 4 },
  roleBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  roleText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  userActions: { flexDirection: "row", gap: 4 },
  iconBtn: { width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  youTag: { fontSize: 11, fontFamily: "Inter_500Medium" },
  streamCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8 },
  streamCardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  streamDot: { width: 8, height: 8, borderRadius: 4 },
  streamName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  streamDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  streamMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: 18 },
  teamCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8 },
  teamCardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  teamIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  teamMeta: { flex: 1 },
  teamName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  teamSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  teamLeadLabel: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  deleteBtn: { padding: 6 },
  logRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 6 },
  logIcon: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center", marginTop: 1 },
  logTitle: { fontSize: 13, fontFamily: "Inter_500Medium" },
  logMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  emptyState: { borderRadius: 12, padding: 24, alignItems: "center", gap: 8, marginBottom: 8 },
  emptyStateText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  editCard: { borderRadius: 12, borderWidth: 1, padding: 16, gap: 8 },
  editLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  editRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  editInput: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, fontFamily: "Inter_400Regular" },
  saveBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  programmeNameText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  roleInfoCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  roleInfoRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  roleDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  roleInfoLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  roleInfoDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 16 },
  modalCard: { width: "100%", maxWidth: 400, borderRadius: 16, borderWidth: 1, padding: 20 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4 },
  roleOption: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  roleOptionText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cancelBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  inviteInput: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  roleChip: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center" },
  roleChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  urlBox: { borderRadius: 8, borderWidth: 1, padding: 12, marginTop: 12 },
  urlText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  errorText: { color: "#EF4444", fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 8 },
});
