import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

export default function NewStreamScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { programme } = useData();
  const { createStream } = useData();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  async function handleSave() {
    if (!name.trim()) { Alert.alert("Name required"); return; }
    if (!programme) { Alert.alert("Error", "Programme not loaded"); return; }
    setSaving(true);
    await createStream({ name: name.trim(), description: description.trim(), programmeId: programme.id });
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
        Streams are major functional divisions of the Programme (e.g. Marketing, Operations).
      </Text>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Stream Name *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Marketing, Operations, Technology"
          placeholderTextColor={colors.mutedForeground}
          autoFocus
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Description</Text>
        <TextInput
          style={[styles.input, styles.multiline, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Brief description of this stream's purpose"
          placeholderTextColor={colors.mutedForeground}
          multiline
          numberOfLines={3}
        />
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: saving ? colors.muted : colors.primary }]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.8}
      >
        <Text style={styles.saveBtnText}>{saving ? "Creating..." : "Create Stream"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  field: { gap: 6 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  multiline: { height: 80, textAlignVertical: "top" },
  saveBtn: { borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
