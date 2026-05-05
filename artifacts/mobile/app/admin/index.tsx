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

type AdminTab = "structure" | "users" | "members" | "events";

const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  stream_overseer: "Overseer",
  leader: "Leader",
};

const ROLE_COLOR: Record<Role, string> = {
  admin: "#7C3AED",
  stream_overseer: "#0EA5E9",
  leader: "#2563EB",
};

const ROLE_CYCLE: Role[] = ["admin", "stream_overseer", "leader"];

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
  const members = useStore((s) => s.members);
  const streams = useStore((s) => s.streams);
  const events = useStore((s) => s.events);
  const updateUser = useStore((s) => s.updateUser);
  const deleteUser = useStore((s) => s.deleteUser);
  const deleteStream = useStore((s) => s.deleteStream);
  const deleteTeam = useStore((s) => s.deleteTeam);
  const deleteEvent = useStore((s) => s.deleteEvent);
  const deleteMember = useStore((s) => s.deleteMember);

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

  function streamLabel(streamId: string | null): string {
    if (!streamId) return "—";
    return streams.find((s) => s.id === streamId)?.name ?? "—";
  }

  function changeRole(userId: string, currentRole: Role) {
    const u = users.find((x) => x.id === userId);
    if (!u) return;
    const idx = ROLE_CYCLE.indexOf(currentRole);
    const next = ROLE_CYCLE[(idx + 1) % ROLE_CYCLE.length];
    if (next === "stream_overseer" && !u.streamId) {
      Alert.alert(
        "Stream required",
        "Assign this user to a stream first (re-invite them with a stream) before making them an Overseer.",
      );
      return;
    }
    if (next === "leader" && !u.teamId) {
      Alert.alert(
        "Team required",
        "Assign this user to a team first (re-invite them with a team) before making them a Leader.",
      );
      return;
    }
    updateUser(userId, { role: next });
  }

  function copyCode(code: string) {
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(code).catch(() => undefined);
      } else {
        Alert.alert("Invite code", code);
      }
    } catch {
      // ignore
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {(["structure", "users", "members", "events"] as AdminTab[]).map((t) => (
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
      </ScrollView>

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
                <Text style={[styles.smallBtnText, { color: "#fff" }]}>Invite</Text>
              </TouchableOpacity>
            </View>
            {users.map((u) => {
              const scope =
                u.role === "admin"
                  ? "All streams"
                  : u.role === "stream_overseer"
                    ? streamLabel(u.streamId)
                    : teamLabel(u.teamId);
              return (
                <View key={u.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={[styles.avatar, { backgroundColor: ROLE_COLOR[u.role] + "22" }]}>
                      <Text style={[styles.avatarText, { color: ROLE_COLOR[u.role] }]}>
                        {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                        {u.name} {me?.id === u.id ? <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>(you)</Text> : null}
                      </Text>
                      <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {u.email} · {scope}
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
                  {!u.active && u.inviteCode ? (
                    <TouchableOpacity
                      style={[styles.codeRow, { backgroundColor: colors.muted, borderColor: colors.border }]}
                      onPress={() => copyCode(u.inviteCode!)}
                      activeOpacity={0.7}
                    >
                      <Feather name="key" size={12} color={colors.primary} />
                      <Text style={[styles.codeLabel, { color: colors.mutedForeground }]}>Invite code</Text>
                      <Text style={[styles.codeText, { color: colors.foreground }]}>{u.inviteCode}</Text>
                      <Feather name="copy" size={12} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Tap the role chip to cycle: Admin → Overseer → Leader.
            </Text>
          </>
        ) : null}

        {tab === "members" ? (
          <>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Members ({members.length})</Text>
              <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                Add via team page
              </Text>
            </View>
            {members.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.muted }]}>
                <Text style={{ color: colors.mutedForeground }}>No members yet.</Text>
              </View>
            ) : (
              members.map((m) => (
                <View
                  key={m.id}
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: 10 }]}
                >
                  <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                      {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]}>{m.name}</Text>
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {teamLabel(m.teamId)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => router.push({ pathname: "/team/[id]", params: { id: m.teamId } })}
                  >
                    <Feather name="external-link" size={14} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => confirm(`Remove "${m.name}"?`, () => deleteMember(m.id))}
                  >
                    <Feather name="trash-2" size={14} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              ))
            )}
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Members are roster entries — they don't log in.
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
  tabs: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { paddingVertical: 12, paddingHorizontal: 18, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  smallBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  card: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8, overflow: "hidden", gap: 8 },
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
  codeRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1,
  },
  codeLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  codeText: { flex: 1, fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: 2 },
});
