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
import { useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const EVENT_COLORS = [
  "#2563EB", "#7C3AED", "#DC2626", "#D97706", "#059669", "#0891B2", "#DB2777",
];

export default function NewEventScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { createEvent, projects, teams } = useData();
  const { currentUser } = useAuth();

  const [title, setTitle] = useState("");
  const [internalDescription, setInternalDescription] = useState("");
  const [sharedDescription, setSharedDescription] = useState("");
  const [location, setLocation] = useState("");
  const [color, setColor] = useState(EVENT_COLORS[0]);
  const [projectId, setProjectId] = useState<string | undefined>();
  const [invitedTeamIds, setInvitedTeamIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  function toggleTeamInvite(teamId: string) {
    setInvitedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  }

  async function handleCreate() {
    if (!title.trim()) return;
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const end = new Date(tomorrow);
    end.setHours(10, 30, 0, 0);
    await createEvent({
      title: title.trim(),
      internalDescription,
      sharedDescription,
      location,
      color,
      startDate: tomorrow.toISOString(),
      endDate: end.toISOString(),
      status: "pending",
      isAllDay: false,
      projectId: projectId ?? null,
      invitedTeamIds,
    });
    setSaving(false);
    router.back();
  }

  // Teams that can be invited (all teams except creator's own)
  const invitableTeams = teams.filter((t) => t.id !== currentUser?.teamId);

  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: botPad }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.heading, { color: colors.foreground }]}>New Event</Text>

        <FormField label="Title">
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            value={title}
            onChangeText={setTitle}
            placeholder="Event title"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
          />
        </FormField>

        <FormField label="Internal Description">
          <View style={[styles.descBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={styles.descHeader}>
              <Feather name="lock" size={12} color="#7C3AED" />
              <Text style={[styles.descLabel, { color: "#7C3AED" }]}>Private — visible only to your team and Admin</Text>
            </View>
            <TextInput
              style={[styles.textareaInner, { color: colors.foreground }]}
              value={internalDescription}
              onChangeText={setInternalDescription}
              placeholder="Internal notes, context, or strategy..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
            />
          </View>
        </FormField>

        <FormField label="Shared Description">
          <View style={[styles.descBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={styles.descHeader}>
              <Feather name="globe" size={12} color="#2563EB" />
              <Text style={[styles.descLabel, { color: "#2563EB" }]}>Visible to invited teams</Text>
            </View>
            <TextInput
              style={[styles.textareaInner, { color: colors.foreground }]}
              value={sharedDescription}
              onChangeText={setSharedDescription}
              placeholder="What invited teams will see..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
            />
          </View>
        </FormField>

        <FormField label="Location">
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            value={location}
            onChangeText={setLocation}
            placeholder="Room, address, or virtual link"
            placeholderTextColor={colors.mutedForeground}
          />
        </FormField>

        {invitableTeams.length > 0 && (
          <FormField label="Invite Other Teams">
            <View style={{ gap: 6 }}>
              {invitableTeams.map((t) => {
                const selected = invitedTeamIds.includes(t.id);
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[
                      styles.teamRow,
                      { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + "15" : colors.card },
                    ]}
                    onPress={() => toggleTeamInvite(t.id)}
                    activeOpacity={0.7}
                  >
                    <Feather name={selected ? "check-square" : "square"} size={16} color={selected ? colors.primary : colors.mutedForeground} />
                    <Text style={[styles.teamRowText, { color: colors.foreground }]}>{t.name}</Text>
                    {t.functionLabel ? (
                      <Text style={[styles.teamRowSub, { color: colors.mutedForeground }]}>{t.functionLabel}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </FormField>
        )}

        <FormField label="Colour">
          <View style={styles.colorRow}>
            {EVENT_COLORS.map(c => (
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

        <FormField label="Link to Project (optional)">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <TouchableOpacity
              style={[styles.projectChip, { backgroundColor: !projectId ? colors.primary : colors.muted }]}
              onPress={() => setProjectId(undefined)}
              activeOpacity={0.7}
            >
              <Text style={[styles.projectChipText, { color: !projectId ? "#fff" : colors.mutedForeground }]}>None</Text>
            </TouchableOpacity>
            {projects.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.projectChip, { backgroundColor: projectId === p.id ? p.color : colors.muted }]}
                onPress={() => setProjectId(p.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.projectChipText, { color: projectId === p.id ? "#fff" : colors.mutedForeground }]} numberOfLines={1}>
                  {p.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </FormField>

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
              Create Event
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
  descBox: { borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  descHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  descLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  textareaInner: { padding: 12, paddingTop: 4, fontSize: 15, fontFamily: "Inter_400Regular", minHeight: 70, textAlignVertical: "top" },
  teamRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, padding: 12 },
  teamRowText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  teamRowSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  colorRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  colorSelected: { borderWidth: 3, borderColor: "rgba(0,0,0,0.2)" },
  projectChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, maxWidth: 160 },
  projectChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  createBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  createBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
