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
import { useData, type Team, type ActivityLog } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

type AdminTab = "users" | "teams" | "activity" | "settings";

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "#7C3AED",
  team_leader: "#2563EB",
  owner: "#059669",
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  team_leader: "Team Leader",
  owner: "Owner",
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
    teams,
    activityLogs,
    createTeam,
    updateTeam,
    deleteTeam,
    refreshActivity,
  } = useData();

  const [tab, setTab] = useState<AdminTab>("users");
  const [showInvite, setShowInvite] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState<AppUser | null>(null);
  const [showTeamModal, setShowTeamModal] = useState<Team | "new" | null>(null);
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
      { text: "Deactivate", style: "destructive", onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); deactivateUser(user.id); } },
    ]);
  }

  function handleReactivate(user: AppUser) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    reactivateUser(user.id);
  }

  function handleDelete(user: AppUser) {
    Alert.alert("Delete User", `Permanently delete ${user.name}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete Permanently", style: "destructive", onPress: () => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); deleteUser(user.id); } },
    ]);
  }

  function handleDeleteTeam(team: Team) {
    Alert.alert("Delete Team", `Delete "${team.name}" and all its projects? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteTeam(team.id) },
    ]);
  }

  const TABS: { key: AdminTab; label: string; icon: string }[] = [
    { key: "users", label: "Users", icon: "users" },
    { key: "teams", label: "Teams", icon: "briefcase" },
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

      {/* ── Users Tab ──────────────────────────────────────────────── */}
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
            {(["all", "admin", "team_leader", "owner"] as const).map((r) => (
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
                        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: "#D1FAE5" }]} onPress={() => handleReactivate(user)} activeOpacity={0.7}>
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
              <Text style={[styles.emptyStateText, { color: colors.mutedForeground }]}>No members match your filters</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ── Teams Tab ──────────────────────────────────────────────── */}
      {tab === "teams" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Teams ({teams.length})
            </Text>
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowTeamModal("new")} activeOpacity={0.7}>
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
            const leader = teamUsers.find((u) => u.role === "team_leader");
            const owner = teamUsers.find((u) => u.role === "owner");
            return (
              <View key={team.id} style={[styles.teamCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.teamCardHeader}>
                  <View style={[styles.teamIcon, { backgroundColor: colors.primary + "20" }]}>
                    <Feather name="briefcase" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.teamName, { color: colors.foreground }]}>{team.name}</Text>
                    {team.functionLabel && <Text style={[styles.teamFunction, { color: colors.mutedForeground }]}>{team.functionLabel}</Text>}
                  </View>
                  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.muted }]} onPress={() => setShowTeamModal(team)} activeOpacity={0.7}>
                    <Feather name="edit-2" size={13} color={colors.foreground} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: "#FEE2E2" }]} onPress={() => handleDeleteTeam(team)} activeOpacity={0.7}>
                    <Feather name="trash-2" size={13} color="#EF4444" />
                  </TouchableOpacity>
                </View>
                <View style={styles.teamMembers}>
                  <View style={styles.teamMemberChip}>
                    <Feather name="shield" size={11} color="#2563EB" />
                    <Text style={[styles.teamMemberText, { color: colors.mutedForeground }]}>
                      Leader: {leader?.name ?? "Unassigned"}
                    </Text>
                  </View>
                  <View style={styles.teamMemberChip}>
                    <Feather name="user" size={11} color="#059669" />
                    <Text style={[styles.teamMemberText, { color: colors.mutedForeground }]}>
                      Owner: {owner?.name ?? "Unassigned"}
                    </Text>
                  </View>
                  <Text style={[styles.teamMemberCount, { color: colors.mutedForeground }]}>
                    {teamUsers.length} user{teamUsers.length !== 1 ? "s" : ""}
                  </Text>
                </View>
              </View>
            );
          })}

          <View style={[styles.gdprCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="info" size={14} color={colors.primary} />
            <Text style={[styles.gdprText, { color: colors.mutedForeground }]}>
              Assign Team Leaders and Owners to teams from the Users tab by changing their role. Team Leaders and Owners are automatically associated with the team during invite or role update.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* ── Activity Tab ───────────────────────────────────────────── */}
      {tab === "activity" && (
        <View style={{ flex: 1 }}>
          <View style={[styles.activityHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Activity Log</Text>
            <TouchableOpacity
              style={[styles.refreshBtn, { backgroundColor: colors.muted }]}
              onPress={async () => { setActivityLoading(true); await refreshActivity(); setActivityLoading(false); }}
              activeOpacity={0.7}
            >
              {activityLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="refresh-cw" size={14} color={colors.primary} />}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad }}>
            {activityLogs.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: colors.muted }]}>
                <Feather name="activity" size={24} color={colors.mutedForeground} />
                <Text style={[styles.emptyStateText, { color: colors.mutedForeground }]}>No activity yet</Text>
              </View>
            ) : (
              activityLogs.map((log) => <ActivityRow key={log.id} log={log} />)
            )}
          </ScrollView>
        </View>
      )}

      {/* ── Settings Tab ───────────────────────────────────────────── */}
      {tab === "settings" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad }}>
          <SectionLabel title="Role Permissions" />
          <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingsRow icon="shield" label="Admin" value="Full system access" color={colors} />
            <SettingsRow icon="users" label="Team Leader" value="Manage own team's data" color={colors} />
            <SettingsRow icon="user" label="Owner" value="View + approve milestones, update phase" color={colors} />
          </View>

          <SectionLabel title="Data Isolation" />
          <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingsRow icon="lock" label="Team data" value="Isolated per team" color={colors} />
            <SettingsRow icon="globe" label="Events" value="Controlled cross-team sharing" color={colors} />
            <SettingsRow icon="eye-off" label="Private content" value="Backend-enforced" color={colors} />
          </View>

          <SectionLabel title="Security" />
          <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingsRow icon="key" label="Authentication" value="bcrypt + session tokens" color={colors} />
            <SettingsRow icon="database" label="Storage" value="PostgreSQL (server-side)" color={colors} />
            <SettingsRow icon="file-text" label="Compliance" value="UK GDPR / DPA 2018" color={colors} />
          </View>
        </ScrollView>
      )}

      {/* Role Change Modal */}
      <Modal visible={!!showRoleModal} transparent animationType="fade" onRequestClose={() => setShowRoleModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Change Role — {showRoleModal?.name}
            </Text>
            {(["admin", "team_leader", "owner"] as UserRole[]).map((role) => (
              <TouchableOpacity
                key={role}
                style={[styles.roleOption, { borderColor: ROLE_COLORS[role] + "40", backgroundColor: ROLE_COLORS[role] + "10" }]}
                onPress={() => showRoleModal && handleRoleChange(showRoleModal, role)}
                activeOpacity={0.7}
              >
                <View style={[styles.roleDot, { backgroundColor: ROLE_COLORS[role] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roleOptionTitle, { color: colors.foreground }]}>{ROLE_LABELS[role]}</Text>
                  <Text style={[styles.roleOptionDesc, { color: colors.mutedForeground }]}>
                    {role === "admin" ? "Full system access, user management, all teams"
                      : role === "team_leader" ? "Manage tasks, milestones, events for own team"
                      : "View own team, approve milestones, update phase/notes"}
                  </Text>
                </View>
                {showRoleModal?.role === role && <Feather name="check" size={16} color={ROLE_COLORS[role]} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.muted }]} onPress={() => setShowRoleModal(null)} activeOpacity={0.7}>
              <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Team Create/Edit Modal */}
      <TeamModal
        visible={!!showTeamModal}
        team={showTeamModal === "new" ? null : showTeamModal}
        onClose={() => setShowTeamModal(null)}
        onSave={async (name, functionLabel) => {
          if (showTeamModal === "new") {
            await createTeam({ name, functionLabel });
          } else if (showTeamModal) {
            await updateTeam(showTeamModal.id, { name, functionLabel });
          }
          setShowTeamModal(null);
        }}
      />

      {/* Invite User Modal */}
      <InviteUserModal visible={showInvite} onClose={() => setShowInvite(false)} onInvite={inviteUser} />
    </View>
  );
}

