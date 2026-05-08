import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  getGetStreamQueryKey,
  getGetTeamQueryKey,
  useGetStream,
  useGetTeam,
} from "@workspace/api-client-react";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDialog } from "@/components/Dialog";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth/AuthContext";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  programme_overseer: "Programme Overseer",
  stream_overseer: "Stream Overseer",
  leader: "Team Leader",
};

export default function SettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: me, signOut } = useAuth();
  const dialog = useDialog();
  const [signingOut, setSigningOut] = React.useState(false);

  const teamQ = useGetTeam(me?.teamId ?? "", {
    query: { enabled: !!me?.teamId, queryKey: getGetTeamQueryKey(me?.teamId ?? "") },
  });
  const team = teamQ.data ?? null;
  const streamId = me?.streamId ?? team?.streamId ?? null;
  const streamQ = useGetStream(streamId ?? "", {
    query: { enabled: !!streamId, queryKey: getGetStreamQueryKey(streamId ?? "") },
  });
  const stream = streamQ.data ?? null;

  if (!me) return null;

  let context = "Programme-wide";
  if (team && stream) context = `${stream.name} · ${team.name}`;
  else if (stream) context = `${stream.name} (whole stream)`;
  else if (me.role === "leader") context = "No team yet";

  async function handleLogout() {
    const ok = await dialog.confirm({
      title: "Sign out",
      message: "Sign out of your account?",
      destructive: true,
      confirmText: "Sign out",
    });
    if (!ok || signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
      router.replace("/login");
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: 100 }]}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Settings</Text>

      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {me.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.name, { color: colors.foreground }]}>{me.name}</Text>
        <Text style={[styles.email, { color: colors.mutedForeground }]}>{me.email}</Text>
        <View style={[styles.roleChip, { backgroundColor: colors.primary }]}>
          <Text style={styles.roleChipText}>
            {(ROLE_LABEL[me.role] ?? me.role).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.profileMeta, { color: colors.mutedForeground }]}>{context}</Text>
      </View>

      {me.role === "admin" ? (
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push("/admin")}
        >
          <Feather name="shield" size={16} color={colors.primary} />
          <Text style={[styles.btnText, { color: colors.foreground }]}>Admin Panel</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={handleLogout}
      >
        <Feather name="log-out" size={16} color={colors.foreground} />
        <Text style={[styles.btnText, { color: colors.foreground }]}>Sign out</Text>
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>

      <Text style={[styles.footnote, { color: colors.mutedForeground }]}>Ops & Planning</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 16 },
  profileCard: {
    alignItems: "center", padding: 20, borderRadius: 12, borderWidth: 1,
    gap: 6, marginBottom: 16,
  },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontFamily: "Inter_700Bold" },
  name: { fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 4 },
  email: { fontSize: 12, fontFamily: "Inter_400Regular" },
  roleChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginTop: 4 },
  roleChipText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  profileMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  btn: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
    borderWidth: 1, borderRadius: 10, marginBottom: 8,
  },
  btnText: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  footnote: { marginTop: 24, fontSize: 11, textAlign: "center", fontFamily: "Inter_400Regular" },
});
