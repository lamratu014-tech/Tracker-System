import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  label?: string;
  inline?: boolean;
}

export function LoadingRow({ label = "Loading…", inline }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.row, inline ? styles.inline : styles.block]}>
      <ActivityIndicator color={colors.primary} />
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  inline: { paddingVertical: 6 },
  block: { paddingVertical: 24, justifyContent: "center" },
  label: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
