import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBadge } from "@/components/StatusBadge";
import type { CalendarEvent } from "@/context/DataContext";
import { useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUser, isAdmin } = useAuth();
  const { events, updateEvent, deleteEvent, getProjectById, teams } = useData();

  const event = events.find(e => e.id === id);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(event?.title ?? "");
  const [draftInternal, setDraftInternal] = useState(event?.internalDescription ?? "");
  const [draftShared, setDraftShared] = useState(event?.sharedDescription ?? "");
  const [draftLocation, setDraftLocation] = useState(event?.location ?? "");
  const [draftStatus, setDraftStatus] = useState<CalendarEvent["status"]>(event?.status ?? "pending");

  if (!event) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Event not found.</Text>
      </View>
    );
  }

  const project = event.projectId ? getProjectById(event.projectId) : undefined;
  const isFullView = event.visibility === "full";
  const canEdit = isAdmin || (isFullView && event.createdByTeamId === currentUser?.teamId);

  const creatorTeam = teams.find(t => t.id === event.createdByTeamId);
  const invitedTeams = teams.filter(t => event.invitedTeamIds.includes(t.id));

  function startEditing() {
    setDraftTitle(event!.title);
    setDraftInternal(event!.internalDescription ?? "");
    setDraftShared(event!.sharedDescription ?? "");
    setDraftLocation(event!.location);
    setDraftStatus(event!.status);
    setEditing(true);
  }

  async function save() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateEvent(id!, {
      title: draftTitle,
      internalDescription: draftInternal,
      sharedDescription: draftShared,
      location: draftLocation,
      status: draftStatus,
    });
    setEditing(false);
  }

  function handleDelete() {
    Alert.alert("Delete Event", "Are you sure you want to delete this event?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteEvent(event!.id);
          router.back();
        }
      },
    ]);
  }

  function cycleStatus() {
    if (!canEdit) return;
    const order: CalendarEvent["status"][] = ["pending", "approved", "rejected"];
    const next = order[(order.indexOf(draftStatus) + 1) % order.length];
    setDraftStatus(next);
  }

  const botPad = Platform.OS === "web" ? 34 : insets.bottom + 20;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.accentBar, { backgroundColor: event.color }]} />

      <ScrollView contentContainerStyle={{ paddingBottom: botPad }} showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          {/* Visibility badge */}
          {!isFullView && (
            <View style={[styles.sharedBanner, { backgroundColor: "#DBEAFE", borderColor: "#BFDBFE" }]}>
              <Feather name="globe" size={13} color="#2563EB" />
              <Text style={styles.sharedBannerText}>
                You can see this event because your team was invited. Only shared information is visible.
              </Text>
            </View>
          )}

          {/* Title */}
          {editing ? (
            <TextInput
              style={[styles.titleInput, { color: colors.foreground, borderBottomColor: colors.primary }]}
              value={draftTitle}
              onChangeText={setDraftTitle}
              autoFocus
            />
          ) : (
            <Text style={[styles.title, { color: colors.foreground }]}>{event.title}</Text>
          )}

          {/* Status + actions */}
          <View style={styles.row}>
            <TouchableOpacity onPress={editing ? cycleStatus : undefined} activeOpacity={canEdit ? 0.7 : 1}>
              <StatusBadge status={editing ? draftStatus : event.status} />
            </TouchableOpacity>
            <View style={styles.actions}>
              {editing ? (
                <>
                  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.muted }]} onPress={() => setEditing(false)} activeOpacity={0.7}>
                    <Feather name="x" size={18} color={colors.foreground} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.primary }]} onPress={save} activeOpacity={0.7}>
                    <Feather name="check" size={18} color="#fff" />
                  </TouchableOpacity>
                </>
              ) : canEdit ? (
                <>
                  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.muted }]} onPress={startEditing} activeOpacity={0.7}>
                    <Feather name="edit-2" size={18} color={colors.foreground} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.iconBtn, { backgroundColor: "#FEE2E2" }]} onPress={handleDelete} activeOpacity={0.7}>
                    <Feather name="trash-2" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          </View>

          {/* Details card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <DetailRow icon="calendar" label="Date">
              <Text style={[styles.detailVal, { color: colors.foreground }]}>
                {new Date(event.startDate).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </Text>
            </DetailRow>
            {!event.isAllDay && (
              <DetailRow icon="clock" label="Time">
                <Text style={[styles.detailVal, { color: colors.foreground }]}>
                  {new Date(event.startDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – {new Date(event.endDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </DetailRow>
            )}
            {(editing || event.location) && (
              <DetailRow icon="map-pin" label="Location">
                {editing ? (
                  <TextInput
                    style={[styles.inlineInput, { color: colors.foreground, borderBottomColor: colors.border }]}
                    value={draftLocation}
                    onChangeText={setDraftLocation}
                    placeholder="Add location"
                    placeholderTextColor={colors.mutedForeground}
                  />
                ) : (
                  <Text style={[styles.detailVal, { color: colors.foreground }]}>{event.location}</Text>
                )}
              </DetailRow>
            )}
            {project && (
              <DetailRow icon="briefcase" label="Project">
                <TouchableOpacity onPress={() => router.push({ pathname: "/project/[id]", params: { id: project.id } })} activeOpacity={0.7}>
                  <Text style={[styles.detailVal, { color: colors.primary }]}>{project.title}</Text>
                </TouchableOpacity>
              </DetailRow>
            )}
            {creatorTeam && (
              <DetailRow icon="users" label="Created by">
                <Text style={[styles.detailVal, { color: colors.foreground }]}>{creatorTeam.name}</Text>
              </DetailRow>
            )}
          </View>

          {/* Internal description — only visible to creator team + admin */}
          {isFullView && (
            <View style={styles.fieldBlock}>
              <View style={styles.descHeaderRow}>
                <Feather name="lock" size={12} color="#7C3AED" />
                <Text style={[styles.fieldLabel, { color: "#7C3AED" }]}>Internal Description</Text>
                <Text style={[styles.descHint, { color: colors.mutedForeground }]}>Private to your team</Text>
              </View>
              {editing ? (
                <TextInput
                  style={[styles.textarea, { color: colors.foreground, borderColor: "#7C3AED40", backgroundColor: colors.card }]}
                  value={draftInternal}
                  onChangeText={setDraftInternal}
                  multiline
                  numberOfLines={4}
                  placeholder="Internal notes..."
                  placeholderTextColor={colors.mutedForeground}
                />
              ) : (
                <Text style={[styles.bodyText, { color: event.internalDescription ? colors.foreground : colors.mutedForeground }]}>
                  {event.internalDescription || "No internal description"}
                </Text>
              )}
            </View>
          )}

          {/* Shared description — visible to all who have access */}
          <View style={styles.fieldBlock}>
            <View style={styles.descHeaderRow}>
              <Feather name="globe" size={12} color="#2563EB" />
              <Text style={[styles.fieldLabel, { color: "#2563EB" }]}>Shared Description</Text>
              <Text style={[styles.descHint, { color: colors.mutedForeground }]}>Visible to invited teams</Text>
            </View>
            {editing ? (
              <TextInput
                style={[styles.textarea, { color: colors.foreground, borderColor: "#2563EB40", backgroundColor: colors.card }]}
                value={draftShared}
                onChangeText={setDraftShared}
                multiline
                numberOfLines={4}
                placeholder="What invited teams will see..."
                placeholderTextColor={colors.mutedForeground}
              />
            ) : (
              <Text style={[styles.bodyText, { color: event.sharedDescription ? colors.foreground : colors.mutedForeground }]}>
                {event.sharedDescription || "No shared description"}
              </Text>
            )}
          </View>

          {/* Invited teams */}
          {invitedTeams.length > 0 && isFullView && (
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Invited Teams</Text>
              <View style={{ gap: 6 }}>
                {invitedTeams.map(t => (
                  <View key={t.id} style={[styles.teamPill, { backgroundColor: colors.muted }]}>
                    <Feather name="users" size={12} color={colors.primary} />
                    <Text style={[styles.teamPillText, { color: colors.foreground }]}>{t.name}</Text>
                    {t.functionLabel && <Text style={[styles.teamPillSub, { color: colors.mutedForeground }]}>{t.functionLabel}</Text>}
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={detailStyles.row}>
      <View style={detailStyles.iconCol}>
        <Feather name={icon as any} size={15} color={colors.mutedForeground} />
      </View>
      <Text style={[detailStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={detailStyles.val}>{children}</View>
    </View>
  );
}
const detailStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
  iconCol: { width: 20, alignItems: "center" },
  label: { width: 80, fontSize: 13, fontFamily: "Inter_500Medium" },
  val: { flex: 1 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  accentBar: { height: 4 },
  body: { padding: 20, gap: 16 },
  sharedBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, padding: 12 },
  sharedBannerText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#1D4ED8", lineHeight: 16 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", lineHeight: 28 },
  titleInput: { fontSize: 22, fontFamily: "Inter_700Bold", borderBottomWidth: 2, paddingBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actions: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  card: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  detailVal: { fontSize: 14, fontFamily: "Inter_400Regular" },
  inlineInput: { fontSize: 14, fontFamily: "Inter_400Regular", borderBottomWidth: 1, paddingBottom: 2 },
  fieldBlock: { gap: 6 },
  descHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  descHint: { fontSize: 10, fontFamily: "Inter_400Regular", marginLeft: "auto" as any },
  bodyText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  textarea: { borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 80, textAlignVertical: "top" },
  teamPill: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 10 },
  teamPillText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  teamPillSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
