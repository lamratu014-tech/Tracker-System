import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  getListEventsQueryKey,
  useCreateEvent,
  useListTeams,
} from "@workspace/api-client-react";
import React, { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { ErrorBanner } from "@/components/ErrorBanner";
import { useColors } from "@/hooks/useColors";
import { useMe } from "@/lib/permissions";

const TIME_OPTIONS = ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00"];

const DAY_OFFSETS = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "+3 days", days: 3 },
  { label: "+1 wk", days: 7 },
  { label: "+2 wks", days: 14 },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function dateFromOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month1: number): number {
  // month1 is 1-12. new Date(year, month, 0) returns the last day of the
  // previous month, so passing month1 gives us the last day of month1.
  return new Date(year, month1, 0).getDate();
}

function parseDateTime(date: string, time: string): Date | null {
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return null;
  const [yStr, moStr, dStr] = date.split("-");
  const [hStr, miStr] = time.split(":");
  const y = Number(yStr);
  const mo = Number(moStr);
  const d = Number(dStr);
  const h = Number(hStr);
  const mi = Number(miStr);
  if (!Number.isFinite(y) || y < 1970 || y > 9999) return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > daysInMonth(y, mo)) return null;
  if (h < 0 || h > 23) return null;
  if (mi < 0 || mi > 59) return null;
  const out = new Date(y, mo - 1, d, h, mi, 0, 0);
  // Final sanity: re-read fields to confirm no normalization happened.
  if (
    out.getFullYear() !== y ||
    out.getMonth() !== mo - 1 ||
    out.getDate() !== d ||
    out.getHours() !== h ||
    out.getMinutes() !== mi
  ) {
    return null;
  }
  return out;
}

