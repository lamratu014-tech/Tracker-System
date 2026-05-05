import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { canManageEverything, useCurrentUser, useStore } from "@/store/useStore";

export default function EventDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useCurrentUser();
  const event = useStore((s) => s.events.find((e) => e.id === id) ?? null);
  const streams = useStore((s) => s.streams);
  const users = useStore((s) => s.users);
  const deleteEvent = useStore((s) => s.deleteEvent);

  if (!event) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: colors.mutedForeground }}>Event not found.</Text>
      </View>
    );
  }

  const isAdmin = canManageEverything(me);
  const isCreator = me?.id === event.createdBy;
  const canDelete = isAdmin || isCreator;

  let linkedLabel = "Programme-wide";
  if (event.linkedTeamId) {
    for (const s of streams) {
      const t = s.teams.find((x) => x.id === event.linkedTeamId);
      if (t) { linkedLabel = `${s.name} · ${t.name}`; break; }
    }
  } else if (event.linkedStreamId) {
    const s = streams.find((x) => x.id === event.linkedStreamId);
    if (s) linkedLabel = s.name;
  }

  const creator = users.find((u) => u.id === event.createdBy);
  const dt = new Date(event.fullDateTime);
  const dateStr = dt.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  function confirmDelete() {
    const msg = `Delete event "${event!.title}"?`;
    if (Platform.OS === "web") {
      if (window.confirm(msg)) { deleteEvent(event!.id); router.back(); }
    } else {
      Alert.alert("Delete event", msg, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => { deleteEvent(event!.id); router.back(); } },
      ]);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: colors.foreground }]}>{event.title}</Text>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.line}>
          <Feather name="calendar" size={14} color={colors.primary} />
          <Text style={[styles.lineText, { color: colors.foreground }]}>{dateStr}</Text>
        </View>
        <View style={styles.line}>
          <Feather name="clock" size={14} color={colors.primary} />
          <Text style={[styles.lineText, { color: colors.foreground }]}>{event.time}</Text>
        </View>
        <View style={styles.line}>
          <Feather name="link" size={14} color={colors.primary} />
          <Text style={[styles.lineText, { color: colors.foreground }]}>{linkedLabel}</Text>
        </View>
        {creator ? (
          <View style={styles.line}>
            <Feather name="user" size={14} color={colors.primary} />
            <Text style={[styles.lineText, { color: colors.foreground }]}>Created by {creator.name}</Text>
          </View>
        ) : null}
      </View>

      {event.description ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.heading, { color: colors.mutedForeground }]}>Description</Text>
          <Text style={[styles.body, { color: colors.foreground }]}>{event.description}</Text>
        </View>
      ) : null}

      {canDelete ? (
        <TouchableOpacity
          style={[styles.deleteBtn, { backgroundColor: "#FEE2E2" }]}
          onPress={confirmDelete}
        >
          <Feather name="trash-2" size={14} color="#DC2626" />
          <Text style={[styles.deleteText, { color: "#DC2626" }]}>Delete Event</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  card: { padding: 14, borderRadius: 10, borderWidth: 1, gap: 8 },
  line: { flexDirection: "row", alignItems: "center", gap: 8 },
  lineText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  heading: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  body: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 14, borderRadius: 10 },
  deleteText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
