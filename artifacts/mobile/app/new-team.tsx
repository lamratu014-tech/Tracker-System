import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  getListStreamTeamsQueryKey,
  getListTeamsQueryKey,
  useCreateTeam,
  useListStreams,
  useListUsers,
} from "@workspace/api-client-react";
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

import { ErrorBanner } from "@/components/ErrorBanner";
import { useColors } from "@/hooks/useColors";
import { canManageStream, useMe } from "@/lib/permissions";

export default function NewTeamScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ streamId?: string }>();
  const me = useMe();
  const streamsQ = useListStreams();
  const usersQ = useListUsers();
  const streams = streamsQ.data ?? [];
  const users = usersQ.data ?? [];

  const allowedStreams = useMemo(
    () => streams.filter((s) => canManageStream(me, s.id)),
    [streams, me],
  );

  const initialStreamId =
    params.streamId && allowedStreams.some((s) => s.id === params.streamId)
      ? params.streamId
      : allowedStreams[0]?.id ?? "";

  const [name, setName] = useState("");
  const [streamId, setStreamId] = useState<string>(initialStreamId);
  const [leaderId, setLeaderId] = useState<string | null>(null);

  const leaderOptions = useMemo(
    () => users.filter((u) => u.role === "leader" || u.role === "admin"),
    [users],
  );

  const createTeam = useCreateTeam({
    mutation: {
      onSuccess: (created) => {
        qc.invalidateQueries({ queryKey: getListTeamsQueryKey() });
        if (created?.streamId) {
          qc.invalidateQueries({ queryKey: getListStreamTeamsQueryKey(created.streamId) });
        }
        router.back();
      },
    },
  });

  if (allowedStreams.length === 0 && !streamsQ.isLoading) {
    return (
      <View style={[styles.gate, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>
          You don't have permission to create teams.
        </Text>
      </View>
    );
  }

  function save() {
    if (!name.trim()) return Alert.alert("Name required", "Please enter a team name.");
    if (!streamId) return Alert.alert("Stream required", "Pick a stream.");
    if (!canManageStream(me, streamId)) {
      return Alert.alert("Not allowed", "You can't add teams to that stream.");
    }
    createTeam.mutate({ data: { name: name.trim(), streamId, leaderId: leaderId ?? null } });
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>Team name *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Brand & Creative"
        placeholderTextColor={colors.mutedForeground}
        autoFocus
      />

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Stream *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {allowedStreams.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: streamId === s.id ? colors.primary : colors.muted }]}
            onPress={() => setStreamId(s.id)}
          >
            <Text style={[styles.chipText, { color: streamId === s.id ? "#fff" : colors.foreground }]}>
              {s.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 8 }]}>Team leader</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        <TouchableOpacity
          style={[styles.chip, { borderColor: colors.border, backgroundColor: leaderId === null ? colors.primary : colors.muted }]}
          onPress={() => setLeaderId(null)}
        >
          <Text style={[styles.chipText, { color: leaderId === null ? "#fff" : colors.foreground }]}>None</Text>
        </TouchableOpacity>
        {leaderOptions.map((u) => (
          <TouchableOpacity
            key={u.id}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: leaderId === u.id ? colors.primary : colors.muted }]}
            onPress={() => setLeaderId(u.id)}
          >
            <Text style={[styles.chipText, { color: leaderId === u.id ? "#fff" : colors.foreground }]}>{u.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {createTeam.isError ? <ErrorBanner error={createTeam.error} /> : null}

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted }]} onPress={() => router.back()}>
          <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: name.trim() && streamId ? colors.primary : colors.border }]}
          onPress={save}
          disabled={!name.trim() || !streamId || createTeam.isPending}
        >
          <Text style={[styles.btnText, { color: "#fff" }]}>Create Team</Text>
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
