import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ProjectStatus } from "@/context/DataContext";
import { useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const PROJECT_COLORS = [
  "#2563EB", "#7C3AED", "#059669", "#D97706", "#DC2626", "#0891B2",
];

const STATUS_OPTIONS: { label: string; value: ProjectStatus }[] = [
  { label: "Not Started", value: "not_started" },
  { label: "In Progress", value: "in_progress" },
  { label: "At Risk", value: "at_risk" },
  { label: "Completed", value: "completed" },
];

export default function NewProjectScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { createProject, teams } = useData();
  const { currentUser, isProgrammeLead } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState("Phase 1: Planning");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [status, setStatus] = useState<ProjectStatus>("not_started");
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    isProgrammeLead ? "" : (currentUser?.teamId ?? "")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + 3);

  async function handleCreate() {
    if (!title.trim()) return;
    if (!selectedTeamId) { setError("Please select a team."); return; }
    setError("");
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const project = await createProject({
      teamId: selectedTeamId,
      title: title.trim(),
      description,
      phase,
      color,
      status,
      dueDate: dueDate.toISOString(),
      tags: [],
    });
    setSaving(false);
    if (project) {
      router.back();
    } else {
      setError("Failed to create project. Please try again.");
    }
  }

  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: botPad }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.heading, { color: colors.foreground }]}>New Project</Text>

        {/* Team selector — programme_lead picks any team; team_lead defaults to their own */}
        {isProgrammeLead && (
          <FormField label="Team">
            {teams.length === 0 ? (
              <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>No teams yet. Create a team in Admin first.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {teams.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.teamChip,
                      { backgroundColor: selectedTeamId === t.id ? colors.primary : colors.muted },
                    ]}
                    onPress={() => setSelectedTeamId(t.id)}
                    activeOpacity={0.7}
                  >
                    {selectedTeamId === t.id && <Feather name="check" size={12} color="#fff" />}
                    <Text style={[styles.teamChipText, { color: selectedTeamId === t.id ? "#fff" : colors.mutedForeground }]}>
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </FormField>
        )}

        {!isProgrammeLead && currentUser?.teamId && (
          <FormField label="Team">
            <View style={[styles.teamFixed, { backgroundColor: colors.muted }]}>
              <Feather name="users" size={14} color={colors.primary} />
              <Text style={[styles.teamFixedText, { color: colors.foreground }]}>
                {teams.find((t) => t.id === currentUser.teamId)?.name ?? "Your Team"}
              </Text>
            </View>
          </FormField>
        )}

        <FormField label="Project Title">
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Project name"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
          />
        </FormField>

        <FormField label="Description">
          <TextInput
            style={[styles.textarea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            value={description}
            onChangeText={setDescription}
            placeholder="What is this project about?"
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
          />
        </FormField>

        <FormField label="Phase">
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            value={phase}
            onChangeText={setPhase}
            placeholder="e.g. Phase 1: Planning"
            placeholderTextColor={colors.mutedForeground}
          />
        </FormField>

        <FormField label="Status">
          <View style={styles.statusGrid}>
            {STATUS_OPTIONS.map(s => (
              <TouchableOpacity
                key={s.value}
                style={[styles.statusChip, { backgroundColor: status === s.value ? colors.primary : colors.muted }]}
                onPress={() => setStatus(s.value)}
                activeOpacity={0.7}
              >
                {status === s.value && <Feather name="check" size={12} color="#fff" />}
                <Text style={[styles.statusText, { color: status === s.value ? "#fff" : colors.mutedForeground }]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </FormField>

        <FormField label="Colour">
          <View style={styles.colorRow}>
            {PROJECT_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.colorSwatch, { backgroundColor: c }, color === c && styles.colorSelected]}
                onPress={() => setColor(c)}
                activeOpacity={0.7}
              >
                {color === c && <Feather name="check" size={14} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>
        </FormField>

        {error ? (
          <Text style={[styles.errorText, { color: "#EF4444" }]}>{error}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: title.trim() ? colors.primary : colors.muted }]}
          onPress={handleCreate}
          disabled={!title.trim() || saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={[styles.createBtnText, { color: title.trim() ? "#fff" : colors.mutedForeground }]}>
              Create Project
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={fieldStyles.block}>
      <Text style={[fieldStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      {children}
    </View>
  );
}
const fieldStyles = StyleSheet.create({
  block: { marginBottom: 16 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  heading: { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 20 },
  input: { borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  textarea: { borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 15, fontFamily: "Inter_400Regular", minHeight: 80, textAlignVertical: "top" },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 5 },
  statusText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  colorRow: { flexDirection: "row", gap: 10 },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  colorSelected: { borderWidth: 3, borderColor: "rgba(0,0,0,0.2)" },
  teamChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 5 },
  teamChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  teamFixed: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 12 },
  teamFixedText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 8 },
  createBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  createBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
