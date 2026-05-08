import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useDialog } from "@/components/Dialog";
import type { Milestone } from "@/models/types";
import { isOverdue } from "@/models/types";
import { useColors } from "@/hooks/useColors";

interface Props {
  milestone: Milestone;
  canEdit: boolean;
  onToggleCompleted?: (next: boolean) => void;
  onDelete?: () => void;
}

export function MilestoneRow({ milestone, canEdit, onToggleCompleted, onDelete }: Props) {
  const colors = useColors();
  const dialog = useDialog();
  const overdue = isOverdue(milestone);
  const completed = milestone.completed;

  function toggle() {
    if (!canEdit || !onToggleCompleted) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onToggleCompleted(!completed);
  }

  async function confirmDelete() {
    if (!onDelete) return;
    const ok = await dialog.confirm({
      title: "Delete milestone",
      message: `Delete "${milestone.title}"?`,
      destructive: true,
      confirmText: "Delete",
    });
    if (ok) onDelete();
  }

  const dl = new Date(milestone.date);
  const dlLabel = isNaN(dl.getTime())
    ? "—"
    : dl.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

  const tint = completed ? "#059669" : overdue ? "#DC2626" : "#2563EB";

  return (
    <View style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <TouchableOpacity
        onPress={toggle}
        disabled={!canEdit}
        style={[styles.check, { borderColor: tint, backgroundColor: completed ? tint : "transparent" }]}
        hitSlop={6}
      >
        {completed ? <Feather name="check" size={12} color="#fff" /> : null}
      </TouchableOpacity>

      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.title,
            {
              color: colors.foreground,
              textDecorationLine: completed ? "line-through" : "none",
              opacity: completed ? 0.65 : 1,
            },
          ]}
          numberOfLines={2}
        >
          {milestone.title}
        </Text>
        <View style={styles.metaRow}>
          <Feather name="calendar" size={11} color={overdue ? "#DC2626" : colors.mutedForeground} />
          <Text
            style={[
              styles.meta,
              {
                color: overdue ? "#DC2626" : colors.mutedForeground,
                fontFamily: overdue ? "Inter_600SemiBold" : "Inter_400Regular",
              },
            ]}
          >
            {dlLabel}
            {overdue ? " · Overdue" : ""}
            {completed ? " · Done" : ""}
          </Text>
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
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  title: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, flexWrap: "wrap" },
  meta: { fontSize: 11 },
  trash: { padding: 4 },
});