function ActivityRow({ log }: { log: ActivityLog }) {
  const colors = useColors();
  const ACTION_ICONS: Record<string, string> = {
    create: "plus-circle",
    update: "edit-2",
    delete: "trash-2",
  };
  const ACTION_COLORS: Record<string, string> = {
    create: "#059669",
    update: "#2563EB",
    delete: "#EF4444",
  };
  const icon = ACTION_ICONS[log.actionType] ?? "activity";
  const color = ACTION_COLORS[log.actionType] ?? "#6B7280";

  return (
    <View style={[aStyles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[aStyles.icon, { backgroundColor: color + "20" }]}>
        <Feather name={icon as any} size={13} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[aStyles.text, { color: colors.foreground }]} numberOfLines={2}>
          <Text style={{ fontFamily: "Inter_600SemiBold" }}>{log.userName ?? "System"}</Text>
          {` ${log.actionType}d `}
          <Text style={{ fontFamily: "Inter_600SemiBold" }}>{log.entityTitle ?? log.entityType}</Text>
        </Text>
        <Text style={[aStyles.meta, { color: colors.mutedForeground }]}>
          {log.userRole ? ROLE_LABELS[log.userRole as UserRole] ?? log.userRole : "—"} · {log.entityType} · {new Date(log.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    </View>
  );
}

const aStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8 },
  icon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  text: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 2 },
  meta: { fontSize: 11, fontFamily: "Inter_400Regular" },
});