export default function NewEventScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();

  const teamsQ = useListTeams();
  const teams = teamsQ.data ?? [];

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const initialDate = dateFromOffset(1);
  const [startDate, setStartDate] = useState<string>(initialDate);
  const [startTime, setStartTime] = useState<string>("10:00");
  const [endDate, setEndDate] = useState<string>(initialDate);
  const [endTime, setEndTime] = useState<string>("11:00");
  const [linkedTeamId, setLinkedTeamId] = useState<string | null>(
    me?.role === "leader" && me.teamId ? me.teamId : null,
  );

  const allowedTeams = useMemo(() => {
    if (!me) return [];
    if (me.role === "admin") return teams;
    if (me.role === "stream_overseer") return teams.filter((t) => t.streamId === me.streamId);
    if (me.role === "leader" && me.teamId) return teams.filter((t) => t.id === me.teamId);
    return [];
  }, [teams, me]);

  const startDt = parseDateTime(startDate, startTime);
  const endDt = parseDateTime(endDate, endTime);
  const startValid = !!startDt;
  const endValid = !!endDt;
  const orderValid = !!(startDt && endDt && endDt.getTime() > startDt.getTime());
  const dateError =
    !startValid ? "Start date or time isn't valid (use YYYY-MM-DD and HH:MM)."
    : !endValid ? "End date or time isn't valid (use YYYY-MM-DD and HH:MM)."
    : !orderValid ? "End must be after start."
    : null;

  const createEvent = useCreateEvent({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListEventsQueryKey() });
        router.back();
      },
    },
  });

  if (!me) {
    return (
      <View style={[styles.gate, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>Sign in to create events.</Text>
      </View>
    );
  }

  const canSave =
    !!title.trim() &&
    !dateError &&
    (me.role === "admin" || !!linkedTeamId) &&
    !createEvent.isPending;

  function save() {
    if (!title.trim()) return Alert.alert("Title required", "Please enter an event title.");
    if (dateError) return Alert.alert("Invalid date or time", dateError);
    if (me!.role !== "admin" && !linkedTeamId) {
      return Alert.alert("Team required", "Pick a team for this event.");
    }
    if (!startDt || !endDt) return;
    createEvent.mutate({
      data: {
        title: title.trim(),
        sharedDescription: desc.trim(),
        startDate: startDt.toISOString(),
        endDate: endDt.toISOString(),
        invitedTeamIds: linkedTeamId ? [linkedTeamId] : [],
      },
    });
  }

  function applyDayOffset(days: number) {
    const v = dateFromOffset(days);
    setStartDate(v);
    setEndDate(v);
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>Title *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Quarterly review"
        placeholderTextColor={colors.mutedForeground}
        autoFocus
      />

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Description</Text>
      <TextInput
        style={[styles.input, styles.multi, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        value={desc}
        onChangeText={setDesc}
        placeholder="Optional details"
        placeholderTextColor={colors.mutedForeground}
        multiline
        numberOfLines={3}
      />

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Quick pick (start day)</Text>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {DAY_OFFSETS.map((o) => {
          const v = dateFromOffset(o.days);
          const active = startDate === v;
          return (
            <TouchableOpacity
              key={o.label}
              style={[styles.chip, { borderColor: colors.border, backgroundColor: active ? colors.primary : colors.muted }]}
              onPress={() => applyDayOffset(o.days)}
            >
              <Text style={[styles.chipText, { color: active ? "#fff" : colors.foreground }]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.row2}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Start date *</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.muted, color: colors.foreground, borderColor: startValid ? colors.border : colors.destructive },
            ]}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Start time *</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.muted, color: colors.foreground, borderColor: startValid ? colors.border : colors.destructive },
            ]}
            value={startTime}
            onChangeText={setStartTime}
            placeholder="HH:MM"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {TIME_OPTIONS.map((t) => (
          <TouchableOpacity
            key={`s-${t}`}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: startTime === t ? colors.primary : colors.muted }]}
            onPress={() => setStartTime(t)}
          >
            <Text style={[styles.chipText, { color: startTime === t ? "#fff" : colors.foreground }]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.row2}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>End date *</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.muted, color: colors.foreground, borderColor: endValid && orderValid ? colors.border : colors.destructive },
            ]}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>End time *</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.muted, color: colors.foreground, borderColor: endValid && orderValid ? colors.border : colors.destructive },
            ]}
            value={endTime}
            onChangeText={setEndTime}
            placeholder="HH:MM"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {TIME_OPTIONS.map((t) => (
          <TouchableOpacity
            key={`e-${t}`}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: endTime === t ? colors.primary : colors.muted }]}
            onPress={() => setEndTime(t)}
          >
            <Text style={[styles.chipText, { color: endTime === t ? "#fff" : colors.foreground }]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {dateError ? (
        <Text style={[styles.errorText, { color: colors.destructive }]}>{dateError}</Text>
      ) : null}

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Link to team</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {me.role === "admin" ? (
          <TouchableOpacity
            style={[styles.chip, { borderColor: colors.border, backgroundColor: linkedTeamId === null ? colors.primary : colors.muted }]}
            onPress={() => setLinkedTeamId(null)}
          >
            <Text style={[styles.chipText, { color: linkedTeamId === null ? "#fff" : colors.foreground }]}>Programme-wide</Text>
          </TouchableOpacity>
        ) : null}
        {allowedTeams.map((team) => (
          <TouchableOpacity
            key={team.id}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: linkedTeamId === team.id ? colors.primary : colors.muted }]}
            onPress={() => setLinkedTeamId(team.id)}
          >
            <Text style={[styles.chipText, { color: linkedTeamId === team.id ? "#fff" : colors.foreground }]}>
              {team.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {createEvent.isError ? <ErrorBanner error={createEvent.error} /> : null}

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.muted }]} onPress={() => router.back()}>
          <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: canSave ? colors.primary : colors.border }]}
          onPress={save}
          disabled={!canSave}
        >
          <Text style={[styles.btnText, { color: "#fff" }]}>Create Event</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 10 },
  gate: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 4 },
  input: { padding: 12, borderRadius: 10, borderWidth: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  multi: { minHeight: 80, textAlignVertical: "top" },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  row: { flexDirection: "row", gap: 8, marginTop: 16 },
  row2: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, padding: 14, borderRadius: 10, alignItems: "center" },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  errorText: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 4 },
});
