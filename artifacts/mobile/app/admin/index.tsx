import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
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
  const { users, currentUser, updateUserRole, addUser, deactivateUser, switchUser } = useAuth();
  const { entries, clearOldEntries } = useAudit();
  const [tab, setTab] = useState<AdminTab>("users");
  const [auditFilter, setAuditFilter] = useState<"all" | "warn" | "critical">("all");
  const [showAddUser, setShowAddUser] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState<AppUser | null>(null);

  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  const filteredAudit = useMemo(() => {
    const reversed = [...entries].reverse();
    if (auditFilter === "all") return reversed;
    return reversed.filter((e) => e.severity === auditFilter);
  }, [entries, auditFilter]);

  function handleRoleChange(user: AppUser, role: UserRole) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateUserRole(user.id, role);
    setShowRoleModal(null);
  }

  function handleDeactivate(user: AppUser) {
    Alert.alert(
      "Deactivate User",
      `Remove ${user.name}'s access to the system?`,
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
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Team Members ({users.filter((u) => u.active).length} active)
            </Text>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowAddUser(true)}
              activeOpacity={0.7}
            >
              <Feather name="user-plus" size={14} color="#fff" />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {users.map((user) => (
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
                <Text style={[styles.userDept, { color: colors.mutedForeground }]}>{user.department}</Text>
              </View>
              <View style={styles.userRight}>
                <TouchableOpacity
                  style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[user.role] + "20" }]}
                  onPress={() => user.id !== currentUser.id && setShowRoleModal(user)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.roleText, { color: ROLE_COLORS[user.role] }]}>
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </Text>
                </TouchableOpacity>
                {user.id !== currentUser.id && user.active && (
                  <View style={styles.userActions}>
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: colors.muted }]}
                      onPress={() => switchUser(user.id)}
                      activeOpacity={0.7}
                    >
                      <Feather name="log-in" size={13} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.iconBtn, { backgroundColor: "#FEE2E2" }]}
                      onPress={() => handleDeactivate(user)}
                      activeOpacity={0.7}
                    >
                      <Feather name="user-x" size={13} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}
                {user.id === currentUser.id && (
                  <Text style={[styles.youTag, { color: colors.primary }]}>You</Text>
                )}
              </View>
            </View>
          ))}

          {/* GDPR notice */}
          <View style={[styles.gdprCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="shield" size={14} color={colors.primary} />
            <Text style={[styles.gdprText, { color: colors.mutedForeground }]}>
              User data is processed in accordance with the UK GDPR and Data Protection Act 2018. Personal data is
              stored locally on this device and encrypted at rest. No data is shared with third parties.
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
                    {role === "admin" ? "Full system access, admin panel, user management" : role === "manager" ? "Edit projects, events, and tasks" : "Read-only access to all data"}
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

      {/* Add User Modal */}
      <AddUserModal
        visible={showAddUser}
        onClose={() => setShowAddUser(false)}
        onAdd={(user) => { addUser(user); setShowAddUser(false); }}
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
  return (
    <Text style={[settingsStyles.label, { color: colors.mutedForeground }]}>{title}</Text>
  );
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

function AddUserModal({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (user: Omit<AppUser, "id" | "createdAt">) => void;
}) {
  const colors = useColors();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dept, setDept] = useState("");
  const [role, setRole] = useState<UserRole>("viewer");

  function handleAdd() {
    if (!name.trim() || !email.trim()) return;
    const initials = name.trim().split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    onAdd({ name: name.trim(), email: email.trim(), initials, department: dept, role, active: true });
    setName(""); setEmail(""); setDept(""); setRole("viewer");
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Team Member</Text>
          {[
            { label: "Full Name", value: name, set: setName, placeholder: "Jane Smith" },
            { label: "Email", value: email, set: setEmail, placeholder: "j.smith@org.com" },
            { label: "Department", value: dept, set: setDept, placeholder: "e.g. Finance" },
          ].map((f) => (
            <View key={f.label} style={{ marginBottom: 10 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{f.label}</Text>
              <TextInput
                style={[styles.fieldInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={f.value}
                onChangeText={f.set}
                placeholder={f.placeholder}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          ))}
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Role</Text>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            {(["viewer", "manager", "admin"] as UserRole[]).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.roleChip, { backgroundColor: role === r ? ROLE_COLORS[r] : colors.muted }]}
                onPress={() => setRole(r)}
                activeOpacity={0.7}
              >
                <Text style={[styles.roleChipText, { color: role === r ? "#fff" : colors.mutedForeground }]}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.muted, flex: 1 }]} onPress={onClose} activeOpacity={0.7}>
              <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: colors.primary, flex: 1 }]}
              onPress={handleAdd}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: "#fff" }]}>Add Member</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium" },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  userInfo: { flex: 1 },
  userName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  userEmail: { fontSize: 12, fontFamily: "Inter_400Regular" },
  userDept: { fontSize: 11, fontFamily: "Inter_400Regular" },
  userRight: { alignItems: "flex-end", gap: 6 },
  roleBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  roleText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  userActions: { flexDirection: "row", gap: 6 },
  iconBtn: { width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  youTag: { fontSize: 11, fontFamily: "Inter_500Medium" },
  gdprCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    alignItems: "flex-start",
  },
  gdprText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  auditFilters: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  filterChip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  filterText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  empty: { borderRadius: 12, padding: 32, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  settingsCard: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
  },
  dangerBtnText: { color: "#EF4444", fontSize: 13, fontFamily: "Inter_500Medium" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  modalCard: { borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold", marginBottom: 16 },
  roleOption: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  roleDot: { width: 10, height: 10, borderRadius: 5 },
  roleOptionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  roleOptionDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  cancelBtn: { borderRadius: 10, padding: 12, alignItems: "center" },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4 },
  fieldInput: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  roleChip: { flex: 1, borderRadius: 8, paddingVertical: 7, alignItems: "center" },
  roleChipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