function TeamModal({ visible, team, onClose, onSave }: {
  visible: boolean;
  team: Team | null;
  onClose: () => void;
  onSave: (name: string, functionLabel?: string) => Promise<void>;
}) {
  const colors = useColors();
  const [name, setName] = useState(team?.name ?? "");
  const [fn, setFn] = useState(team?.functionLabel ?? "");
  const [saving, setSaving] = useState(false);

  React.useEffect(() => { setName(team?.name ?? ""); setFn(team?.functionLabel ?? ""); }, [team, visible]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(name.trim(), fn.trim() || undefined);
    setSaving(false);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>{team ? "Edit Team" : "New Team"}</Text>
          <Text style={[{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 4 }]}>Team Name</Text>
          <TextInput
            style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Engineering"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
          />
          <Text style={[{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 4 }]}>Function Label (optional)</Text>
          <TextInput
            style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            value={fn}
            onChangeText={setFn}
            placeholder="e.g. Product & Technology"
            placeholderTextColor={colors.mutedForeground}
          />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.muted, flex: 1 }]} onPress={onClose} activeOpacity={0.7}>
              <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: colors.primary, flex: 1 }]}
              onPress={handleSave}
              disabled={!name.trim() || saving}
              activeOpacity={0.7}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.cancelBtnText, { color: "#fff" }]}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function InviteUserModal({ visible, onClose, onInvite }: {
  visible: boolean;
  onClose: () => void;
  onInvite: (email: string, name: string, role: UserRole, department?: string) => Promise<{ error?: string; acceptUrl?: string }>;
}) {
  const colors = useColors();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dept, setDept] = useState("");
  const [role, setRole] = useState<UserRole>("owner");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ error?: string; acceptUrl?: string } | null>(null);

  function reset() { setName(""); setEmail(""); setDept(""); setRole("owner"); setLoading(false); setResult(null); }
  function handleClose() { reset(); onClose(); }

  async function handleSend() {
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    const res = await onInvite(email.trim(), name.trim(), role, dept.trim() || undefined);
    setLoading(false);
    setResult(res);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
          {result ? (
            <>
              {result.error ? (
                <>
                  <Feather name="alert-circle" size={32} color="#EF4444" style={{ alignSelf: "center", marginBottom: 8 }} />
                  <Text style={[styles.modalTitle, { color: colors.foreground, textAlign: "center" }]}>Invite Failed</Text>
                  <Text style={[{ color: colors.mutedForeground, textAlign: "center", fontSize: 13, marginBottom: 16 }]}>{result.error}</Text>
                </>
              ) : (
                <>
                  <Feather name="check-circle" size={32} color="#059669" style={{ alignSelf: "center", marginBottom: 8 }} />
                  <Text style={[styles.modalTitle, { color: colors.foreground, textAlign: "center" }]}>Invite Sent!</Text>
                  <Text style={[{ color: colors.mutedForeground, textAlign: "center", fontSize: 13, marginBottom: 8 }]}>
                    An invite email has been sent to {email}.
                  </Text>
                  {result.acceptUrl && (
                    <View style={[{ backgroundColor: colors.muted, borderRadius: 8, padding: 10, marginBottom: 12 }]}>
                      <Text style={[{ color: colors.mutedForeground, fontSize: 11 }]}>Dev link:</Text>
                      <Text style={[{ color: colors.primary, fontSize: 11, fontFamily: "Inter_500Medium" }]} selectable>{result.acceptUrl}</Text>
                    </View>
                  )}
                </>
              )}
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.primary }]} onPress={handleClose} activeOpacity={0.7}>
                <Text style={[styles.cancelBtnText, { color: "#fff" }]}>Done</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Invite User</Text>
              {[
                { label: "Full Name", value: name, setter: setName, placeholder: "Jane Smith" },
                { label: "Email Address", value: email, setter: setEmail, placeholder: "jane@example.com" },
                { label: "Department (optional)", value: dept, setter: setDept, placeholder: "e.g. Operations" },
              ].map(({ label, value, setter, placeholder }) => (
                <View key={label} style={{ marginBottom: 12 }}>
                  <Text style={[{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 4 }]}>{label}</Text>
                  <TextInput
                    style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                    value={value}
                    onChangeText={setter}
                    placeholder={placeholder}
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType={label === "Email Address" ? "email-address" : "default"}
                    autoCapitalize="none"
                  />
                </View>
              ))}
              <Text style={[{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginBottom: 6 }]}>Role</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                {(["admin", "team_leader", "owner"] as UserRole[]).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleChip, { backgroundColor: role === r ? ROLE_COLORS[r] : colors.muted }]}
                    onPress={() => setRole(r)}
                    activeOpacity={0.7}
                  >
                    <Text style={[{ fontSize: 12, fontFamily: "Inter_500Medium", color: role === r ? "#fff" : colors.mutedForeground }]}>
                      {ROLE_LABELS[r]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.muted, flex: 1 }]} onPress={handleClose} activeOpacity={0.7}>
                  <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelBtn, { backgroundColor: name.trim() && email.trim() ? colors.primary : colors.muted, flex: 1 }]}
                  onPress={handleSend}
                  disabled={!name.trim() || !email.trim() || loading}
                  activeOpacity={0.7}
                >
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : (
                    <Text style={[styles.cancelBtnText, { color: name.trim() && email.trim() ? "#fff" : colors.mutedForeground }]}>Send Invite</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function SectionLabel({ title }: { title: string }) {
  const colors = useColors();
  return <Text style={[settingsStyles.label, { color: colors.mutedForeground }]}>{title}</Text>;
}

function SettingsRow({ icon, label, value, color }: { icon: string; label: string; value: string; color: any }) {
  return (
    <View style={[settingsStyles.row, { borderBottomColor: color.border }]}>
      <View style={[settingsStyles.icon, { backgroundColor: color.muted }]}>
        <Feather name={icon as any} size={14} color={color.primary} />
      </View>
      <Text style={[settingsStyles.label2, { color: color.foreground }]}>{label}</Text>
      <Text style={[settingsStyles.value, { color: color.mutedForeground }]}>{value}</Text>
    </View>
  );
}

const settingsStyles = StyleSheet.create({
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 16, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  icon: { width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  label2: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  value: { fontSize: 12, fontFamily: "Inter_500Medium" },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 4 },
  tabText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  addBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  filterChipSmall: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  filterChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  filterDivider: { width: 1, marginHorizontal: 2 },
  userCard: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8, gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  userInfo: { flex: 1, gap: 1 },
  userName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  userEmail: { fontSize: 11, fontFamily: "Inter_400Regular" },
  userDept: { fontSize: 11, fontFamily: "Inter_400Regular" },
  userRight: { alignItems: "flex-end", gap: 6 },
  roleBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  roleText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  userActions: { flexDirection: "row", gap: 6 },
  iconBtn: { width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  youTag: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  emptyState: { borderRadius: 12, padding: 32, alignItems: "center", gap: 8 },
  emptyStateText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  teamCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  teamCardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  teamIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  teamName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  teamFunction: { fontSize: 12, fontFamily: "Inter_400Regular" },
  teamMembers: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  teamMemberChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  teamMemberText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  teamMemberCount: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: "auto" as any },
  activityHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  refreshBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  gdprCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 8 },
  gdprText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  settingsCard: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, marginBottom: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  modalCard: { borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 16 },
  modalInput: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 12 },
  roleOption: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8, gap: 10 },
  roleDot: { width: 10, height: 10, borderRadius: 5 },
  roleOptionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  roleOptionDesc: { fontSize: 11, fontFamily: "Inter_400Regular" },
  cancelBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  roleChip: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
});
