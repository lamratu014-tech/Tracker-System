import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { EventStatus, ProjectStatus, TaskStatus, TaskPriority } from "@/context/DataContext";

type StatusType = EventStatus | ProjectStatus | TaskStatus | TaskPriority;

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: "Pending", bg: "#FEF3C7", text: "#92400E" },
  approved: { label: "Approved", bg: "#D1FAE5", text: "#065F46" },
  rejected: { label: "Rejected", bg: "#FEE2E2", text: "#991B1B" },
  not_started: { label: "Not Started", bg: "#F1F5F9", text: "#475569" },
  in_progress: { label: "In Progress", bg: "#DBEAFE", text: "#1E40AF" },
  at_risk: { label: "At Risk", bg: "#FEF3C7", text: "#92400E" },
  completed: { label: "Completed", bg: "#D1FAE5", text: "#065F46" },
  todo: { label: "To Do", bg: "#F1F5F9", text: "#475569" },
  done: { label: "Done", bg: "#D1FAE5", text: "#065F46" },
  low: { label: "Low", bg: "#F1F5F9", text: "#475569" },
  medium: { label: "Medium", bg: "#FEF3C7", text: "#92400E" },
  high: { label: "High", bg: "#FEE2E2", text: "#991B1B" },
};

interface Props {
  status: StatusType;
  small?: boolean;
}

export function StatusBadge({ status, small }: Props) {
  const config = STATUS_CONFIG[status] ?? { label: status, bg: "#F1F5F9", text: "#475569" };
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, small && styles.small]}>
      <Text style={[styles.text, { color: config.text }, small && styles.smallText]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  smallText: {
    fontSize: 10,
  },
});
