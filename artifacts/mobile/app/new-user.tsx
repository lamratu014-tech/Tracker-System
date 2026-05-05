import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
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

const ROLES: Role[] = ["admin", "leader", "member"];
const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  leader: "Team Leader",
  member: "Team Member",
};

export default function NewUserScreen() {
  const colors = useColors();
  const router = useRouter();
  const me = useCurrentUser();
  const streams = useStore((s) => s.streams);
  const addUser = useStore((s) => s.addUser);

  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [teamId, setTeamId] = useState<string | null>(null);

  if (!canManageEverything(me)) {
    return (
      <View style={[styles.gate, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Only admins can add users.</Text>
      </View>
    );
  }

  function save() {
    if (!name.trim()) return Alert.alert("Name required", "Please enter a name.");
    const created = addUser({ name: name.trim(), role, teamId });
    if (created) router.back();
    else Alert.alert("Error", "Could not create user.");
  }

  const allTeams = streams.flatMap((s) => s.teams.map((t) => ({ team: t, streamName: s.name })));

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>Name *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Sam Smith"
        placeholderTextColor={colors.mutedForeground}
        autoFocus
      />

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Role *</Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {ROLES.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: role === r ? colors.primary : colors.muted }]}
            onPress={() => setRole(r)}
          >
            <Text style={[styles.chipText, { color: role === r ? "#fff" : colors.foreground }]}>{ROLE_LABEL[r]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {role !== "admin" ? (
        <>
          <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 8 }]}>Team</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            <TouchableOpacity
              style={[styles.chip, { borderColor: colors.border, backgroundColor: teamId === null ? colors.primary : colors.muted }]}
              onPress={() => setTeamId(null)}
            >
              <Text style={[styles.chipText, { color: teamId === null ? "#fff" : colors.foreground }]}>Unassigned</Text>
            </TouchableOpacity>
            {allTeams.map(({ team, streamName }) => (
              <TouchableOpacity
                key={team.id}
                style={[styles.chip, { borderColor: colors.border, backgroundColor: teamId === team.id ? colors.primary : colors.muted }]}
                onPress={() => setTeamId(team.id)}
              >
                <Text style={[styles.chipText, { color: teamId === team.id ? "#fff" : colors.foreground }]}>
                  {streamName} · {team.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      ) : null}

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted }]} onPress={() => router.back()}>
          <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: name.trim() ? colors.primary : colors.border }]}
          onPress={save}
          disabled={!name.trim()}
        >
          <Text style={[styles.btnText, { color: "#fff" }]}>Create User</Text>
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
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  row: { flexDirection: "row", gap: 8, marginTop: 16 },
  btn: { flex: 1, padding: 14, borderRadius: 10, alignItems: "center" },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
