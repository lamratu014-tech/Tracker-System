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
import { useData, type Team, type Stream } from "@/context/DataContext";
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

// ─── Reusable form modal shell ───────────────────────────────────────────────
function FormModal({
  visible,
  title,
  onClose,
  children,
  colors,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  colors: any;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

// ─── Team picker pill list ────────────────────────────────────────────────────
function TeamPicker({
  teams,
  selectedId,
  onSelect,
  colors,
  allowNone = false,
}: {
  teams: Team[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  colors: any;
  allowNone?: boolean;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
      {allowNone && (
        <TouchableOpacity
          style={[styles.teamPill, selectedId === null && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => onSelect(null)}
        >
          <Text style={[styles.teamPillText, { color: selectedId === null ? "#fff" : colors.mutedForeground }]}>None</Text>
        </TouchableOpacity>
      )}
      {teams.map((t) => (
        <TouchableOpacity
          key={t.id}
          style={[styles.teamPill, { borderColor: colors.border }, selectedId === t.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => onSelect(t.id)}
        >
          {selectedId === t.id && <Feather name="check" size={11} color="#fff" />}
          <Text style={[styles.teamPillText, { color: selectedId === t.id ? "#fff" : colors.foreground }]}>{t.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── Role change + team assign modal ─────────────────────────────────────────
function RoleModal({
  user,
  teams,
  onSave,
  onClose,
  colors,
}: {
  user: AppUser;
  teams: Team[];
  onSave: (role: UserRole, teamId: string | null) => void;
  onClose: () => void;
  colors: any;
}) {
  const [role, setRole] = useState<UserRole>(user.role);
  const [teamId, setTeamId] = useState<string | null>(user.teamId);

  return (
    <FormModal visible title={`Edit: ${user.name}`} onClose={onClose} colors={colors}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Role</Text>
          <View style={{ gap: 10, marginTop: 8 }}>
            {(["programme_lead", "team_lead"] as UserRole[]).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.roleOption, { backgroundColor: role === r ? ROLE_COLORS[r] : colors.muted, borderColor: role === r ? ROLE_COLORS[r] : colors.border }]}
                onPress={() => setRole(r)}
                activeOpacity={0.8}
              >
                <View>
                  <Text style={[styles.roleOptionLabel, { color: role === r ? "#fff" : colors.foreground }]}>{ROLE_LABELS[r]}</Text>
                  <Text style={[styles.roleOptionDesc, { color: role === r ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}>
                    {r === "programme_lead"
                      ? "Full access across the entire programme"
                      : "Manage own team's tasks, events, members"}
                  </Text>
                </View>
                {role === r && <Feather name="check-circle" size={18} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            Assign to Team {role === "programme_lead" ? "(optional)" : "(required for Team Lead)"}
          </Text>
          <View style={{ marginTop: 8 }}>
            <TeamPicker teams={teams} selectedId={teamId} onSelect={setTeamId} colors={colors} allowNone />
          </View>
          {teams.length === 0 && (
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>Create teams first in the Structure tab.</Text>
          )}
        </View>

        <View style={styles.rowBtns}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted }]} onPress={onClose}>
            <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: ROLE_COLORS[role] }]}
            onPress={() => { onSave(role, teamId); onClose(); }}
          >
            <Text style={[styles.btnText, { color: "#fff" }]}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </FormModal>
  );
}

// ─── Shared user form fields (name, email, dept, role, team) ─────────────────
function UserFormFields({
  name, setName, email, setEmail, department, setDepartment,
  role, setRole, teamId, setTeamId, teams, colors, showEmail = true,
}: {
  name: string; setName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  department: string; setDepartment: (v: string) => void;
  role: UserRole; setRole: (r: UserRole) => void;
  teamId: string | null; setTeamId: (id: string | null) => void;
  teams: Team[]; colors: any; showEmail?: boolean;
}) {
  return (
    <>
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Full Name *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          value={name} onChangeText={setName} placeholder="e.g. Jane Smith"
          placeholderTextColor={colors.mutedForeground} autoFocus
        />
      </View>
      {showEmail && (
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Email Address *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={email} onChangeText={setEmail} placeholder="jane@example.com"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none" keyboardType="email-address"
          />
        </View>
      )}
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Department (optional)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
          value={department} onChangeText={setDepartment} placeholder="e.g. Marketing"
          placeholderTextColor={colors.mutedForeground}
        />
      </View>
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Role *</Text>
        <View style={{ gap: 8, marginTop: 6 }}>
          {(["programme_lead", "team_lead"] as UserRole[]).map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.roleOption, { backgroundColor: role === r ? ROLE_COLORS[r] : colors.muted, borderColor: role === r ? ROLE_COLORS[r] : colors.border }]}
              onPress={() => setRole(r)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.roleOptionLabel, { color: role === r ? "#fff" : colors.foreground }]}>{ROLE_LABELS[r]}</Text>
                <Text style={[styles.roleOptionDesc, { color: role === r ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}>
                  {r === "programme_lead" ? "Full access across the programme" : "Manage own team's workspace"}
                </Text>
              </View>
              {role === r && <Feather name="check-circle" size={16} color="#fff" />}
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={styles.field}>
        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
          Assign to Team {role === "programme_lead" ? "(optional)" : "(select a team)"}
        </Text>
        <View style={{ marginTop: 6 }}>
          <TeamPicker teams={teams} selectedId={teamId} onSelect={setTeamId} colors={colors} allowNone />
        </View>
        {teams.length === 0 && (
          <Text style={[styles.hintText, { color: colors.mutedForeground, marginTop: 4 }]}>
            Create teams first in the Structure tab.
          </Text>
        )}
      </View>
    </>
  );
}

// ─── Add User modal (two modes: direct create + invite link) ──────────────────
function AddUserModal({
  teams,
  onCreateUser,
  onInvite,
  onClose,
  colors,
}: {
  teams: Team[];
  onCreateUser: (email: string, name: string, password: string, role: UserRole, department?: string, teamId?: string | null) => Promise<{ error?: string }>;
  onInvite: (email: string, name: string, role: UserRole, department?: string, teamId?: string | null) => Promise<{ error?: string; acceptUrl?: string }>;
  onClose: () => void;
  colors: any;
}) {
  type Mode = "direct" | "invite";
  const [mode, setMode] = useState<Mode>("direct");

  // Shared fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState<UserRole>("team_lead");
  const [teamId, setTeamId] = useState<string | null>(null);

  // Direct-add only
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ type: "direct" | "invite"; userName: string; acceptUrl?: string } | null>(null);

  function reset() {
    setName(""); setEmail(""); setDepartment(""); setRole("team_lead");
    setTeamId(null); setPassword(""); setError(""); setDone(null);
  }

  async function handleDirect() {
    if (!name.trim() || !email.trim()) { setError("Name and email are required."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError("");
    const result = await onCreateUser(email.trim(), name.trim(), password, role, department.trim() || undefined, teamId);
    setLoading(false);
    if (result.error) setError(result.error);
    else setDone({ type: "direct", userName: name.trim() });
  }

  async function handleInvite() {
    if (!name.trim() || !email.trim()) { setError("Name and email are required."); return; }
    setLoading(true); setError("");
    const result = await onInvite(email.trim(), name.trim(), role, department.trim() || undefined, teamId);
    setLoading(false);
    if (result.error) setError(result.error);
    else setDone({ type: "invite", userName: name.trim(), acceptUrl: result.acceptUrl });
  }

  if (done) {
    return (
      <FormModal visible title={done.type === "direct" ? "User Added!" : "Invite Created!"} onClose={() => { reset(); onClose(); }} colors={colors}>
        <View style={{ padding: 24, alignItems: "center", gap: 14 }}>
          <View style={[styles.successIcon, { backgroundColor: "#D1FAE5" }]}>
            <Feather name="check" size={28} color="#059669" />
          </View>
          <Text style={[styles.successText, { color: colors.foreground, textAlign: "center" }]}>
            {done.type === "direct"
              ? `${done.userName} has been added. They can now log in with their email and password.`
              : `Invite created for ${done.userName}.`}
          </Text>
          {done.acceptUrl && (
            <>
              <Text style={[styles.hintText, { color: colors.mutedForeground, textAlign: "center" }]}>
                Share this link — they'll set their own password when they open it:
              </Text>
              <View style={[styles.urlBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Text style={[styles.urlText, { color: colors.foreground }]} selectable>{done.acceptUrl}</Text>
              </View>
            </>
          )}
          <View style={styles.rowBtns}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted, flex: 1 }]} onPress={() => { reset(); }}>
              <Feather name="user-plus" size={14} color={colors.primary} />
              <Text style={[styles.btnText, { color: colors.primary }]}>Add Another</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }]} onPress={() => { reset(); onClose(); }}>
              <Text style={[styles.btnText, { color: "#fff" }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </FormModal>
    );
  }

  return (
    <FormModal visible title="Add User" onClose={onClose} colors={colors}>
      {/* Mode toggle */}
      <View style={[styles.modeToggleRow, { borderBottomColor: colors.border }]}>
        {([
          { key: "direct", label: "Add Directly", icon: "user-check" },
          { key: "invite", label: "Send Invite Link", icon: "link" },
        ] as { key: Mode; label: string; icon: string }[]).map((m) => (
          <TouchableOpacity
            key={m.key}
            style={[styles.modeTab, mode === m.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => { setMode(m.key); setError(""); }}
          >
            <Feather name={m.icon as any} size={14} color={mode === m.key ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.modeTabText, { color: mode === m.key ? colors.primary : colors.mutedForeground }]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
        {/* Mode description */}
        <View style={[styles.modeHintBox, { backgroundColor: mode === "direct" ? "#EDE9FE" : "#DBEAFE", borderColor: mode === "direct" ? "#C4B5FD" : "#BFDBFE" }]}>
          <Feather name={mode === "direct" ? "user-check" : "link"} size={14} color={mode === "direct" ? "#7C3AED" : "#2563EB"} />
          <Text style={[styles.modeHintText, { color: mode === "direct" ? "#5B21B6" : "#1D4ED8" }]}>
            {mode === "direct"
              ? "You set the password — they can log in immediately. Share their credentials with them."
              : "They receive a link to set their own password. The link is valid for 72 hours."}
          </Text>
        </View>

        {!!error && (
          <View style={[styles.errorBox, { backgroundColor: "#FEE2E2", borderColor: "#FECACA" }]}>
            <Feather name="alert-circle" size={14} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <UserFormFields
          name={name} setName={setName}
          email={email} setEmail={setEmail}
          department={department} setDepartment={setDepartment}
          role={role} setRole={setRole}
          teamId={teamId} setTeamId={setTeamId}
          teams={teams} colors={colors}
        />

        {mode === "direct" && (
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Initial Password *</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1, backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                value={password} onChangeText={setPassword}
                placeholder="Min. 6 characters"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity style={[styles.eyeBtn, { backgroundColor: colors.muted, borderColor: colors.border }]} onPress={() => setShowPassword(!showPassword)}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.hintText, { color: colors.mutedForeground, marginTop: 4 }]}>
              Share these credentials with the user privately.
            </Text>
          </View>
        )}

        <View style={styles.rowBtns}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted }]} onPress={onClose}>
            <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={mode === "direct" ? handleDirect : handleInvite}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <Feather name={mode === "direct" ? "user-plus" : "send"} size={14} color="#fff" />
                <Text style={[styles.btnText, { color: "#fff" }]}>{mode === "direct" ? "Add User" : "Send Invite"}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </FormModal>
  );
}

// ─── Create stream modal ──────────────────────────────────────────────────────
function CreateStreamModal({ visible, programmeId, onSave, onClose, colors }: {
  visible: boolean; programmeId: string; onSave: (name: string, desc: string) => void;
  onClose: () => void; colors: any;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <FormModal visible={visible} title="New Stream" onClose={onClose} colors={colors}>
      <View style={{ padding: 20, gap: 14 }}>
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Stream Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={name} onChangeText={setName} placeholder="e.g. Marketing, Operations"
            placeholderTextColor={colors.mutedForeground} autoFocus
          />
        </View>
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={desc} onChangeText={setDesc} placeholder="What does this stream cover?"
            placeholderTextColor={colors.mutedForeground} multiline numberOfLines={2}
          />
        </View>
        <View style={styles.rowBtns}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted }]} onPress={() => { setName(""); setDesc(""); onClose(); }}>
            <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: name.trim() ? colors.primary : colors.border }]}
            onPress={() => { if (!name.trim()) return; onSave(name.trim(), desc.trim()); setName(""); setDesc(""); onClose(); }}
            disabled={!name.trim()}
          >
            <Text style={[styles.btnText, { color: "#fff" }]}>Create</Text>
          </TouchableOpacity>
        </View>
      </View>
    </FormModal>
  );
}

// ─── Create team modal ────────────────────────────────────────────────────────
function CreateTeamModal({ visible, streams, onSave, onClose, colors, defaultStreamId }: {
  visible: boolean; streams: Stream[]; onSave: (name: string, func: string, streamId: string | null) => void;
  onClose: () => void; colors: any; defaultStreamId?: string | null;
}) {
  const [name, setName] = useState("");
  const [func, setFunc] = useState("");
  const [streamId, setStreamId] = useState<string | null>(defaultStreamId ?? null);
  return (
    <FormModal visible={visible} title="New Team" onClose={onClose} colors={colors}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Team Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={name} onChangeText={setName} placeholder="e.g. Creative Design, Data Analytics"
            placeholderTextColor={colors.mutedForeground} autoFocus
          />
        </View>
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Function / Role Label</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={func} onChangeText={setFunc} placeholder="e.g. Brand & Creative"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Stream (optional)</Text>
          <View style={{ marginTop: 6 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity
                style={[styles.teamPill, streamId === null && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setStreamId(null)}
              >
                <Text style={[styles.teamPillText, { color: streamId === null ? "#fff" : colors.mutedForeground }]}>Unassigned</Text>
              </TouchableOpacity>
              {streams.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.teamPill, { borderColor: colors.border }, streamId === s.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setStreamId(s.id)}
                >
                  <Text style={[styles.teamPillText, { color: streamId === s.id ? "#fff" : colors.foreground }]}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
        <View style={styles.rowBtns}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted }]} onPress={() => { setName(""); setFunc(""); onClose(); }}>
            <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: name.trim() ? colors.primary : colors.border }]}
            onPress={() => { if (!name.trim()) return; onSave(name.trim(), func.trim(), streamId); setName(""); setFunc(""); onClose(); }}
            disabled={!name.trim()}
          >
            <Text style={[styles.btnText, { color: "#fff" }]}>Create Team</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </FormModal>
  );
}

