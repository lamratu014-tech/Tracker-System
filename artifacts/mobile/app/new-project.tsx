import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
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
import {
  canCreateForTeam,
  canManageTeam,
  useCurrentUser,
  useStore,
} from "@/store/useStore";

export default function NewProjectScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ teamId?: string }>();
  const me = useCurrentUser();
  const streams = useStore((s) => s.streams);
  const addProject = useStore((s) => s.addProject);

  const allowedTeams = useMemo(() => {
    if (!me) return [];
    const flat = streams.flatMap((s) => s.teams.map((t) => ({ team: t, streamName: s.name })));
    return flat.filter((x) => canManageTeam(me, x.team.id, streams));
  }, [streams, me]);

  const initialTeamId =
    params.teamId && allowedTeams.some((x) => x.team.id === params.teamId)
      ? params.teamId
      : allowedTeams[0]?.team.id ?? "";

  const [teamId, setTeamId] = useState<string>(initialTeamId);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  if (allowedTeams.length === 0) {
    return (
      <View style={[styles.gate, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>You don't have a team to add a project to.</Text>
      </View>
    );
  }

  function save() {
    if (!title.trim()) return Alert.alert("Title required", "Please enter a project title.");
    if (!teamId) return Alert.alert("Team required", "Pick a team.");
    if (!canCreateForTeam(me, teamId, streams)) {
      return Alert.alert("Not allowed", "You don't have permission to add a project to this team.");
    }
    const created = addProject(teamId, { title: title.trim(), description: desc.trim() });
    if (created) router.back();
    else Alert.alert("Error", "Could not create project.");
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>Project title *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Spring Campaign"
        placeholderTextColor={colors.mutedForeground}
        autoFocus
      />

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Description</Text>
      <TextInput
        style={[styles.input, styles.multi, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        value={desc}
        onChangeText={setDesc}
        placeholder="What's this project about?"
        placeholderTextColor={colors.mutedForeground}
        multiline
        numberOfLines={3}
      />

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Team *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {allowedTeams.map(({ team, streamName }) => (
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

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted }]} onPress={() => router.back()}>
          <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: title.trim() && teamId ? colors.primary : colors.border }]}
          onPress={save}
          disabled={!title.trim() || !teamId}
        >
          <Text style={[styles.btnText, { color: "#fff" }]}>Create Project</Text>
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
  multi: { minHeight: 80, textAlignVertical: "top" },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  row: { flexDirection: "row", gap: 8, marginTop: 16 },
  btn: { flex: 1, padding: 14, borderRadius: 10, alignItems: "center" },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
