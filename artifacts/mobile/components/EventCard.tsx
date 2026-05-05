import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBadge } from "@/components/StatusBadge";
import type { CalendarEvent } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  event: CalendarEvent;
  compact?: boolean;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function EventCard({ event, compact }: Props) {
  const colors = useColors();
  const router = useRouter();

  const displayDesc =
    event.visibility === "full"
      ? event.internalDescription || event.sharedDescription
      : event.sharedDescription;

  const isSharedOnly = event.visibility === "shared";

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push({ pathname: "/event/[id]", params: { id: event.id } })}
      activeOpacity={0.7}
    >
      <View style={[styles.colorBar, { backgroundColor: event.color }]} />
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{event.title}</Text>
          <View style={styles.badges}>
            {isSharedOnly && (
              <View style={[styles.sharedBadge, { backgroundColor: "#DBEAFE" }]}>
                <Feather name="globe" size={10} color="#2563EB" />
                <Text style={styles.sharedBadgeText}>Shared</Text>
              </View>
            )}
            <StatusBadge status={event.status} small />
          </View>
        </View>
        {!compact && displayDesc ? (
          <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={1}>
            {displayDesc}
          </Text>
        ) : null}
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Feather name="clock" size={12} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {event.isAllDay ? formatDate(event.startDate) : `${formatDate(event.startDate)} · ${formatTime(event.startDate)}`}
            </Text>
          </View>
          {event.location ? (
            <View style={styles.metaItem}>
              <Feather name="map-pin" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                {event.location}
              </Text>
            </View>
          ) : null}
          {event.invitedTeamIds.length > 0 && !isSharedOnly && (
            <View style={styles.metaItem}>
              <Feather name="users" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {event.invitedTeamIds.length} team{event.invitedTeamIds.length > 1 ? "s" : ""} invited
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12, borderWidth: 1, flexDirection: "row", overflow: "hidden", marginBottom: 8,
  },
  colorBar: { width: 4 },
  content: { flex: 1, padding: 12, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  badges: { flexDirection: "row", alignItems: "center", gap: 4 },
  title: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular" },
  sharedBadge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  sharedBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#2563EB" },
  meta: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginTop: 2 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