// ─── Main admin screen ────────────────────────────────────────────────────────
export default function AdminPanelScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { users, currentUser, createUser, updateUserRole, inviteUser, deactivateUser, reactivateUser, deleteUser } = useAuth();
  const { programme, streams, teams, activityLogs, createTeam, deleteTeam, createStream, deleteStream, updateProgramme, refreshActivity } = useData();

  const [tab, setTab] = useState<AdminTab>("users");
  const [showAddUser, setShowAddUser] = useState(false);
  const [roleModalUser, setRoleModalUser] = useState<AppUser | null>(null);
  const [showCreateStream, setShowCreateStream] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [createTeamStreamId, setCreateTeamStreamId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [activityLoading, setActivityLoading] = useState(false);
  const [editProgrammeName, setEditProgrammeName] = useState(false);
  const [draftProgrammeName, setDraftProgrammeName] = useState(programme?.name ?? "");

  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter === "active" && !u.active) return false;
      if (statusFilter === "inactive" && u.active) return false;
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.department.toLowerCase().includes(q);
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  function handleRoleSave(user: AppUser, role: UserRole, teamId: string | null) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateUserRole(user.id, role, teamId);
  }

  function confirmDeactivate(user: AppUser) {
    Alert.alert("Deactivate User", `Suspend ${user.name}'s access?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Deactivate", style: "destructive", onPress: () => deactivateUser(user.id) },
    ]);
  }

  function confirmDelete(user: AppUser) {
    Alert.alert("Delete User", `Permanently delete ${user.name}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteUser(user.id) },
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
          >
            <Feather name={t.icon as any} size={15} color={tab === t.key ? colors.primary : colors.mutedForeground} />
            <Text style={[styles.tabLabel, { color: tab === t.key ? colors.primary : colors.mutedForeground }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Users ────────────────────────────────────────── */}
      {tab === "users" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Users ({users.filter((u) => u.active).length} active / {users.length} total)
            </Text>
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowAddUser(true)}>
              <Feather name="user-plus" size={14} color="#fff" />
              <Text style={styles.addBtnText}>Add User</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={[styles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="search" size={15} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              value={searchQuery} onChangeText={setSearchQuery}
              placeholder="Search name, email or department…"
              placeholderTextColor={colors.mutedForeground} clearButtonMode="while-editing"
            />
          </View>

          {/* Filters */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 6 }}>
            {(["all", "programme_lead", "team_lead"] as const).map((r) => (
              <TouchableOpacity key={r} style={[styles.chip, { backgroundColor: roleFilter === r ? (r === "all" ? colors.primary : ROLE_COLORS[r as UserRole]) : colors.muted }]} onPress={() => setRoleFilter(r)}>
                <Text style={[styles.chipText, { color: roleFilter === r ? "#fff" : colors.mutedForeground }]}>
                  {r === "all" ? "All Roles" : ROLE_LABELS[r as UserRole]}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            {(["all", "active", "inactive"] as const).map((s) => (
              <TouchableOpacity key={s} style={[styles.chip, { backgroundColor: statusFilter === s ? (s === "active" ? "#059669" : s === "inactive" ? "#6B7280" : colors.primary) : colors.muted }]} onPress={() => setStatusFilter(s)}>
                <Text style={[styles.chipText, { color: statusFilter === s ? "#fff" : colors.mutedForeground }]}>
                  {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* User cards */}
          {filteredUsers.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.muted }]}>
              <Feather name="users" size={24} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No users match your filters</Text>
            </View>
          ) : (
            filteredUsers.map((user) => {
              const userTeam = teams.find((t) => t.id === user.teamId);
              const isMe = currentUser?.id === user.id;
              return (
                <View key={user.id} style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }, !user.active && styles.inactive]}>
                  <View style={[styles.avatar, { backgroundColor: ROLE_COLORS[user.role] }]}>
                    <Text style={styles.avatarText}>{user.initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.userTopRow}>
                      <Text style={[styles.userName, { color: colors.foreground }]}>{user.name}</Text>
                      {isMe && <View style={[styles.youTag, { backgroundColor: colors.primary + "20" }]}><Text style={[styles.youTagText, { color: colors.primary }]}>You</Text></View>}
                      {!user.active && <View style={[styles.youTag, { backgroundColor: "#FEE2E2" }]}><Text style={[styles.youTagText, { color: "#DC2626" }]}>Suspended</Text></View>}
                    </View>
                    <Text style={[styles.userSub, { color: colors.mutedForeground }]}>{user.email}</Text>
                    {user.department ? <Text style={[styles.userSub, { color: colors.mutedForeground }]}>{user.department}</Text> : null}
                    <View style={styles.userTagRow}>
                      <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[user.role] + "15" }]}>
                        <Text style={[styles.roleBadgeText, { color: ROLE_COLORS[user.role] }]}>{ROLE_LABELS[user.role]}</Text>
                      </View>
                      {userTeam && (
                        <View style={[styles.teamBadge, { backgroundColor: colors.muted }]}>
                          <Feather name="users" size={10} color={colors.mutedForeground} />
                          <Text style={[styles.teamBadgeText, { color: colors.mutedForeground }]}>{userTeam.name}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {!isMe && (
                    <View style={styles.userActions}>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.muted }]}
                        onPress={() => setRoleModalUser(user)}
                      >
                        <Feather name="edit-2" size={14} color={colors.primary} />
                      </TouchableOpacity>
                      {user.active ? (
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#FEF3C7" }]} onPress={() => confirmDeactivate(user)}>
                          <Feather name="user-x" size={14} color="#D97706" />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#D1FAE5" }]} onPress={() => reactivateUser(user.id)}>
                          <Feather name="user-check" size={14} color="#059669" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#FEE2E2" }]} onPress={() => confirmDelete(user)}>
                        <Feather name="trash-2" size={14} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ── Structure (Streams + Teams) ───────────────── */}
      {tab === "structure" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad }}>
          {/* Streams */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Streams ({streams.length})</Text>
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => setShowCreateStream(true)}>
              <Feather name="plus" size={14} color="#fff" />
              <Text style={styles.addBtnText}>New Stream</Text>
            </TouchableOpacity>
          </View>

          {streams.length === 0 && (
            <View style={[styles.empty, { backgroundColor: colors.muted }]}>
              <Feather name="grid" size={24} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No streams yet. Streams group teams into functional areas.</Text>
            </View>
          )}
          {streams.map((stream) => {
            const streamTeams = teams.filter((t) => t.streamId === stream.id);
            return (
              <View key={stream.id} style={[styles.structureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.structureCardHeader}>
                  <View style={[styles.streamDot, { backgroundColor: colors.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.structureName, { color: colors.foreground }]}>{stream.name}</Text>
                    {stream.description ? <Text style={[styles.structureSub, { color: colors.mutedForeground }]}>{stream.description}</Text> : null}
                    <Text style={[styles.structureMeta, { color: colors.mutedForeground }]}>{streamTeams.length} team{streamTeams.length !== 1 ? "s" : ""}</Text>
                  </View>
                  <View style={styles.structureActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.primary + "15" }]}
                      onPress={() => { setCreateTeamStreamId(stream.id); setShowCreateTeam(true); }}
                    >
                      <Feather name="plus" size={14} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#FEE2E2" }]}
                      onPress={() => Alert.alert("Delete Stream", `Delete "${stream.name}"?`, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: () => deleteStream(stream.id) },
                      ])}
                    >
                      <Feather name="trash-2" size={14} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}

          {/* Teams */}
          <View style={[styles.sectionHeader, { marginTop: 20 }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Teams ({teams.length})</Text>
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => { setCreateTeamStreamId(null); setShowCreateTeam(true); }}>
              <Feather name="plus" size={14} color="#fff" />
              <Text style={styles.addBtnText}>New Team</Text>
            </TouchableOpacity>
          </View>

          {teams.length === 0 && (
            <View style={[styles.empty, { backgroundColor: colors.muted }]}>
              <Feather name="briefcase" size={24} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No teams yet. Teams are where work gets done.</Text>
            </View>
          )}
          {teams.map((team) => {
            const teamUsers = users.filter((u) => u.teamId === team.id);
            const lead = teamUsers.find((u) => u.role === "team_lead");
            const streamName = streams.find((s) => s.id === team.streamId)?.name;
            return (
              <View key={team.id} style={[styles.structureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.structureCardHeader}>
                  <View style={[styles.teamIcon, { backgroundColor: colors.primary + "15" }]}>
                    <Feather name="users" size={15} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.structureName, { color: colors.foreground }]}>{team.name}</Text>
                    {team.functionLabel ? <Text style={[styles.structureSub, { color: colors.mutedForeground }]}>{team.functionLabel}</Text> : null}
                    <Text style={[styles.structureMeta, { color: colors.mutedForeground }]}>
                      {streamName ?? "Unassigned"} · {teamUsers.length} user{teamUsers.length !== 1 ? "s" : ""}
                      {lead ? ` · Lead: ${lead.name}` : ""}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#FEE2E2" }]}
                    onPress={() => Alert.alert("Delete Team", `Delete "${team.name}"?`, [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => deleteTeam(team.id) },
                    ])}
                  >
                    <Feather name="trash-2" size={14} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ── Activity ──────────────────────────────────── */}
      {tab === "activity" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Activity Log ({activityLogs.length})</Text>
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.muted }]}
              onPress={async () => { setActivityLoading(true); await refreshActivity(); setActivityLoading(false); }}
            >
              {activityLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="refresh-cw" size={14} color={colors.primary} />}
              <Text style={[styles.addBtnText, { color: colors.primary }]}>Refresh</Text>
            </TouchableOpacity>
          </View>
          {activityLogs.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.muted }]}>
              <Feather name="activity" size={24} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No activity recorded yet</Text>
            </View>
          ) : (
            activityLogs.map((log) => {
              const ic = log.actionType === "create" ? { bg: "#D1FAE5", fg: "#059669", name: "plus" }
                : log.actionType === "delete" ? { bg: "#FEE2E2", fg: "#EF4444", name: "trash-2" }
                : { bg: "#DBEAFE", fg: "#2563EB", name: "edit-2" };
              return (
                <View key={log.id} style={[styles.logRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.logIcon, { backgroundColor: ic.bg }]}>
                    <Feather name={ic.name as any} size={12} color={ic.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.logTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {log.entityTitle ?? log.entityType}
                    </Text>
                    <Text style={[styles.logMeta, { color: colors.mutedForeground }]}>
                      {log.userName ?? "System"} · {log.actionType} · {log.entityType} ·{" "}
                      {new Date(log.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ── Settings ──────────────────────────────────── */}
      {tab === "settings" && (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: botPad }}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 12 }]}>Programme Name</Text>
          {programme && (
            <View style={[styles.structureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {editProgrammeName ? (
                <View style={{ gap: 10 }}>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                    value={draftProgrammeName} onChangeText={setDraftProgrammeName} autoFocus
                  />
                  <View style={styles.rowBtns}>
                    <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted }]} onPress={() => { setDraftProgrammeName(programme.name); setEditProgrammeName(false); }}>
                      <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => { updateProgramme(programme.id, { name: draftProgrammeName }); setEditProgrammeName(false); }}>
                      <Text style={[styles.btnText, { color: "#fff" }]}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.structureCardHeader}>
                  <Text style={[styles.structureName, { color: colors.foreground, flex: 1, fontSize: 18 }]}>{programme.name}</Text>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.muted }]} onPress={() => { setDraftProgrammeName(programme.name); setEditProgrammeName(true); }}>
                    <Feather name="edit-2" size={14} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24, marginBottom: 12 }]}>Role Reference</Text>
          <View style={[styles.structureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {(["programme_lead", "team_lead"] as UserRole[]).map((role, i) => (
              <View key={role} style={[styles.roleRef, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <View style={[styles.roleDot, { backgroundColor: ROLE_COLORS[role] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roleRefLabel, { color: colors.foreground }]}>{ROLE_LABELS[role]}</Text>
                  <Text style={[styles.roleRefDesc, { color: colors.mutedForeground }]}>
                    {role === "programme_lead"
                      ? "Full system access: manage users, streams, teams, all projects and events across the programme. Can edit any team's work."
                      : "Edit own team's tasks, milestones, events and member records. View other teams (read-only via Programme tab)."}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── Modals ────────────────────────────────────── */}
      {showAddUser && (
        <AddUserModal
          teams={teams}
          onCreateUser={createUser}
          onInvite={inviteUser}
          onClose={() => setShowAddUser(false)}
          colors={colors}
        />
      )}

      {roleModalUser && (
        <RoleModal
          user={roleModalUser}
          teams={teams}
          onSave={(role, teamId) => handleRoleSave(roleModalUser, role, teamId)}
          onClose={() => setRoleModalUser(null)}
          colors={colors}
        />
      )}

      {showCreateStream && programme && (
        <CreateStreamModal
          visible
          programmeId={programme.id}
          onSave={(name, desc) => createStream({ name, description: desc, programmeId: programme.id })}
          onClose={() => setShowCreateStream(false)}
          colors={colors}
        />
      )}

      {showCreateTeam && (
        <CreateTeamModal
          visible
          streams={streams}
          defaultStreamId={createTeamStreamId}
          onSave={(name, func, streamId) => createTeam({ name, functionLabel: func || undefined, streamId })}
          onClose={() => setShowCreateTeam(false)}
          colors={colors}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 3, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  addBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  chip: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  divider: { width: 1, marginHorizontal: 2 },
  userCard: { borderRadius: 12, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  inactive: { opacity: 0.6 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  userTopRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  userName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  userSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  userTagRow: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  roleBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  roleBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  teamBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  teamBadgeText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  youTag: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  youTagText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  userActions: { gap: 6 },
  actionBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  structureCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8 },
  structureCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  streamDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  teamIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  structureName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  structureSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  structureMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  structureActions: { flexDirection: "row", gap: 6 },
  logRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 6 },
  logIcon: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center", marginTop: 1 },
  logTitle: { fontSize: 13, fontFamily: "Inter_500Medium" },
  logMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  empty: { borderRadius: 12, padding: 24, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  roleRef: { padding: 14, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  roleDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  roleRefLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  roleRefDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3, lineHeight: 18 },
  // Shared form styles
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, maxHeight: "90%", overflow: "hidden" },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#C0C0C0", alignSelf: "center", marginTop: 10 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sheetTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  multiline: { height: 72, textAlignVertical: "top" },
  roleOption: { borderRadius: 12, borderWidth: 1.5, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  roleOptionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  roleOptionDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  teamPill: { borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 4 },
  teamPillText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  rowBtns: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
  btnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, borderWidth: 1, padding: 10 },
  errorText: { color: "#DC2626", fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  successIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  successText: { fontSize: 15, fontFamily: "Inter_500Medium", textAlign: "center" },
  hintText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  urlBox: { borderRadius: 8, borderWidth: 1, padding: 12, width: "100%" },
  urlText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  // Mode toggle (AddUserModal)
  modeToggleRow: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  modeTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  modeTabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  modeHintBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, padding: 12 },
  modeHintText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
  passwordRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  eyeBtn: { width: 48, height: 48, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
