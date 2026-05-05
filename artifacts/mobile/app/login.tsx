import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useStore } from "@/store/useStore";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  leader: "Team Leader",
  member: "Team Member",
};

const ROLE_COLOR: Record<string, string> = {
  admin: "#7C3AED",
  leader: "#2563EB",
  member: "#059669",
};

export default function LoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const users = useStore((s) => s.users);
  const streams = useStore((s) => s.streams);
  const login = useStore((s) => s.login);

  function teamLabel(teamId: string | null): string {
    if (!teamId) return "—";
    for (const st of streams) {
      const t = st.teams.find((x) => x.id === teamId);
      if (t) return `${st.name} · ${t.name}`;
    }
    return "—";
  }

  function pick(userId: string) {
    login(userId);
    router.replace("/(tabs)");
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.brand, { backgroundColor: colors.primary }]}>
          <Feather name="briefcase" size={28} color="#fff" />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Ops & Planning</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>Choose a profile to continue</Text>

        <View style={{ height: 24 }} />

        {users.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.muted }]}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No users yet. Reset to seed data from Settings → Reset.
            </Text>
          </View>
        ) : (
          users.map((u) => (
            <TouchableOpacity
              key={u.id}
              style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => pick(u.id)}
              activeOpacity={0.85}
            >
              <View style={[styles.avatar, { backgroundColor: ROLE_COLOR[u.role] + "22" }]}>
                <Text style={[styles.avatarText, { color: ROLE_COLOR[u.role] }]}>
                  {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: colors.foreground }]}>{u.name}</Text>
                <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                  {ROLE_LABEL[u.role]} · {teamLabel(u.teamId)}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))
        )}

        <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
          Profiles are stored on this device. Anyone using the device can pick a profile.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  brand: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 24,
    marginBottom: 16,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center" },
  sub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  empty: { padding: 16, borderRadius: 12 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  footnote: { marginTop: 24, fontSize: 11, textAlign: "center", fontFamily: "Inter_400Regular" },
});
