import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBadge } from "@/components/StatusBadge";
import type { CalendarEvent } from "@/context/DataContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { events, updateEvent, deleteEvent, getProjectById } = useData();

  const event = events.find(e => e.id === id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CalendarEvent | null>(event ?? null);

  if (!event || !draft) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Event not found.</Text>
      </View>
    );
  }

  const project = draft.projectId ? getProjectById(draft.projectId) : undefined;

  function save() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateEvent(draft!);
    setEditing(false);
  }

  function handleDelete() {
    Alert.alert("Delete Event", "Are you sure you want to delete this event?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteEvent(event.id);
          router.back();
        }
      },
    ]);
  }

  function cycleStatus() {
    const order: CalendarEvent["status"][] = ["pending", "approved", "rejected"];
    const next = order[(order.indexOf(draft!.status) + 1) % order.length];
    setDraft({ ...draft!, status: next });
  }

  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top accent bar */}
      <View style={[styles.accentBar, { backgroundColor: draft.color }]} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: botPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>
          {/* Title */}
          {editing ? (
            <TextInput
              style={[styles.titleInput, { color: colors.foreground, borderBottomColor: colors.primary }]}
              value={draft.title}
              onChangeText={t => setDraft({ ...draft, title: t })}
              autoFocus
            />
          ) : (
            <Text style={[styles.title, { color: colors.foreground }]}>{draft.title}</Text>
          )}

          {/* Status + actions */}
          <View style={styles.row}>
            <TouchableOpacity onPress={cycleStatus} activeOpacity={0.7}>
              <StatusBadge status={draft.status} />
            </TouchableOpacity>
            <View style={styles.actions}>
              {editing ? (
                <>
                  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.muted }]} onPress={() => { setDraft(event); setEditing(false); }} activeOpacity={0.7}>
                    <Feather name="x" size={18} color={colors.foreground} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.primary }]} onPress={save} activeOpacity={0.7}>
                    <Feather name="check" size={18} color="#fff" />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.muted }]} onPress={() => setEditing(true)} activeOpacity={0.7}>
                    <Feather name="edit-2" size={18} color={colors.foreground} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: "#FEE2E2" }]} onPress={handleDelete} activeOpacity={0.7}>
                    <Feather name="trash-2" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* Details */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <DetailRow icon="calendar" label="Date">
              <Text style={[styles.detailVal, { color: colors.foreground }]}>
                {new Date(draft.startDate).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </Text>
            </DetailRow>
            {!draft.isAllDay && (
              <DetailRow icon="clock" label="Time">
                <Text style={[styles.detailVal, { color: colors.foreground }]}>
                  {new Date(draft.startDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – {new Date(draft.endDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </DetailRow>
            )}
            {editing ? (
              <DetailRow icon="map-pin" label="Location">
                <TextInput
                  style={[styles.inlineInput, { color: colors.foreground, borderBottomColor: colors.border }]}
                  value={draft.location}
                  onChangeText={t => setDraft({ ...draft, location: t })}
                  placeholder="Add location"
                  placeholderTextColor={colors.mutedForeground}
                />
              </DetailRow>
            ) : draft.location ? (
              <DetailRow icon="map-pin" label="Location">
                <Text style={[styles.detailVal, { color: colors.foreground }]}>{draft.location}</Text>
              </DetailRow>
            ) : null}
            {project && (
              <DetailRow icon="briefcase" label="Project">
                <TouchableOpacity onPress={() => router.push({ pathname: "/project/[id]", params: { id: project.id } })} activeOpacity={0.7}>
                  <Text style={[styles.detailVal, { color: colors.primary }]}>{project.title}</Text>
                </TouchableOpacity>
              </DetailRow>
            )}
          </View>

          {/* Description */}
          <View style={styles.fieldBlock}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Description</Text>
            {editing ? (
              <TextInput
                style={[styles.textarea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                value={draft.description}
                onChangeText={t => setDraft({ ...draft, description: t })}
                multiline
                numberOfLines={4}
                placeholder="Add a description..."
                placeholderTextColor={colors.mutedForeground}
              />
            ) : (
              <Text style={[styles.bodyText, { color: draft.description ? colors.foreground : colors.mutedForeground }]}>
                {draft.description || "No description"}
              </Text>
            )}
          </View>

          {/* Attendees */}
          {draft.attendees.length > 0 && (
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Attendees</Text>
              <View style={styles.attendees}>
                {draft.attendees.map((a, i) => (
                  <View key={i} style={[styles.attendeePill, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.attendeeText, { color: colors.foreground }]}>{a}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={detailStyles.row}>
      <View style={detailStyles.iconCol}>
        <Feather name={icon as any} size={15} color={colors.mutedForeground} />
      </View>
      <Text style={[detailStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={detailStyles.val}>{children}</View>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
  iconCol: { width: 20, alignItems: "center" },
  label: { width: 80, fontSize: 13, fontFamily: "Inter_500Medium" },
  val: { flex: 1 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  accentBar: { height: 4 },
  body: { padding: 20, gap: 16 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", lineHeight: 28 },
  titleInput: { fontSize: 22, fontFamily: "Inter_700Bold", borderBottomWidth: 2, paddingBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actions: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  detailVal: { fontSize: 14, fontFamily: "Inter_400Regular" },
  inlineInput: { fontSize: 14, fontFamily: "Inter_400Regular", borderBottomWidth: 1, paddingBottom: 2 },
  fieldBlock: { gap: 6 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  bodyText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  textarea: { borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 80, textAlignVertical: "top" },
  attendees: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  attendeePill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  attendeeText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
