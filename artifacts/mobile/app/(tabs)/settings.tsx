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
import { useAudit } from "@/context/AuditContext";
import { useColors } from "@/hooks/useColors";

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "#7C3AED",
  manager: "#2563EB",
  viewer: "#64748B",
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
  const { currentUser, users, isAdmin, logout } = useAuth();
  const { entries } = useAudit();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  if (!currentUser) return null;

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
              {currentUser.department}
              {currentUser.department ? " · " : ""}
              <Text style={{ color: ROLE_COLORS[currentUser.role] }}>
                {currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}
              </Text>
            </Text>
            <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>
              {currentUser.email}
            </Text>
          </View>
        </View>

        {/* Admin */}
        {isAdmin && (
          <>
            <SectionHeader title="Administration" />
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <SettingRow
                icon="shield"
                label="Admin Panel"
                value="Full access"
                onPress={() => router.push("/admin")}
              />
              <SettingRow
                icon="activity"
                label="Audit Log"
                value={`${entries.length} entries`}
                onPress={() => router.push("/admin")}
              />
              <SettingRow
                icon="users"
                label="Manage Users"
                value={`${users.filter((u) => u.active).length} active`}
                onPress={() => router.push("/admin")}
              />
            </View>
          </>
        )}

        <SectionHeader title="Calendar" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="clock" label="Default Event Duration" value="1 hour" onPress={() => {}} />
          <SettingRow icon="bell" label="Default Reminder" value="15 min before" onPress={() => {}} />
          <SettingRow icon="globe" label="Time Zone" value="GMT+0 London" onPress={() => {}} />
          <SettingRow icon="eye" label="Default Calendar View" value="Month" onPress={() => {}} />
        </View>

        <SectionHeader title="Projects" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="user" label="Default Task Assignee" value="Unassigned" onPress={() => {}} />
          <SettingRow icon="flag" label="Default Task Priority" value="Medium" onPress={() => {}} />
        </View>

        <SectionHeader title="Notifications" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="bell" label="Event Reminders" value="On" onPress={() => {}} />
          <SettingRow icon="alert-triangle" label="At-Risk Alerts" value="On" onPress={() => {}} />
          <SettingRow icon="check-circle" label="Task Completion" value="Off" onPress={() => {}} />
        </View>

        <SectionHeader title="Data & Security" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="lock" label="Encryption" value="AES-256-GCM" />
          <SettingRow icon="shield" label="Key Storage" value="OS Secure Enclave" />
          <SettingRow icon="database" label="Data Location" value="On-device only" />
          <SettingRow icon="file-text" label="Privacy Policy" value="UK GDPR / DPA 2018" onPress={() => {}} />
        </View>

        <SectionHeader title="About" />
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SettingRow icon="info" label="Version" value="1.0.0" />
          <SettingRow icon="book-open" label="Documentation" onPress={() => {}} />
        </View>

        {/* Sign Out */}
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
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold" },
  profileCard: {
    margin: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 18, fontFamily: "Inter_600SemiBold" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  profileRole: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  profileEmail: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  sectionHeader: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },
  section: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowValue: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
