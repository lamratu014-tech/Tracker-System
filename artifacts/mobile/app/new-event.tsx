import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
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
import { useColors } from "@/hooks/useColors";

const EVENT_COLORS = [
  "#2563EB", "#7C3AED", "#DC2626", "#D97706", "#059669", "#0891B2", "#DB2777",
];

export default function NewEventScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addEvent, projects } = useData();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [color, setColor] = useState(EVENT_COLORS[0]);
  const [projectId, setProjectId] = useState<string | undefined>();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  function handleCreate() {
    if (!title.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const end = new Date(tomorrow);
    end.setHours(10, 30, 0, 0);
    addEvent({
      title: title.trim(),
      description,
      location,
      color,
      startDate: tomorrow.toISOString(),
      endDate: end.toISOString(),
      status: "pending",
      isAllDay: false,
      projectId,
      attendees: [],
    });
    router.back();
  }

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

        <FormField label="Description">
          <TextInput
            style={[styles.textarea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add a description..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
          />
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
          disabled={!title.trim()}
          activeOpacity={0.8}
        >
          <Text style={[styles.createBtnText, { color: title.trim() ? "#fff" : colors.mutedForeground }]}>
            Create Event
          </Text>
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
  colorRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  colorSwatch: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  colorSelected: { borderWidth: 3, borderColor: "rgba(0,0,0,0.2)" },
  projectChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, maxWidth: 160 },
  projectChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  createBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  createBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
