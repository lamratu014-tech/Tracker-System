import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

export default function NewTeamScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ streamId?: string }>();
  const { streams, createTeam } = useData();

  const [name, setName] = useState("");
  const [functionLabel, setFunctionLabel] = useState("");
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(params.streamId ?? null);
  const [saving, setSaving] = useState(false);

  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  async function handleSave() {
    if (!name.trim()) { Alert.alert("Name required"); return; }
    setSaving(true);
    await createTeam({ name: name.trim(), functionLabel: functionLabel.trim() || undefined, streamId: selectedStreamId });
    setSaving(false);
    router.back();
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: botPad, gap: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.intro, { color: colors.mutedForeground }]}>
        Teams are execution groups within a Stream. Each team has its own workspace with tasks, calendar, and members.
      </Text>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Team Name *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Creative Design, Data Analytics"
          placeholderTextColor={colors.mutedForeground}
          autoFocus
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Function / Role</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
          value={functionLabel}
          onChangeText={setFunctionLabel}
          placeholder="e.g. Brand & Creative"
          placeholderTextColor={colors.mutedForeground}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Assign to Stream</Text>
        <View style={styles.streamList}>
          <TouchableOpacity
            style={[styles.streamOption, !selectedStreamId && [styles.selectedOption, { borderColor: colors.primary }], { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setSelectedStreamId(null)}
          >
            <Text style={[styles.streamOptionText, { color: !selectedStreamId ? colors.primary : colors.mutedForeground }]}>
              Unassigned
            </Text>
          </TouchableOpacity>
          {streams.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.streamOption, selectedStreamId === s.id && [styles.selectedOption, { borderColor: colors.primary }], { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setSelectedStreamId(s.id)}
            >
              <Text style={[styles.streamOptionText, { color: selectedStreamId === s.id ? colors.primary : colors.foreground }]}>
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: saving ? colors.muted : colors.primary }]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        <Text style={styles.saveBtnText}>{saving ? "Creating..." : "Create Team"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  streamList: { gap: 6 },
  streamOption: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  selectedOption: { borderWidth: 2 },
  streamOptionText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  saveBtn: { borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
