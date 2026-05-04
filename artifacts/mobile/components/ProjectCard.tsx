import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBadge } from "@/components/StatusBadge";
import type { Project, Task } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  project: Project;
  tasks: Task[];
  compact?: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function ProjectCard({ project, tasks, compact }: Props) {
  const colors = useColors();
  const router = useRouter();

  const total = tasks.length;
  const done = tasks.filter(t => t.status === "done").length;
  const progress = total > 0 ? done / total : 0;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push({ pathname: "/project/[id]", params: { id: project.id } })}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: project.color }]} />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>{project.title}</Text>
          <Text style={[styles.phase, { color: colors.mutedForeground }]}>{project.phase}</Text>
        </View>
        <StatusBadge status={project.status} small />
      </View>

      {!compact && (
        <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={2}>
          {project.description}
        </Text>
      )}

      <View style={styles.progressRow}>
        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: project.color }]} />
        </View>
        <Text style={[styles.progressText, { color: colors.mutedForeground }]}>{done}/{total}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.metaItem}>
          <Feather name="user" size={12} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{project.owner}</Text>
        </View>
        <View style={styles.metaItem}>
          <Feather name="calendar" size={12} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>Due {formatDate(project.dueDate)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  phase: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  desc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    minWidth: 28,
    textAlign: "right",
  },
  footer: {
    flexDirection: "row",
    gap: 16,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
