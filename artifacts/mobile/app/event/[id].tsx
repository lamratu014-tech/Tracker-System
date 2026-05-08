import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  getGetEventQueryKey,
  getListEventsQueryKey,
  useDeleteEvent,
  useGetEvent,
  useListProgrammes,
  useListStreams,
  useListTeams,
  useListUsers,
  useUpdateEvent,
} from "@workspace/api-client-react";
import React from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useDialog } from "@/components/Dialog";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingRow } from "@/components/LoadingRow";
import { useColors } from "@/hooks/useColors";
import {
  canManageEverything,
  canManageStream,
  canManageTeam,
  useMe,
} from "@/lib/permissions";
import { colorForStream } from "@/lib/streamColors";

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function EventDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const dialog = useDialog();

  const eventQ = useGetEvent(id ?? "", {
    query: { enabled: !!id, queryKey: getGetEventQueryKey(id ?? "") },
  });
  const event = eventQ.data ?? null;
  const teamsQ = useListTeams();
  const usersQ = useListUsers();
  const programmesQ = useListProgrammes();
  const streamsQ = useListStreams();
  const teams = teamsQ.data ?? [];
  const users = usersQ.data ?? [];
  const programmes = programmesQ.data ?? [];
  const streams = streamsQ.data ?? [];

  const deleteEvent = useDeleteEvent({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListEventsQueryKey() }) },
  });
  const updateEvent = useUpdateEvent({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListEventsQueryKey() });
        if (id) qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
      },
    },
  });

  const [editing, setEditing] = React.useState(false);
  const [draftTitle, setDraftTitle] = React.useState("");
  const [draftDesc, setDraftDesc] = React.useState("");
  const [draftLocation, setDraftLocation] = React.useState("");

  if (eventQ.isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <LoadingRow />
      </View>
    );
  }
  if (!event) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        {eventQ.isError ? (
          <ErrorBanner error={eventQ.error} onRetry={() => eventQ.refetch()} />
        ) : (
          <Text style={{ color: colors.mutedForeground }}>Event not found.</Text>
        )}
      </View>
    );
  }

  const teamId = event.invitedTeamIds[0] ?? event.createdByTeamId ?? null;
  const linkedTeam = teamId ? teams.find((t) => t.id === teamId) : null;
  const linkedStreamId = linkedTeam?.streamId ?? null;
  const accent = colorForStream(linkedStreamId);

  const isAdmin = canManageEverything(me);
  const isCreator = !!event.createdByUserId && me?.id === event.createdByUserId;
  const linkedStream = linkedStreamId ? streams.find((s) => s.id === linkedStreamId) : null;
  const overseerOfStream =
    !!linkedStream &&
    canManageStream(me, { id: linkedStream.id, programmeId: linkedStream.programmeId });
  const overseerOrLeaderOfTeam =
    !!linkedTeam &&
    canManageTeam(
      me,
      { id: linkedTeam.id, streamId: linkedTeam.streamId },
      linkedStream?.programmeId ?? null,
    );
  // For programme-linked events: programme overseers of the event's
  // programme, and stream overseers whose assigned stream sits inside the
  // event's programme, can also manage the event.
  const overseerOfProgramme = (() => {
    if (!event.programmeId || !me) return false;
    if (me.role === "programme_overseer") {
      return !!me.programmeId && me.programmeId === event.programmeId;
    }
    if (me.role === "stream_overseer" && me.streamId) {
      const myStream = streams.find((s) => s.id === me.streamId);
      return !!myStream && myStream.programmeId === event.programmeId;
    }
    return false;
  })();
  const canDelete =
    isAdmin || isCreator || overseerOfStream || overseerOrLeaderOfTeam || overseerOfProgramme;
  const canEdit = canDelete;

  function startEditing() {
    if (!event) return;
    setDraftTitle(event.title);
    setDraftDesc(event.sharedDescription ?? "");
    setDraftLocation(event.location ?? "");
    setEditing(true);
  }

  function saveEdits() {
    if (!event) return;
    const title = draftTitle.trim();
    if (!title) {
      Alert.alert("Title required", "Please enter a title for the event.");
      return;
    }
    updateEvent.mutate(
      {
        id: event.id,
        data: {
          title,
          sharedDescription: draftDesc.trim() || undefined,
          location: draftLocation.trim() || undefined,
        },
      },
      { onSuccess: () => setEditing(false) },
    );
  }

  // Three link modes: team-linked > programme-linked > org-wide.
  let linkedLabel = "Org-wide";
  if (linkedTeam) {
    linkedLabel = linkedTeam.name;
  } else if (event.programmeId) {
    const prog = programmes.find((p) => p.id === event.programmeId);
    linkedLabel = prog ? `Programme: ${prog.name}` : "Programme";
  }

  const creator = event.createdByUserId
    ? users.find((u) => u.id === event.createdByUserId)
    : null;
  const startDt = new Date(event.startDate);
  const endDt = new Date(event.endDate);
  const validStart = !isNaN(startDt.getTime());
  const validEnd = !isNaN(endDt.getTime());
  const multiDay = validStart && validEnd && !sameDay(startDt, endDt);
  const dateStr = validStart
    ? startDt.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "—";
  let timeStr: string;
  if (event.isAllDay) {
    timeStr = multiDay
      ? `All day · until ${endDt.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}`
      : "All day";
  } else if (validStart && validEnd) {
    const startTime = startDt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const endTime = endDt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (multiDay) {
      const endLabel = endDt.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
      timeStr = `${startTime} → ${endLabel}, ${endTime}`;
    } else {
      timeStr = `${startTime} – ${endTime}`;
    }
  } else {
    timeStr = "—";
  }

  async function confirmDelete() {
    if (!event) return;
    const ok = await dialog.confirm({
      title: "Delete event",
      message: `Delete event "${event.title}"?`,
      destructive: true,
      confirmText: "Delete",
    });
    if (ok) deleteEvent.mutate({ id: event.id }, { onSuccess: () => router.back() });
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View style={styles.titleRow}>
        <View style={[styles.streamSwatch, { backgroundColor: accent }]} />
        <Text style={[styles.title, { color: colors.foreground, flex: 1 }]}>{event.title}</Text>
      </View>

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderTopColor: accent,
            borderTopWidth: 3,
          },
        ]}
      >
        <View style={styles.line}>
          <Feather name="calendar" size={14} color={accent} />
          <Text style={[styles.lineText, { color: colors.foreground }]}>{dateStr}</Text>
        </View>
        <View style={styles.line}>
          <Feather name="clock" size={14} color={accent} />
          <Text style={[styles.lineText, { color: colors.foreground }]}>{timeStr}</Text>
        </View>
        <View style={styles.line}>
          <Feather name="link" size={14} color={accent} />
          <Text style={[styles.lineText, { color: colors.foreground }]}>{linkedLabel}</Text>
        </View>
        {event.location ? (
          <View style={styles.line}>
            <Feather name="map-pin" size={14} color={colors.primary} />
            <Text style={[styles.lineText, { color: colors.foreground }]}>{event.location}</Text>
          </View>
        ) : null}
        {creator ? (
          <View style={styles.line}>
            <Feather name="user" size={14} color={colors.primary} />
            <Text style={[styles.lineText, { color: colors.foreground }]}>Created by {creator.name}</Text>
          </View>
        ) : null}
      </View>

      {event.sharedDescription ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.heading, { color: colors.mutedForeground }]}>Description</Text>
          <Text style={[styles.body, { color: colors.foreground }]}>{event.sharedDescription}</Text>
        </View>
      ) : null}

      {canEdit ? (
        editing ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.heading, { color: colors.mutedForeground }]}>Edit event</Text>
            <TextInput
              value={draftTitle}
              onChangeText={setDraftTitle}
              placeholder="Title"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
            />
            <TextInput
              value={draftLocation}
              onChangeText={setDraftLocation}
              placeholder="Location (optional)"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
            />
            <TextInput
              value={draftDesc}
              onChangeText={setDraftDesc}
              placeholder="Description (optional)"
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[styles.input, styles.inputMulti, { color: colors.foreground, borderColor: colors.border }]}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: colors.muted, flex: 1 }]}
                onPress={() => setEditing(false)}
                disabled={updateEvent.isPending}
              >
                <Text style={[styles.deleteText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={saveEdits}
                disabled={updateEvent.isPending}
              >
                <Text style={[styles.deleteText, { color: "#fff" }]}>
                  {updateEvent.isPending ? "Saving…" : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
            {updateEvent.isError ? (
              <ErrorBanner error={updateEvent.error} />
            ) : null}
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity
              style={[styles.deleteBtn, { backgroundColor: colors.muted, flex: 1 }]}
              onPress={startEditing}
            >
              <Feather name="edit-2" size={14} color={colors.primary} />
              <Text style={[styles.deleteText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteBtn, { backgroundColor: "#FEE2E2", flex: 1 }]}
              onPress={confirmDelete}
            >
              <Feather name="trash-2" size={14} color="#DC2626" />
              <Text style={[styles.deleteText, { color: "#DC2626" }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        )
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  streamSwatch: { width: 6, height: 28, borderRadius: 3 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  card: { padding: 14, borderRadius: 10, borderWidth: 1, gap: 8 },
  line: { flexDirection: "row", alignItems: "center", gap: 8 },
  lineText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  heading: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  body: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 14, borderRadius: 10 },
  deleteText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  inputMulti: { minHeight: 80, textAlignVertical: "top" },
});
