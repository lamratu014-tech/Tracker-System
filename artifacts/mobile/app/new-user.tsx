import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
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
import type { Role } from "@/models/types";
import { canManageEverything, useCurrentUser, useStore } from "@/store/useStore";

const ROLES: Role[] = ["admin", "stream_overseer", "leader"];
const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  stream_overseer: "Stream Overseer",
  leader: "Team Leader",
};
const ROLE_HINT: Record<Role, string> = {
  admin: "Full access to everything",
  stream_overseer: "Manages all teams within one stream",
  leader: "Manages a single team",
};

export default function NewUserScreen() {
  const colors = useColors();
  const router = useRouter();
  const me = useCurrentUser();
  const streams = useStore((s) => s.streams);
  const inviteUser = useStore((s) => s.inviteUser);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("leader");
  const [streamId, setStreamId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState<string | null>(null);

  const allTeams = useMemo(
    () => streams.flatMap((s) => s.teams.map((t) => ({ team: t, stream: s }))),
    [streams],
  );

  const teamOptions = useMemo(() => {
    if (role !== "leader") return [];
    if (!streamId) return allTeams;
    return allTeams.filter((x) => x.stream.id === streamId);
  }, [role, streamId, allTeams]);

  if (!canManageEverything(me)) {
    return (
      <View style={[styles.gate, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Only admins can invite users.</Text>
      </View>
    );
  }

  function save() {
    if (!name.trim()) return Alert.alert("Name required", "Please enter a name.");
    if (!email.trim() || !email.includes("@")) {
      return Alert.alert("Email required", "Please enter a valid email.");
    }
    if (role === "stream_overseer" && !streamId) {
      return Alert.alert("Stream required", "Pick a stream for this overseer.");
    }
    if (role === "leader" && !teamId) {
      return Alert.alert("Team required", "Pick a team for this leader.");
    }

    const created = inviteUser({
      name: name.trim(),
      email: email.trim(),
      role,
      streamId: role === "stream_overseer" ? streamId : null,
      teamId: role === "leader" ? teamId : null,
    });
    if (!created) {
      Alert.alert("Error", "Could not invite user. The email may already be in use.");
      return;
    }
    setCreatedCode(created.inviteCode);
    setCreatedName(created.name);
  }

  function copyCode() {
    if (!createdCode) return;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(createdCode);
      Alert.alert("Copied", "Invite code copied to clipboard.");
    } else {
      Alert.alert("Invite code", createdCode);
    }
  }

  if (createdCode) {
    return (
      <View style={[styles.successWrap, { backgroundColor: colors.background }]}>
        <View style={[styles.successIcon, { backgroundColor: "#05966922" }]}>
          <Feather name="check" size={32} color="#059669" />
        </View>
        <Text style={[styles.successTitle, { color: colors.foreground }]}>{createdName} invited</Text>
        <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
          Share this invite code. They'll enter it on the login screen to activate their account.
        </Text>

        <View style={[styles.codeBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Text style={[styles.code, { color: colors.foreground }]}>{createdCode}</Text>
        </View>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1 }]}
          onPress={copyCode}
        >
          <Feather name="copy" size={14} color={colors.primary} />
          <Text style={[styles.btnText, { color: colors.primary, marginLeft: 6 }]}>Copy code</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary, marginTop: 8 }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.btnText, { color: "#fff" }]}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>Full name *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Sam Smith"
        placeholderTextColor={colors.mutedForeground}
        autoFocus
      />

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Work email *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        value={email}
        onChangeText={setEmail}
        placeholder="sam@company.com"
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Role *</Text>
      {ROLES.map((r) => (
        <TouchableOpacity
          key={r}
          style={[
            styles.roleRow,
            {
              borderColor: role === r ? colors.primary : colors.border,
              backgroundColor: role === r ? colors.primary + "11" : colors.card,
            },
          ]}
          onPress={() => { setRole(r); setStreamId(null); setTeamId(null); }}
          activeOpacity={0.85}
        >
          <View style={[styles.radio, { borderColor: role === r ? colors.primary : colors.border }]}>
            {role === r ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.roleLabel, { color: colors.foreground }]}>{ROLE_LABEL[r]}</Text>
            <Text style={[styles.roleHint, { color: colors.mutedForeground }]}>{ROLE_HINT[r]}</Text>
          </View>
        </TouchableOpacity>
      ))}

      {role === "stream_overseer" ? (
        <>
          <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 8 }]}>Assign to stream *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {streams.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.chip, { borderColor: colors.border, backgroundColor: streamId === s.id ? colors.primary : colors.muted }]}
                onPress={() => setStreamId(s.id)}
              >
                <Text style={[styles.chipText, { color: streamId === s.id ? "#fff" : colors.foreground }]}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      ) : null}

      {role === "leader" ? (
        <>
          <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 8 }]}>Assign to team *</Text>
          {teamOptions.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>No teams yet. Create one first.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {teamOptions.map(({ team, stream }) => (
                <TouchableOpacity
                  key={team.id}
                  style={[styles.chip, { borderColor: colors.border, backgroundColor: teamId === team.id ? colors.primary : colors.muted }]}
                  onPress={() => setTeamId(team.id)}
                >
                  <Text style={[styles.chipText, { color: teamId === team.id ? "#fff" : colors.foreground }]}>
                    {stream.name} · {team.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </>
      ) : null}

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted }]} onPress={() => router.back()}>
          <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: name.trim() && email.trim() ? colors.primary : colors.border }]}
          onPress={save}
          disabled={!name.trim() || !email.trim()}
        >
          <Text style={[styles.btnText, { color: "#fff" }]}>Send invite</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 10 },
  gate: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 4 },
  input: { padding: 12, borderRadius: 10, borderWidth: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  roleRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 6,
  },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  roleLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  roleHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  row: { flexDirection: "row", gap: 8, marginTop: 16 },
  btn: {
    flex: 1, padding: 14, borderRadius: 10, alignItems: "center",
    flexDirection: "row", justifyContent: "center",
  },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  successWrap: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center" },
  successIcon: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  successTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  successSub: {
    fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center",
    marginTop: 8, lineHeight: 18,
  },
  codeBox: {
    paddingHorizontal: 32, paddingVertical: 20,
    borderRadius: 12, borderWidth: 1, marginTop: 24, marginBottom: 16,
  },
  code: { fontSize: 32, fontFamily: "Inter_700Bold", letterSpacing: 8, textAlign: "center" },
});
