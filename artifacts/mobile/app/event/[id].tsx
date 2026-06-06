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
import { recurrenceLabel, type RecurrenceFreq } from "@/lib/recurrence";
import { colorForStream } from "@/lib/streamColors";

const REPEAT_OPTIONS: { value: RecurrenceFreq; label: string }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toDdmmyyyy(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function parseUntil(date: string): Date | null {
  if (!DATE_RE.test(date)) return null;
  const [dStr, moStr, yStr] = date.split("/");
  const y = Number(yStr);
  const mo = Number(moStr);
  const d = Number(dStr);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const out = new Date(y, mo - 1, d, 23, 59, 59, 999);
  if (out.getFullYear() !== y || out.getMonth() !== mo - 1 || out.getDate() !== d) return null;
  return out;
}

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
  const [draftFreq, setDraftFreq] = React.useState<RecurrenceFreq>("none");
  const [draftUntilEnabled, setDraftUntilEnabled] = React.useState(false);
  const [draftUntil, setDraftUntil] = React.useState("");

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
    const freq = (event.recurrenceFreq ?? "none") as RecurrenceFreq;
    setDraftFreq(freq);
    setDraftUntilEnabled(freq !== "none" && !!event.recurrenceUntil);
    setDraftUntil(toDdmmyyyy(event.recurrenceUntil));
    setEditing(true);
  }

  function saveEdits() {
    if (!event) return;
    const title = draftTitle.trim();
    if (!title) {
      Alert.alert("Title required", "Please enter a title for the event.");
      return;
    }
    // Resolve the recurrence rule: "none" clears any until date; otherwise an
    // enabled until is parsed (inclusive end of day) and validated against the
    // event's start.
    let recurrenceUntil: string | null = null;
    if (draftFreq !== "none" && draftUntilEnabled) {
      const until = parseUntil(draftUntil);
      if (!until) {
        Alert.alert("Invalid repeat", "Repeat-until date isn't valid (use DD/MM/YYYY).");
        return;
      }
      if (until.getTime() < new Date(event.startDate).getTime()) {
        Alert.alert("Invalid repeat", "Repeat-until date can't be before the start date.");
        return;
      }
      recurrenceUntil = until.toISOString();
    }
    updateEvent.mutate(
      {
        id: event.id,
        data: {
          title,
          sharedDescription: draftDesc.trim() || undefined,
          location: draftLocation.trim() || undefined,
          recurrenceFreq: draftFreq,
          recurrenceUntil,
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
        {recurrenceLabel(event.recurrenceFreq, event.recurrenceUntil) ? (
          <View style={styles.line}>
            <Feather name="repeat" size={14} color={accent} />
            <Text style={[styles.lineText, { color: colors.foreground }]}>
              {recurrenceLabel(event.recurrenceFreq, event.recurrenceUntil)}
            </Text>
          </View>
        ) : null}
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

            <Text style={[styles.heading, { color: colors.mutedForeground }]}>Repeat</Text>
            <View style={styles.chipWrap}>
              {REPEAT_OPTIONS.map((opt) => {
                const active = draftFreq === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.chip,
                      {
                        borderColor: colors.border,
                        backgroundColor: active ? colors.primary : colors.muted,
                      },
                    ]}
                    onPress={() => {
                      setDraftFreq(opt.value);
                      if (opt.value === "none") setDraftUntilEnabled(false);
                    }}
                  >
                    <Text style={[styles.chipText, { color: active ? "#fff" : colors.foreground }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {draftFreq !== "none" ? (
              <>
                <TouchableOpacity
                  style={styles.untilToggle}
                  onPress={() => setDraftUntilEnabled((v) => !v)}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={draftUntilEnabled ? "check-square" : "square"}
                    size={18}
                    color={draftUntilEnabled ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={[styles.lineText, { color: colors.foreground }]}>End on a date</Text>
                </TouchableOpacity>
                {draftUntilEnabled ? (
                  <TextInput
                    value={draftUntil}
                    onChangeText={setDraftUntil}
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="numbers-and-punctuation"
                    style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                  />
                ) : null}
              </>
            ) : null}

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
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  untilToggle: { flexDirection: "row", alignItems: "center", gap: 8 },
});
