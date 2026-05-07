import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  getListStreamsQueryKey,
  useCreateStream,
  useListProgrammes,
} from "@workspace/api-client-react";
import React, { useEffect, useState } from "react";
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
import {
  getLastUsedProgrammeId,
  setLastUsedProgrammeId,
} from "@/lib/preferences";
import { useMe } from "@/lib/permissions";

export default function NewStreamScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const programmesQ = useListProgrammes();
  const allProgrammes = programmesQ.data ?? [];
  // Programme overseers can only create streams within their own programme.
  // Admins see every programme.
  const programmes =
    me?.role === "programme_overseer" && me.programmeId
      ? allProgrammes.filter((p) => p.id === me.programmeId)
      : allProgrammes;
  const [name, setName] = useState("");
  const [programmeId, setProgrammeId] = useState<string | null>(null);

  const canCreate = me?.role === "admin" || me?.role === "programme_overseer";

  // Pre-select most recently used programme (or first available). For PO,
  // the only allowed option is their own programme.
  useEffect(() => {
    if (programmeId || programmes.length === 0) return;
    if (me?.role === "programme_overseer" && me.programmeId) {
      setProgrammeId(me.programmeId);
      return;
    }
    let cancelled = false;
    (async () => {
      const last = await getLastUsedProgrammeId();
      if (cancelled) return;
      const match = last && programmes.find((p) => p.id === last);
      setProgrammeId(match ? match.id : programmes[0].id);
    })();
    return () => {
      cancelled = true;
    };
  }, [programmes, programmeId, me]);

  const createStream = useCreateStream({
    mutation: {
      onSuccess: () => {
        if (programmeId) void setLastUsedProgrammeId(programmeId);
        qc.invalidateQueries({ queryKey: getListStreamsQueryKey() });
        router.back();
      },
    },
  });

  if (!canCreate) {
    return (
      <View style={[styles.gateContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.gate, { color: colors.mutedForeground }]}>
          Only admins or programme overseers can create streams.
        </Text>
      </View>
    );
  }

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return Alert.alert("Name required", "Please enter a stream name.");
    if (!programmeId) return Alert.alert("Programme required", "Pick a programme first.");
    createStream.mutate({ data: { name: trimmed, programmeId } });
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

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Programme *</Text>
      {programmesQ.isLoading ? (
        <LoadingRow inline label="Loading programmes…" />
      ) : programmes.length === 0 ? (
        <Text style={[styles.gate, { color: colors.mutedForeground }]}>
          No programmes yet. Create one from the Admin tab.
        </Text>
      ) : (
        <View style={styles.chips}>
          {programmes.map((p) => {
            const selected = p.id === programmeId;
            return (
              <TouchableOpacity
                key={p.id}
                onPress={() => setProgrammeId(p.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.primary : colors.muted,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: selected ? "#fff" : colors.foreground }]}>
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {createStream.isError ? <ErrorBanner error={createStream.error} /> : null}
      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted }]} onPress={() => router.back()}>
          <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: name.trim() && programmeId ? colors.primary : colors.border }]}
          onPress={save}
          disabled={!name.trim() || !programmeId || createStream.isPending}
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  row: { flexDirection: "row", gap: 8, marginTop: 8 },
  btn: { flex: 1, padding: 14, borderRadius: 10, alignItems: "center" },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
