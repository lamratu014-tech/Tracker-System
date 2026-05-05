import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  getListStreamsQueryKey,
  useCreateStream,
  useGetProgramme,
} from "@workspace/api-client-react";
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

import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingRow } from "@/components/LoadingRow";
import { useColors } from "@/hooks/useColors";
import { canManageEverything, useMe } from "@/lib/permissions";

export default function NewStreamScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const programmeQ = useGetProgramme();
  const programme = programmeQ.data ?? null;
  const [name, setName] = useState("");

  const createStream = useCreateStream({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListStreamsQueryKey() });
        router.back();
      },
    },
  });

  if (!canManageEverything(me)) {
    return (
      <View style={[styles.gateContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.gate, { color: colors.mutedForeground }]}>Only admins can create streams.</Text>
      </View>
    );
  }

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return Alert.alert("Name required", "Please enter a stream name.");
    if (!programme) return Alert.alert("Loading", "Please wait for the programme to load.");
    createStream.mutate({ data: { name: trimmed, programmeId: programme.id } });
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>Stream name *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Marketing"
        placeholderTextColor={colors.mutedForeground}
        autoFocus
      />
      {programmeQ.isLoading ? <LoadingRow inline label="Loading programme…" /> : null}
      {createStream.isError ? <ErrorBanner error={createStream.error} /> : null}
      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted }]} onPress={() => router.back()}>
          <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: name.trim() && programme ? colors.primary : colors.border }]}
          onPress={save}
          disabled={!name.trim() || !programme || createStream.isPending}
        >
          <Text style={[styles.btnText, { color: "#fff" }]}>Create</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14 },
  gateContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  gate: { fontSize: 14, fontFamily: "Inter_400Regular" },
  label: { fontSize: 12, fontFamily: "Inter_500Medium" },
  input: { padding: 12, borderRadius: 10, borderWidth: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  btn: { flex: 1, padding: 14, borderRadius: 10, alignItems: "center" },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
