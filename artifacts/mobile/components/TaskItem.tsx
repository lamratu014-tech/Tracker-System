import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBadge } from "@/components/StatusBadge";
import type { Task } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  task: Task;
  onToggle: (task: Task) => void;
  onPress?: (task: Task) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "#EF4444",
  medium: "#F59E0B",
  low: "#94A3B8",
};

export function TaskItem({ task, onToggle, onPress }: Props) {
  const colors = useColors();
  const isDone = task.status === "done";

  function handleToggle() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle({ ...task, status: isDone ? "todo" : "done" });
  }

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={() => onPress?.(task)}
      activeOpacity={0.7}
    >
      <TouchableOpacity onPress={handleToggle} style={styles.checkbox} hitSlop={8}>
        <View style={[
          styles.check,
          { borderColor: isDone ? colors.primary : colors.border },
          isDone && { backgroundColor: colors.primary },
        ]}>
          {isDone && <Feather name="check" size={10} color="#fff" />}
        </View>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={[
          styles.title,
          { color: isDone ? colors.mutedForeground : colors.foreground },
          isDone && styles.strikethrough,
        ]} numberOfLines={1}>
          {task.title}
        </Text>
        <View style={styles.meta}>
          {task.assignee ? (
            <View style={styles.metaItem}>
              <Feather name="user" size={11} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{task.assignee}</Text>
            </View>
          ) : null}
          {task.dueDate ? (
            <View style={styles.metaItem}>
              <Feather name="calendar" size={11} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {new Date(task.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.right}>
        <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[task.priority] }]} />
        {!isDone && <StatusBadge status={task.status} small />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    padding: 2,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  strikethrough: {
    textDecorationLine: "line-through",
    opacity: 0.5,
  },
  meta: {
    flexDirection: "row",
    gap: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  right: {
    alignItems: "flex-end",
    gap: 4,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
