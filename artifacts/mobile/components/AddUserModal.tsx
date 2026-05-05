import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth, type UserRole } from "@/context/AuthContext";
import { useData, type Team } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

const ROLE_COLORS: Record<UserRole, string> = {
  programme_lead: "#7C3AED",
  team_lead: "#2563EB",
};

const ROLE_LABELS: Record<UserRole, string> = {
  programme_lead: "Programme Lead",
  team_lead: "Team Lead",
};

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ─── Reusable form modal shell (also exported for admin's other modals) ──────
export function FormModal({
  visible,
  title,
  subtitle,
  onClose,
  children,
  colors,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  colors: any;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.sheetHandle} />
          <View style={s.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[s.sheetTitle, { color: colors.foreground }]}>{title}</Text>
              {subtitle ? (
                <Text style={[s.sheetSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={s.closeBtn}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

// ─── Team picker pill list (also exported) ────────────────────────────────────
export function TeamPicker({
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
          style={[s.teamPill, { borderColor: colors.border }, selectedId === null && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => onSelect(null)}
        >
          <Text style={[s.teamPillText, { color: selectedId === null ? "#fff" : colors.mutedForeground }]}>None</Text>
        </TouchableOpacity>
      )}
      {teams.map((t) => (
        <TouchableOpacity
          key={t.id}
          style={[s.teamPill, { borderColor: colors.border }, selectedId === t.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => onSelect(t.id)}
        >
          {selectedId === t.id && <Feather name="check" size={11} color="#fff" />}
          <Text style={[s.teamPillText, { color: selectedId === t.id ? "#fff" : colors.foreground }]}>{t.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── Add User Modal ──────────────────────────────────────────────────────────
export type AddUserSuccessInfo = {
  type: "direct" | "invite";
  email: string;
  name: string;
  acceptUrl?: string;
};

export function AddUserModal({
  visible,
  onClose,
  onSuccess,
  defaultRole = "team_lead",
  defaultTeamId = null,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (info: AddUserSuccessInfo) => void;
  defaultRole?: UserRole;
  defaultTeamId?: string | null;
}) {
  const colors = useColors();
  const { createUser, inviteUser } = useAuth();
  const { teams } = useData();

  type Mode = "direct" | "invite";
  const [mode, setMode] = useState<Mode>("direct");

  // Shared fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState<UserRole>(defaultRole);
  const [teamId, setTeamId] = useState<string | null>(defaultTeamId);

  // Direct-add only
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<AddUserSuccessInfo | null>(null);

  function reset() {
    setName(""); setEmail(""); setDepartment("");
    setRole(defaultRole); setTeamId(defaultTeamId);
    setPassword(""); setShowPassword(false);
    setError(""); setDone(null);
    setMode("direct");
  }

  function closeAll() {
    reset();
    onClose();
  }

  function handleGeneratePassword() {
    const pw = generatePassword();
    setPassword(pw);
    setShowPassword(true);
  }

  async function handleDirect() {
    if (!name.trim() || !email.trim()) { setError("Name and email are required."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError("");
    const result = await createUser(email.trim(), name.trim(), password, role, department.trim() || undefined, teamId);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    const info: AddUserSuccessInfo = { type: "direct", email: email.trim().toLowerCase(), name: name.trim() };
    setDone(info);
    onSuccess?.(info);
  }

  async function handleInvite() {
    if (!name.trim() || !email.trim()) { setError("Name and email are required."); return; }
    setLoading(true); setError("");
    const result = await inviteUser(email.trim(), name.trim(), role, department.trim() || undefined, teamId);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    const info: AddUserSuccessInfo = { type: "invite", email: email.trim().toLowerCase(), name: name.trim(), acceptUrl: result.acceptUrl };
    setDone(info);
    onSuccess?.(info);
  }

  if (!visible) return null;

  // ── Success state ────────────────────────────────────────────────────────
  if (done) {
    return (
      <FormModal visible title={done.type === "direct" ? "User Added!" : "Invite Created!"} onClose={closeAll} colors={colors}>
        <View style={{ padding: 24, alignItems: "center", gap: 14 }}>
          <View style={[s.successIcon, { backgroundColor: "#D1FAE5" }]}>
            <Feather name="check" size={32} color="#059669" />
          </View>
          <Text style={[s.successText, { color: colors.foreground, textAlign: "center" }]}>
            {done.type === "direct"
              ? `${done.name} has been added.`
              : `Invite created for ${done.name}.`}
          </Text>
          {done.type === "direct" && (
            <Text style={[s.hintText, { color: colors.mutedForeground, textAlign: "center" }]}>
              They can log in now with their email and the password you set.
            </Text>
          )}
          {done.acceptUrl && (
            <>
              <Text style={[s.hintText, { color: colors.mutedForeground, textAlign: "center" }]}>
                Share this link — they'll set their own password when they open it:
              </Text>
              <View style={[s.urlBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Text style={[s.urlText, { color: colors.foreground }]} selectable>{done.acceptUrl}</Text>
              </View>
            </>
          )}
          <View style={s.rowBtns}>
            <TouchableOpacity style={[s.btn, { backgroundColor: colors.muted, flex: 1 }]} onPress={() => reset()}>
              <Feather name="user-plus" size={14} color={colors.primary} />
              <Text style={[s.btnText, { color: colors.primary }]}>Add Another</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, { backgroundColor: colors.primary, flex: 1 }]} onPress={closeAll}>
              <Text style={[s.btnText, { color: "#fff" }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </FormModal>
    );
  }

  // ── Form state ──────────────────────────────────────────────────────────
  const isDirect = mode === "direct";
  const accent = isDirect ? "#7C3AED" : "#2563EB";
  const accentBg = isDirect ? "#EDE9FE" : "#DBEAFE";

  return (
    <FormModal
      visible
      title="Add User"
      subtitle="Choose how to add this person"
      onClose={closeAll}
      colors={colors}
    >
      {/* Big mode toggle */}
      <View style={s.modeToggleWrap}>
        {([
          { key: "direct", label: "Add Directly", icon: "user-check", caption: "Set their password now" },
          { key: "invite", label: "Send Invite Link", icon: "link", caption: "They set their own password" },
        ] as { key: Mode; label: string; icon: React.ComponentProps<typeof Feather>["name"]; caption: string }[]).map((m) => {
          const active = mode === m.key;
          const a = m.key === "direct" ? "#7C3AED" : "#2563EB";
          const aBg = m.key === "direct" ? "#EDE9FE" : "#DBEAFE";
          return (
            <TouchableOpacity
              key={m.key}
              style={[
                s.modePill,
                {
                  backgroundColor: active ? aBg : colors.muted,
                  borderColor: active ? a : colors.border,
                },
              ]}
              onPress={() => { setMode(m.key); setError(""); }}
              activeOpacity={0.85}
            >
              <View style={[s.modePillIcon, { backgroundColor: active ? a : colors.background }]}>
                <Feather name={m.icon} size={16} color={active ? "#fff" : colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.modePillLabel, { color: active ? a : colors.foreground }]}>{m.label}</Text>
                <Text style={[s.modePillCaption, { color: active ? a : colors.mutedForeground }]}>{m.caption}</Text>
              </View>
              {active && <Feather name="check-circle" size={18} color={a} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 14 }} keyboardShouldPersistTaps="handled">
        {!!error && (
          <View style={[s.errorBox, { backgroundColor: "#FEE2E2", borderColor: "#FECACA" }]}>
            <Feather name="alert-circle" size={14} color="#DC2626" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {/* Name */}
        <View style={s.field}>
          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Full Name *</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={name} onChangeText={setName} placeholder="e.g. Jane Smith"
            placeholderTextColor={colors.mutedForeground} autoFocus
          />
        </View>

        {/* Email */}
        <View style={s.field}>
          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Email Address *</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={email} onChangeText={setEmail} placeholder="jane@example.com"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none" keyboardType="email-address"
          />
        </View>

        {/* Department */}
        <View style={s.field}>
          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Department (optional)</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={department} onChangeText={setDepartment} placeholder="e.g. Marketing"
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        {/* Role */}
        <View style={s.field}>
          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Role *</Text>
          <View style={{ gap: 8, marginTop: 6 }}>
            {(["programme_lead", "team_lead"] as UserRole[]).map((r) => (
              <TouchableOpacity
                key={r}
                style={[s.roleOption, { backgroundColor: role === r ? ROLE_COLORS[r] : colors.muted, borderColor: role === r ? ROLE_COLORS[r] : colors.border }]}
                onPress={() => setRole(r)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[s.roleOptionLabel, { color: role === r ? "#fff" : colors.foreground }]}>{ROLE_LABELS[r]}</Text>
                  <Text style={[s.roleOptionDesc, { color: role === r ? "rgba(255,255,255,0.75)" : colors.mutedForeground }]}>
                    {r === "programme_lead" ? "Full access across the programme" : "Manage own team's workspace"}
                  </Text>
                </View>
                {role === r && <Feather name="check-circle" size={16} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Team */}
        <View style={s.field}>
          <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>
            Assign to Team {role === "programme_lead" ? "(optional)" : "(select a team)"}
          </Text>
          <View style={{ marginTop: 6 }}>
            <TeamPicker teams={teams} selectedId={teamId} onSelect={setTeamId} colors={colors} allowNone />
          </View>
          {teams.length === 0 && (
            <Text style={[s.hintText, { color: colors.mutedForeground, marginTop: 4 }]}>
              No teams yet. Create one in Admin → Structure first.
            </Text>
          )}
        </View>

        {/* Password (direct mode only) */}
        {isDirect && (
          <View style={s.field}>
            <View style={s.passwordLabelRow}>
              <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Initial Password *</Text>
              <TouchableOpacity onPress={handleGeneratePassword} hitSlop={8}>
                <Text style={[s.generateLink, { color: accent }]}>Generate password</Text>
              </TouchableOpacity>
            </View>
            <View style={s.passwordRow}>
              <TextInput
                style={[s.input, { flex: 1, backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                value={password} onChangeText={setPassword}
                placeholder="Min. 6 characters"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity style={[s.eyeBtn, { backgroundColor: colors.muted, borderColor: colors.border }]} onPress={() => setShowPassword(!showPassword)}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <Text style={[s.hintText, { color: colors.mutedForeground, marginTop: 4 }]}>
              Share these credentials with the user privately.
            </Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={[s.rowBtns, { marginTop: 8 }]}>
          <TouchableOpacity style={[s.btn, { backgroundColor: colors.muted }]} onPress={closeAll}>
            <Text style={[s.btnText, { color: colors.foreground }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: accent }]}
            onPress={isDirect ? handleDirect : handleInvite}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <Feather name={isDirect ? "user-plus" : "send"} size={15} color="#fff" />
                <Text style={[s.btnText, { color: "#fff" }]}>{isDirect ? "Add User" : "Send Invite"}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </FormModal>
  );
}

const s = StyleSheet.create({
  // Modal shell
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, maxHeight: "92%", overflow: "hidden" },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#C0C0C0", alignSelf: "center", marginTop: 10 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 },
  sheetTitle: { fontSize: 19, fontFamily: "Inter_700Bold" },
  sheetSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  closeBtn: { padding: 4 },

  // Mode toggle (big pill cards)
  modeToggleWrap: { flexDirection: "column", gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  modePill: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, borderWidth: 2, padding: 12,
  },
  modePillIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  modePillLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modePillCaption: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },

  // Form fields
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },

  // Role options
  roleOption: { borderRadius: 12, borderWidth: 1.5, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  roleOptionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  roleOptionDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  // Team picker
  teamPill: { borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 4 },
  teamPillText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  // Password row
  passwordLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  generateLink: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  passwordRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  eyeBtn: { width: 48, height: 48, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  // Buttons
  rowBtns: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 },
  btnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // Misc
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, borderWidth: 1, padding: 10 },
  errorText: { color: "#DC2626", fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  successIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  successText: { fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  hintText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  urlBox: { borderRadius: 8, borderWidth: 1, padding: 12, width: "100%" },
  urlText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
