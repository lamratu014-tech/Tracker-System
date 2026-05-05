import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import { useAudit } from "@/context/AuditContext";
import { useColors } from "@/hooks/useColors";
import type { AuditEntry } from "@/services/audit";

type AdminTab = "users" | "audit" | "settings";

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "#7C3AED",
  manager: "#2563EB",
  viewer: "#64748B",
};

const SEVERITY_COLORS = {
  info: "#2563EB",
  warn: "#F59E0B",
  critical: "#EF4444",
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
  const { entries, clearOldEntries } = useAudit();
  const [tab, setTab] = useState<AdminTab>("users");
  const [auditFilter, setAuditFilter] = useState<"all" | "warn" | "critical">("all");
  const [showInvite, setShowInvite] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState<AppUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  const filteredAudit = useMemo(() => {
    const reversed = [...entries].reverse();
    if (auditFilter === "all") return reversed;
    return reversed.filter((e) => e.severity === auditFilter);
  }, [entries, auditFilter]);

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
    Alert.alert(
      "Deactivate User",
      `Suspend ${user.name}'s access? They will not be able to log in but their data is preserved.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deactivateUser(user.id);
          },
        },
      ]
    );
  }

  function handleReactivate(user: AppUser) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    reactivateUser(user.id);
  }

  function handleDelete(user: AppUser) {
    Alert.alert(
      "Delete User",
      `Permanently delete ${user.name}? This cannot be undone and all their profile data will be removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Permanently",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            deleteUser(user.id);
          },
        },
      ]
    );
  }

  const TABS: { key: AdminTab; label: string; icon: string }[] = [
    { key: "users", label: "Users", icon: "users" },
    { key: "audit", label: "Audit Log", icon: "shield" },
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

      {/* Users Tab */}
      {tab === "users" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad }}>
          {/* Header row */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Team Members ({users.filter((u) => u.active).length} active)
            </Text>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowInvite(true)}
              activeOpacity={0.7}
            >
              <Feather name="user-plus" size={14} color="#fff" />
              <Text style={styles.addBtnText}>Invite</Text>
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={[styles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="search" size={15} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name, email or department…"
              placeholderTextColor={colors.mutedForeground}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7}>
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {/* Role filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 6, paddingRight: 4 }}>
            {(["all", "admin", "manager", "viewer"] as const).map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.filterChipSmall,
                  { backgroundColor: roleFilter === r ? (r === "all" ? colors.primary : ROLE_COLORS[r as UserRole] ?? colors.primary) : colors.muted },
                ]}
                onPress={() => setRoleFilter(r)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, { color: roleFilter === r ? "#fff" : colors.mutedForeground }]}>
                  {r === "all" ? "All Roles" : r.charAt(0).toUpperCase() + r.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={[styles.filterDivider, { backgroundColor: colors.border }]} />
            {(["all", "active", "inactive"] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.filterChipSmall,
                  { backgroundColor: statusFilter === s ? (s === "active" ? "#059669" : s === "inactive" ? "#6B7280" : colors.primary) : colors.muted },
                ]}
                onPress={() => setStatusFilter(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, { color: statusFilter === s ? "#fff" : colors.mutedForeground }]}>
                  {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Result count when filtering */}
          {(searchQuery.length > 0 || roleFilter !== "all" || statusFilter !== "all") && (
            <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
              {filteredUsers.length} of {users.length} members
            </Text>
          )}

          {filteredUsers.length === 0 && (
            <View style={[styles.emptyState, { backgroundColor: colors.muted }]}>
              <Feather name="users" size={24} color={colors.mutedForeground} />
              <Text style={[styles.emptyStateText, { color: colors.mutedForeground }]}>No members match your filters</Text>
            </View>
          )}

          {filteredUsers.map((user) => (
            <View
              key={user.id}
              style={[
                styles.userCard,
                { backgroundColor: colors.card, borderColor: colors.border },
                !user.active && { opacity: 0.5 },
              ]}
            >
              <View style={[styles.avatar, { backgroundColor: ROLE_COLORS[user.role] }]}>
                <Text style={styles.avatarText}>{user.initials}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: colors.foreground }]}>{user.name}</Text>
                <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{user.email}</Text>
                {user.department ? (
                  <Text style={[styles.userDept, { color: colors.mutedForeground }]}>{user.department}</Text>
                ) : null}
              </View>
              <View style={styles.userRight}>
                <TouchableOpacity
                  style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[user.role] + "20" }]}
                  onPress={() => currentUser && user.id !== currentUser.id && user.active && setShowRoleModal(user)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.roleText, { color: ROLE_COLORS[user.role] }]}>
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </Text>
                </TouchableOpacity>
                {currentUser && user.id !== currentUser.id && (
                  <View style={styles.userActions}>
                    {user.active ? (
                      <TouchableOpacity
                        style={[styles.iconBtn, { backgroundColor: "#FEF3C7" }]}
                        onPress={() => handleDeactivate(user)}
                        activeOpacity={0.7}
                      >
                        <Feather name="user-x" size={13} color="#D97706" />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.iconBtn, { backgroundColor: "#D1FAE5" }]}
                        onPress={() => handleReactivate(user)}
                        activeOpacity={0.7}
                      >
                        <Feather name="user-check" size={13} color="#059669" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: "#FEE2E2" }]}
                      onPress={() => handleDelete(user)}
                      activeOpacity={0.7}
                    >
                      <Feather name="trash-2" size={13} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}
                {currentUser && user.id === currentUser.id && (
                  <Text style={[styles.youTag, { color: colors.primary }]}>You</Text>
                )}
              </View>
            </View>
          ))}

          {/* GDPR notice */}
          <View style={[styles.gdprCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="shield" size={14} color={colors.primary} />
            <Text style={[styles.gdprText, { color: colors.mutedForeground }]}>
              User data is processed in accordance with the UK GDPR and Data Protection Act 2018.
              Authentication is handled server-side with bcrypt-hashed passwords and session tokens.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Audit Log Tab */}
      {tab === "audit" && (
        <View style={{ flex: 1 }}>
          <View style={[styles.auditFilters, { borderBottomColor: colors.border }]}>
            {(["all", "warn", "critical"] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, { backgroundColor: auditFilter === f ? colors.primary : colors.muted }]}
                onPress={() => setAuditFilter(f)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterText, { color: auditFilter === f ? "#fff" : colors.mutedForeground }]}>
                  {f === "all" ? "All" : f === "warn" ? "Warnings" : "Critical"}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.filterChip, { backgroundColor: colors.muted, marginLeft: "auto" as any }]}
              onPress={() => {
                Alert.alert("Clear Old Entries", "Remove audit entries older than 90 days?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Clear", onPress: () => clearOldEntries(90) },
                ]);
              }}
              activeOpacity={0.7}
            >
              <Feather name="trash-2" size={12} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad }}>
            {filteredAudit.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.muted }]}>
                <Feather name="shield" size={28} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No audit entries yet</Text>
              </View>
            ) : (
              filteredAudit.map((entry) => <AuditRow key={entry.id} entry={entry} />)
            )}
          </ScrollView>
        </View>
      )}

      {/* Settings Tab */}
      {tab === "settings" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad }}>
          <SectionLabel title="Data & Security" />
          <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingsRow icon="lock" label="Encryption" value="AES-256-GCM" color={colors} />
            <SettingsRow icon="shield" label="Key Storage" value="OS Secure Enclave" color={colors} />
            <SettingsRow icon="database" label="Data Location" value="On-device only" color={colors} />
            <SettingsRow icon="eye-off" label="AI Data Policy" value="No external sharing" color={colors} />
          </View>

          <SectionLabel title="GDPR & Compliance" />
          <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingsRow icon="file-text" label="Regulation" value="UK GDPR / DPA 2018" color={colors} />
            <SettingsRow icon="calendar" label="Data Retention" value="90 days audit log" color={colors} />
            <SettingsRow icon="download" label="Data Export" value="Admin only" color={colors} />
          </View>

          <SectionLabel title="Permissions" />
          <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingsRow icon="user" label="Admin Role" value="Full access" color={colors} />
            <SettingsRow icon="users" label="Manager Role" value="Edit projects & events" color={colors} />
            <SettingsRow icon="eye" label="Viewer Role" value="Read only" color={colors} />
          </View>

          <SectionLabel title="Audit Log" />
          <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingsRow icon="activity" label="Total Entries" value={String(entries.length)} color={colors} />
            <SettingsRow
              icon="alert-triangle"
              label="Critical Events"
              value={String(entries.filter((e) => e.severity === "critical").length)}
              color={colors}
            />
            <TouchableOpacity
              style={[styles.dangerBtn, { borderColor: "#EF4444" }]}
              onPress={() => {
                Alert.alert("Export Data", "Data export would generate a GDPR-compliant report. Contact your DPO for the full export process.", [{ text: "OK" }]);
              }}
              activeOpacity={0.7}
            >
              <Feather name="download" size={14} color="#EF4444" />
              <Text style={styles.dangerBtnText}>Export Organisation Data (GDPR)</Text>
            </TouchableOpacity>
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
            {(["admin", "manager", "viewer"] as UserRole[]).map((role) => (
              <TouchableOpacity
                key={role}
                style={[styles.roleOption, { borderColor: ROLE_COLORS[role] + "40", backgroundColor: ROLE_COLORS[role] + "10" }]}
                onPress={() => showRoleModal && handleRoleChange(showRoleModal, role)}
                activeOpacity={0.7}
              >
                <View style={[styles.roleDot, { backgroundColor: ROLE_COLORS[role] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roleOptionTitle, { color: colors.foreground }]}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Text>
                  <Text style={[styles.roleOptionDesc, { color: colors.mutedForeground }]}>
                    {role === "admin"
                      ? "Full system access, admin panel, user management"
                      : role === "manager"
                      ? "Edit projects, events, and tasks"
                      : "Read-only access to all data"}
                  </Text>
                </View>
                {showRoleModal?.role === role && <Feather name="check" size={16} color={ROLE_COLORS[role]} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: colors.muted }]}
              onPress={() => setShowRoleModal(null)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Invite User Modal */}
      <InviteUserModal
        visible={showInvite}
        onClose={() => setShowInvite(false)}
        onInvite={inviteUser}
      />
    </View>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const colors = useColors();
  const sev = SEVERITY_COLORS[entry.severity];
  return (
    <View style={[auditStyles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[auditStyles.dot, { backgroundColor: sev }]} />
      <View style={{ flex: 1 }}>
        <Text style={[auditStyles.summary, { color: colors.foreground }]}>{entry.summary}</Text>
        <Text style={[auditStyles.meta, { color: colors.mutedForeground }]}>
          {entry.userName} · {new Date(entry.timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </Text>
        {entry.detail ? (
          <Text style={[auditStyles.detail, { color: colors.mutedForeground }]}>{entry.detail}</Text>
        ) : null}
      </View>
      <View style={[auditStyles.severityBadge, { backgroundColor: sev + "20" }]}>
        <Text style={[auditStyles.severityText, { color: sev }]}>{entry.severity}</Text>
      </View>
    </View>
  );
}

const auditStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8, gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  summary: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 2 },
  meta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  detail: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2, fontStyle: "italic" },
  severityBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start" },
  severityText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
});

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

