import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  error?: unknown;
  message?: string;
  onRetry?: () => void;
}

function describe(error: unknown, fallback?: string): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback ?? "Something went wrong.";
}

export function ErrorBanner({ error, message, onRetry }: Props) {
  const colors = useColors();
  const text = describe(error, message);
  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" },
      ]}
    >
      <Feather name="alert-triangle" size={16} color="#B91C1C" />
      <Text style={[styles.text, { color: "#7F1D1D" }]} numberOfLines={3}>
        {text}
      </Text>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry} style={styles.retry}>
          <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginVertical: 8,
  },
  text: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  retry: { paddingHorizontal: 8, paddingVertical: 4 },
  retryText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
