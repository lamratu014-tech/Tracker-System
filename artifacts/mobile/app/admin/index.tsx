import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import type { Role } from "@/models/types";
import { useCurrentUser, useStore } from "@/store/useStore";

type AdminTab = "users" | "structure" | "events";

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  leader: "Leader",
  member: "Member",
};

const ROLE_COLOR: Record<Role, string> = {
  admin: "#7C3AED",
  leader: "#2563EB",
  member: "#059669",
};

function confirm(message: string, onYes: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(message)) onYes();
  } else {
    Alert.alert("Confirm", message, [
      { text: "Cancel", style: "cancel" },
      { text: "Yes", style: "destructive", onPress: onYes },
    ]);
  }
}

export default function AdminPanelScreen() {
  const colors = useColors();
  const router = useRouter();
  const me = useCurrentUser();
  const users = useStore((s) => s.users);
  const streams = useStore((s) => s.streams);
  const events = useStore((s) => s.events);
  const updateUser = useStore((s) => s.updateUser);
  const deleteUser = useStore((s) => s.deleteUser);
  const deleteStream = useStore((s) => s.deleteStream);
  const deleteTeam = useStore((s) => s.deleteTeam);
  const deleteEvent = useStore((s) => s.deleteEvent);

  const [tab, setTab] = useState<AdminTab>("structure");
  const [expandedStreamId, setExpandedStreamId] = useState<string | null>(streams[0]?.id ?? null);

  if (me?.role !== "admin") return null;

  function teamLabel(teamId: string | null): string {
    if (!teamId) return "—";
    for (const st of streams) {
      const t = st.teams.find((x) => x.id === teamId);
      if (t) return `${st.name} · ${t.name}`;
    }
    return "—";
  }

  function changeRole(userId: string, currentRole: Role) {
    const next: Role = currentRole === "admin" ? "leader" : currentRole === "leader" ? "member" : "admin";
    updateUser(userId, { role: next });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.tabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(["structure", "users", "events"] as AdminTab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && { borderBottomColor: colors.primary }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.primary : colors.mutedForeground }]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {tab === "structure" ? (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Streams ({streams.length}) · Teams ({streams.reduce((n, s) => n + s.teams.length, 0)})
              </Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TouchableOpacity
                  style={[styles.smallBtn, { backgroundColor: colors.muted }]}
                  onPress={() => router.push("/new-team")}
                >
                  <Feather name="users" size={12} color={colors.primary} />
                  <Text style={[styles.smallBtnText, { color: colors.primary }]}>Team</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push("/new-stream")}
                >
                  <Feather name="plus" size={12} color="#fff" />
                  <Text style={[styles.smallBtnText, { color: "#fff" }]}>Stream</Text>
                </TouchableOpacity>
              </View>
            </View>

            {streams.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.muted }]}>
                <Text style={{ color: colors.mutedForeground }}>No streams yet.</Text>
              </View>
            ) : (
              streams.map((stream) => {
                const expanded = expandedStreamId === stream.id;
                return (
                  <View key={stream.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 0 }]}>
                    <TouchableOpacity
                      style={styles.cardHeader}
                      onPress={() => setExpandedStreamId(expanded ? null : stream.id)}
                      activeOpacity={0.85}
                    >
                      <Feather name={expanded ? "chevron-down" : "chevron-right"} size={16} color={colors.mutedForeground} />
                      <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.cardTitle, { color: colors.foreground }]}>{stream.name}</Text>
                        <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                          {stream.teams.length} team{stream.teams.length !== 1 ? "s" : ""}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 4 }}>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={(e) => { e.stopPropagation(); router.push({ pathname: "/stream/[id]", params: { id: stream.id } }); }}
                        >
                          <Feather name="external-link" size={14} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            confirm(`Delete stream "${stream.name}"?`, () => deleteStream(stream.id));
                          }}
                        >
                          <Feather name="trash-2" size={14} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>

                    {expanded ? (
                      <View style={styles.cardBody}>
                        {stream.teams.length === 0 ? (
                          <Text style={{ color: colors.mutedForeground, padding: 8, textAlign: "center" }}>
                            No teams in this stream.
                          </Text>
                        ) : (
                          stream.teams.map((team) => (
                            <View key={team.id} style={[styles.subRow, { borderColor: colors.border }]}>
                              <Feather name="users" size={14} color={colors.primary} />
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.subTitle, { color: colors.foreground }]}>{team.name}</Text>
                                <Text style={[styles.subMeta, { color: colors.mutedForeground }]}>
                                  {team.projects.length} project{team.projects.length !== 1 ? "s" : ""}
                                </Text>
                              </View>
                              <TouchableOpacity
                                style={styles.iconBtn}
                                onPress={() => router.push({ pathname: "/team/[id]", params: { id: team.id } })}
                              >
                                <Feather name="external-link" size={13} color={colors.primary} />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.iconBtn}
                                onPress={() => confirm(`Delete team "${team.name}"?`, () => deleteTeam(team.id))}
                              >
                                <Feather name="trash-2" size={13} color="#DC2626" />
                              </TouchableOpacity>
                            </View>
                          ))
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </>
        ) : null}

        {tab === "users" ? (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Users ({users.length})</Text>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/new-user")}
              >
                <Feather name="user-plus" size={12} color="#fff" />
                <Text style={[styles.smallBtnText, { color: "#fff" }]}>User</Text>
              </TouchableOpacity>
            </View>
            {users.map((u) => (
              <View key={u.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 10 }]}>
                <View style={[styles.avatar, { backgroundColor: ROLE_COLOR[u.role] + "22" }]}>
                  <Text style={[styles.avatarText, { color: ROLE_COLOR[u.role] }]}>
                    {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                    {u.name} {me?.id === u.id ? <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>(you)</Text> : null}
                  </Text>
                  <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                    {teamLabel(u.teamId)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.roleChip, { backgroundColor: ROLE_COLOR[u.role] }]}
                  onPress={() => changeRole(u.id, u.role)}
                  hitSlop={6}
                >
                  <Text style={styles.roleChipText}>{ROLE_LABEL[u.role]}</Text>
                </TouchableOpacity>
                {me?.id !== u.id ? (
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => confirm(`Delete user "${u.name}"?`, () => deleteUser(u.id))}
                  >
                    <Feather name="trash-2" size={14} color="#DC2626" />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Tap the role chip to cycle: Admin → Leader → Member → Admin.
            </Text>
          </>
        ) : null}

        {tab === "events" ? (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Events ({events.length})</Text>
              <TouchableOpacity
                style={[styles.smallBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/new-event")}
              >
                <Feather name="plus" size={12} color="#fff" />
                <Text style={[styles.smallBtnText, { color: "#fff" }]}>Event</Text>
              </TouchableOpacity>
            </View>
            {events.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.muted }]}>
                <Text style={{ color: colors.mutedForeground }}>No events.</Text>
              </View>
            ) : (
              events
                .slice()
                .sort((a, b) => +new Date(a.fullDateTime) - +new Date(b.fullDateTime))
                .map((ev) => (
                  <View key={ev.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 10 }]}>
                    <View style={[styles.dateBox, { backgroundColor: colors.primary + "15" }]}>
                      <Text style={[styles.dateBoxDay, { color: colors.primary }]}>
                        {new Date(ev.fullDateTime).getDate()}
                      </Text>
                      <Text style={[styles.dateBoxMo, { color: colors.primary }]}>
                        {new Date(ev.fullDateTime).toLocaleDateString([], { month: "short" })}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={1}>{ev.title}</Text>
                      <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {ev.time} · {teamLabel(ev.linkedTeamId)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => router.push({ pathname: "/event/[id]", params: { id: ev.id } })}
                    >
                      <Feather name="external-link" size={14} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => confirm(`Delete event "${ev.title}"?`, () => deleteEvent(ev.id))}
                    >
                      <Feather name="trash-2" size={14} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                ))
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  smallBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  card: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  cardBody: { paddingHorizontal: 10, paddingBottom: 10, gap: 6 },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  iconBtn: { width: 28, height: 28, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  subRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 8, borderRadius: 8, borderWidth: 1 },
  subTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  subMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  empty: { padding: 16, borderRadius: 10, alignItems: "center" },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  roleChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  roleChipText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  hint: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 12 },
  dateBox: { width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  dateBoxDay: { fontSize: 16, fontFamily: "Inter_700Bold" },
  dateBoxMo: { fontSize: 9, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
});
