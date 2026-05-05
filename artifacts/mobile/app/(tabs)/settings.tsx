import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, type UserRole } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useColors } from "@/hooks/useColors";

const ROLE_COLORS: Record<UserRole, string> = {
  programme_lead: "#7C3AED",
  team_lead: "#2563EB",
};

const ROLE_LABELS: Record<UserRole, string> = {
  programme_lead: "Programme Lead",
  team_lead: "Team Lead",
};

function SettingRow({
  icon,
  label,
  value,
  onPress,
  danger,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.rowIcon, { backgroundColor: danger ? "#FEE2E2" : colors.muted }]}>
        <Feather name={icon as any} size={16} color={danger ? "#EF4444" : colors.primary} />
      </View>
      <Text style={[styles.rowLabel, { color: danger ? "#EF4444" : colors.foreground }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text>
        ) : null}
        {onPress ? (
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{title}</Text>;
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUser, users, isProgrammeLead, logout } = useAuth();
  const { activityLogs, teams, streams, programme } = useData();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  if (!currentUser) return null;

  const myTeam = teams.find((t) => t.id === currentUser.teamId);
  const myStream = streams.find((s) => s.id === myTeam?.streamId);

  function handleLogout() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.navyDark, paddingTop: topPad + 16 }]}>
        <Text style={styles.headerTitle}>Settings</Text>
        {programme && (
          <Text style={styles.headerSub}>{programme.name}</Text>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: botPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: ROLE_COLORS[currentUser.role] }]}>
            <Text style={styles.avatarText}>{currentUser.initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.foreground }]}>
              {currentUser.name}
            </Text>
            <Text style={[styles.profileRole, { color: colors.mutedForeground }]}>
              {currentUser.department ? `${currentUser.department} · ` : ""}
              <Text style={{ color: ROLE_COLORS[currentUser.role] }}>
                {ROLE_LABELS[currentUser.role]}
              </Text>
            </Text>
            {myTeam && (
              <Text style={[styles.profileTeam, { color: colors.primary }]}>
                {myTeam.name}{myTeam.functionLabel ? ` — ${myTeam.functionLabel}` : ""}
                {myStream ? ` (${myStream.name})` : ""}
              </Text>
            )}
            {isProgrammeLead && (
              <Text style={[styles.profileTeam, { color: colors.primary }]}>
                {streams.length} stream{streams.length !== 1 ? "s" : ""} · {teams.length} team{teams.length !== 1 ? "s" : ""}
              </Text>
            )}
            <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>
              {currentUser.email}
            </Text>
          </View>
        </View>

        {/* Programme Lead admin panel */}
        {isProgrammeLead && (
          <>
            <SectionHeader title="Programme Management" />
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <SettingRow
                icon="shield"
                label="Programme Lead Panel"
                value="Full access"
                onPress={() => router.push("/admin")}
              />
              <SettingRow
                icon="activity"
                label="Activity Log"
                value={`${activityLogs.length} entries`}
                onPress={() => router.push("/admin")}
              />
              <SettingRow
                icon="users"
                label="Manage Users"
                value={`${users.filter((u) => u.active).length} active`}
                onPress={() => router.push("/admin")}
              />
              <SettingRow
                icon="grid"
                label="Streams & Teams"
                value={`${streams.length} streams · ${teams.length} teams`}
                onPress={() => router.push("/admin")}
              />
            </View>
          </>
        )}

        <SectionHeader title="Calendar" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="clock" label="Default Event Duration" value="1 hour" />
          <SettingRow icon="bell" label="Default Reminder" value="15 min before" />
          <SettingRow icon="globe" label="Time Zone" value="GMT+0 London" />
          <SettingRow icon="eye" label="Default Calendar View" value="Month" />
        </View>

        <SectionHeader title="Programme" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="flag" label="Default Task Priority" value="Medium" />
          <SettingRow icon="users" label="Task Assignment" value="User or Member" />
        </View>

        <SectionHeader title="Data & Security" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="server" label="Storage" value="PostgreSQL (server-side)" />
          <SettingRow icon="lock" label="Authentication" value="bcrypt + tokens" />
          <SettingRow icon="shield" label="Authorisation" value="Role-based (RBAC)" />
          <SettingRow icon="file-text" label="Privacy" value="UK GDPR / DPA 2018" />
        </View>

        <SectionHeader title="About" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="info" label="Version" value="2.0.0" />
        </View>

        <SectionHeader title="Account" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="log-out" label="Sign Out" onPress={handleLogout} danger />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20, gap: 2 },
  headerTitle: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontFamily: "Inter_400Regular" },
  profileCard: {
    margin: 16, borderRadius: 14, borderWidth: 1, padding: 16,
    flexDirection: "row", alignItems: "center", gap: 14,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 18, fontFamily: "Inter_600SemiBold" },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  profileRole: { fontSize: 13, fontFamily: "Inter_400Regular" },
  profileTeam: { fontSize: 12, fontFamily: "Inter_500Medium" },
  profileEmail: { fontSize: 12, fontFamily: "Inter_400Regular" },
  sectionHeader: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8,
    textTransform: "uppercase", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6,
  },
  section: { marginHorizontal: 16, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  rowIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowValue: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
