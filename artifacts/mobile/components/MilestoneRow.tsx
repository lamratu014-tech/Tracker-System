import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { Milestone, MilestoneStatus } from "@/models/types";
import { isOverdue } from "@/models/types";
import { useColors } from "@/hooks/useColors";

const STATUS_COLORS: Record<MilestoneStatus, string> = {
  pending: "#94A3B8",
  in_progress: "#2563EB",
  blocked: "#DC2626",
  completed: "#059669",
};
const STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  blocked: "Blocked",
  completed: "Completed",
};

const STATUS_CYCLE: MilestoneStatus[] = ["pending", "in_progress", "blocked", "completed"];

interface Props {
  milestone: Milestone;
  canEdit: boolean;
  assigneeName?: string;
  onCycleStatus?: (next: MilestoneStatus) => void;
  onDelete?: () => void;
}

export function MilestoneRow({ milestone, canEdit, assigneeName, onCycleStatus, onDelete }: Props) {
  const colors = useColors();
  const overdue = isOverdue(milestone);

  function cycle() {
    if (!canEdit || !onCycleStatus) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const i = STATUS_CYCLE.indexOf(milestone.status);
    const next = STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length];
    onCycleStatus(next);
  }

  function confirmDelete() {
    if (!onDelete) return;
    if (Platform.OS === "web") {
      if (window.confirm(`Delete milestone "${milestone.title}"?`)) onDelete();
    } else {
      Alert.alert("Delete milestone", `Delete "${milestone.title}"?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
      ]);
    }
  }

  const dl = new Date(milestone.deadline);
  const dlLabel = isNaN(dl.getTime())
    ? "—"
    : dl.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

  return (
    <View style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <TouchableOpacity
        onPress={cycle}
        disabled={!canEdit}
        style={[styles.statusPill, { backgroundColor: STATUS_COLORS[milestone.status] + "22", borderColor: STATUS_COLORS[milestone.status] }]}
        hitSlop={6}
      >
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[milestone.status] }]} />
        <Text style={[styles.statusText, { color: STATUS_COLORS[milestone.status] }]}>
          {STATUS_LABELS[milestone.status]}
        </Text>
      </TouchableOpacity>

      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
          {milestone.title}
        </Text>
        <View style={styles.metaRow}>
          <Feather name="calendar" size={11} color={overdue ? "#DC2626" : colors.mutedForeground} />
          <Text style={[styles.meta, { color: overdue ? "#DC2626" : colors.mutedForeground, fontFamily: overdue ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
            {dlLabel}{overdue ? " · Overdue" : ""}
          </Text>
          {assigneeName ? (
            <>
              <Feather name="user" size={11} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>{assigneeName}</Text>
            </>
          ) : null}
        </View>
      </View>

      {canEdit && onDelete ? (
        <TouchableOpacity onPress={confirmDelete} hitSlop={8} style={styles.trash}>
          <Feather name="trash-2" size={14} color="#DC2626" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 8,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.3 },
  title: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, flexWrap: "wrap" },
  meta: { fontSize: 11 },
  trash: { padding: 4 },
});
