import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import type { Role } from "@/models/types";
import { useColors } from "@/hooks/useColors";

interface Action {
  key: string;
  label: string;
  icon: string;
  href: string;
}

const ALL: Action[] = [
  { key: "stream", label: "New Stream", icon: "layers", href: "/new-stream" },
  { key: "team", label: "New Team", icon: "users", href: "/new-team" },
  { key: "user", label: "Invite User", icon: "user-plus", href: "/new-user" },
  { key: "project", label: "New Project", icon: "folder-plus", href: "/new-project" },
  { key: "milestone", label: "New Milestone", icon: "flag", href: "/new-milestone" },
  { key: "event", label: "New Event", icon: "calendar", href: "/new-event" },
];

const ROLE_ACTIONS: Record<Role, string[]> = {
  admin: ["stream", "team", "user", "project", "milestone", "event"],
  programme_overseer: ["stream", "team", "user", "project", "milestone", "event"],
  stream_overseer: ["team", "project", "milestone", "event"],
  leader: ["project", "milestone", "event"],
};

interface Props {
  visible: boolean;
  role: Role;
  onClose: () => void;
}

export function CreateActionSheet({ visible, role, onClose }: Props) {
  const colors = useColors();
  const router = useRouter();
  const allowedKeys = ROLE_ACTIONS[role] ?? [];
  const actions = ALL.filter((a) => allowedKeys.includes(a.key));

  function pick(href: string) {
    onClose();
    setTimeout(() => router.push(href as never), 80);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text style={[styles.title, { color: colors.foreground }]}>Create</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            What would you like to add?
          </Text>

          <View style={{ height: 8 }} />

          {actions.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.muted }]}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Nothing to create with your current role.
              </Text>
            </View>
          ) : (
            actions.map((a) => (
              <TouchableOpacity
                key={a.key}
                style={[styles.row, { borderColor: colors.border }]}
                onPress={() => pick(a.href)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconWrap, { backgroundColor: colors.primary + "15" }]}>
                  <Feather name={a.icon as never} size={16} color={colors.primary} />
                </View>
                <Text style={[styles.label, { color: colors.foreground }]}>{a.label}</Text>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))
          )}

          <TouchableOpacity onPress={onClose} style={[styles.cancel, { backgroundColor: colors.muted }]}>
            <Text style={[styles.cancelText, { color: colors.foreground }]}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8,
    borderWidth: 1, borderBottomWidth: 0, maxHeight: "80%",
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.15)", alignSelf: "center", marginBottom: 12,
  },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  label: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  empty: { padding: 16, borderRadius: 10, marginVertical: 12 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  cancel: { marginTop: 12, padding: 14, borderRadius: 10, alignItems: "center" },
  cancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