function InviteUserModal({
  visible,
  onClose,
  onInvite,
}: {
  visible: boolean;
  onClose: () => void;
  onInvite: (email: string, name: string, role: UserRole, department?: string) => Promise<{ error?: string; acceptUrl?: string }>;
}) {
  const colors = useColors();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dept, setDept] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ error?: string; acceptUrl?: string } | null>(null);

  function reset() {
    setName(""); setEmail(""); setDept(""); setRole("viewer");
    setLoading(false); setResult(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSend() {
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    const res = await onInvite(email.trim(), name.trim(), role, dept.trim() || undefined);
    setLoading(false);
    setResult(res);
  }

  const ROLES: { value: UserRole; label: string; desc: string }[] = [
    { value: "viewer", label: "Viewer", desc: "Read-only access" },
    { value: "manager", label: "Manager", desc: "Edit projects & events" },
    { value: "admin", label: "Admin", desc: "Full access" },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.sheet, { backgroundColor: colors.card }]}>
          <View style={[modalStyles.handle, { backgroundColor: colors.border }]} />

          {result ? (
            <View style={{ padding: 24, alignItems: "center" }}>
              {result.error ? (
                <>
                  <View style={[modalStyles.resultIcon, { backgroundColor: "#FEE2E2" }]}>
                    <Feather name="alert-circle" size={28} color="#EF4444" />
                  </View>
                  <Text style={[modalStyles.resultTitle, { color: colors.foreground }]}>Failed to Send</Text>
                  <Text style={[modalStyles.resultMsg, { color: colors.mutedForeground }]}>{result.error}</Text>
                  <TouchableOpacity style={[modalStyles.doneBtn, { backgroundColor: colors.primary }]} onPress={() => setResult(null)}>
                    <Text style={modalStyles.doneBtnText}>Try Again</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={[modalStyles.resultIcon, { backgroundColor: "#D1FAE5" }]}>
                    <Feather name="mail" size={28} color="#059669" />
                  </View>
                  <Text style={[modalStyles.resultTitle, { color: colors.foreground }]}>Invite Sent!</Text>
                  <Text style={[modalStyles.resultMsg, { color: colors.mutedForeground }]}>
                    {name} will receive an email to set up their account.
                  </Text>
                  {result.acceptUrl && (
                    <TouchableOpacity
                      style={[modalStyles.linkBox, { backgroundColor: colors.muted, borderColor: colors.border }]}
                      onPress={() => Linking.openURL(result.acceptUrl!)}
                      activeOpacity={0.7}
                    >
                      <Feather name="link" size={12} color={colors.primary} />
                      <Text style={[modalStyles.linkText, { color: colors.primary }]} numberOfLines={1}>
                        {result.acceptUrl}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <Text style={[modalStyles.devNote, { color: colors.mutedForeground }]}>
                    Share the link above if email delivery isn't yet configured.
                  </Text>
                  <TouchableOpacity style={[modalStyles.doneBtn, { backgroundColor: colors.primary }]} onPress={handleClose}>
                    <Text style={modalStyles.doneBtnText}>Done</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            <>
              <Text style={[modalStyles.title, { color: colors.foreground }]}>Invite Team Member</Text>

              <View style={[modalStyles.field]}>
                <Text style={[modalStyles.label, { color: colors.mutedForeground }]}>Full Name</Text>
                <TextInput
                  style={[modalStyles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Jane Smith"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <View style={modalStyles.field}>
                <Text style={[modalStyles.label, { color: colors.mutedForeground }]}>Email Address</Text>
                <TextInput
                  style={[modalStyles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="jane@organisation.org"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={modalStyles.field}>
                <Text style={[modalStyles.label, { color: colors.mutedForeground }]}>Department (optional)</Text>
                <TextInput
                  style={[modalStyles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground }]}
                  value={dept}
                  onChangeText={setDept}
                  placeholder="e.g. Operations"
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <View style={modalStyles.field}>
                <Text style={[modalStyles.label, { color: colors.mutedForeground }]}>Role</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {ROLES.map((r) => (
                    <TouchableOpacity
                      key={r.value}
                      style={[
                        modalStyles.roleChip,
                        {
                          borderColor: role === r.value ? ROLE_COLORS[r.value] : colors.border,
                          backgroundColor: role === r.value ? ROLE_COLORS[r.value] + "15" : colors.background,
                          flex: 1,
                        },
                      ]}
                      onPress={() => setRole(r.value)}
                      activeOpacity={0.7}
                    >
                      <Text style={[modalStyles.roleChipLabel, { color: role === r.value ? ROLE_COLORS[r.value] : colors.foreground }]}>
                        {r.label}
                      </Text>
                      <Text style={[modalStyles.roleChipDesc, { color: colors.mutedForeground }]}>{r.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  style={[modalStyles.cancelBtn, { borderColor: colors.border, flex: 1 }]}
                  onPress={handleClose}
                  activeOpacity={0.7}
                >
                  <Text style={[modalStyles.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    modalStyles.sendBtn,
                    { backgroundColor: colors.primary, flex: 1, opacity: (!name.trim() || !email.trim() || loading) ? 0.6 : 1 },
                  ]}
                  onPress={handleSend}
                  disabled={!name.trim() || !email.trim() || loading}
                  activeOpacity={0.7}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Feather name="send" size={14} color="#fff" />
                      <Text style={modalStyles.sendBtnText}>Send Invite</Text>
                    </>
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

const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 16 },
  field: { marginBottom: 12 },
  label: { fontSize: 11, fontFamily: "Inter_500Medium", marginBottom: 5 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  roleChip: { borderWidth: 1.5, borderRadius: 8, padding: 8, alignItems: "center" },
  roleChipLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  roleChipDesc: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2, textAlign: "center" },
  cancelBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  sendBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
  sendBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  resultIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  resultTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 8 },
  resultMsg: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 16 },
  linkBox: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 8, maxWidth: "100%" },
  linkText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
  devNote: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 20, fontStyle: "italic" },
  doneBtn: { paddingVertical: 12, paddingHorizontal: 32, borderRadius: 10, alignItems: "center" },
  doneBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  addBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", padding: 0 },
  filterChipSmall: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  filterChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  filterDivider: { width: 1, marginHorizontal: 2 },
  resultCount: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 8 },
  emptyState: { alignItems: "center", padding: 24, borderRadius: 12, gap: 8 },
  emptyStateText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  userCard: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8, gap: 10, alignItems: "center" },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  userInfo: { flex: 1, minWidth: 0 },
  userName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  userEmail: { fontSize: 11, fontFamily: "Inter_400Regular" },
  userDept: { fontSize: 11, fontFamily: "Inter_400Regular" },
  userRight: { alignItems: "flex-end", gap: 6 },
  roleBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  roleText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  userActions: { flexDirection: "row", gap: 4 },
  iconBtn: { width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  youTag: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  gdprCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 8 },
  gdprText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  auditFilters: { flexDirection: "row", gap: 6, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  filterText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  empty: { alignItems: "center", padding: 32, borderRadius: 12, gap: 8 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  settingsCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 4 },
  dangerBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 8 },
  dangerBtnText: { color: "#EF4444", fontSize: 12, fontFamily: "Inter_500Medium" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 },
  modalCard: { borderRadius: 16, padding: 20, gap: 10 },
  modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 4 },
  roleOption: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, padding: 12, gap: 10 },
  roleDot: { width: 10, height: 10, borderRadius: 5 },
  roleOptionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  roleOptionDesc: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  cancelBtn: { borderRadius: 10, padding: 12, alignItems: "center", marginTop: 4 },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
