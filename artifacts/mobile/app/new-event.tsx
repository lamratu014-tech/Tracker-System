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

function dateFromOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function toIso(date: string, time: string, addHours = 0): string {
  const d = new Date(`${date}T${time}:00`);
  if (addHours) d.setHours(d.getHours() + addHours);
  return d.toISOString();
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
  const [date, setDate] = useState<string>(dateFromOffset(1));
  const [time, setTime] = useState<string>("10:00");
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

  function save() {
    if (!title.trim()) return Alert.alert("Title required", "Please enter an event title.");
    if (!date) return Alert.alert("Date required", "Pick a date.");
    if (!time) return Alert.alert("Time required", "Pick a time.");
    if (me!.role !== "admin" && !linkedTeamId) {
      return Alert.alert("Team required", "Pick a team for this event.");
    }
    const startDate = toIso(date, time, 0);
    const endDate = toIso(date, time, 1);
    createEvent.mutate({
      data: {
        title: title.trim(),
        sharedDescription: desc.trim(),
        startDate,
        endDate,
        invitedTeamIds: linkedTeamId ? [linkedTeamId] : [],
      },
    });
  }

  const dateLabel = new Date(`${date}T${time}:00`).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

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

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Date * — {dateLabel}</Text>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {DAY_OFFSETS.map((o) => {
          const v = dateFromOffset(o.days);
          const active = date === v;
          return (
            <TouchableOpacity
              key={o.label}
              style={[styles.chip, { borderColor: colors.border, backgroundColor: active ? colors.primary : colors.muted }]}
              onPress={() => setDate(v)}
            >
              <Text style={[styles.chipText, { color: active ? "#fff" : colors.foreground }]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Time *</Text>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
        {TIME_OPTIONS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: time === t ? colors.primary : colors.muted }]}
            onPress={() => setTime(t)}
          >
            <Text style={[styles.chipText, { color: time === t ? "#fff" : colors.foreground }]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

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
          style={[styles.btn, { backgroundColor: title.trim() && date && time ? colors.primary : colors.border }]}
          onPress={save}
          disabled={!title.trim() || !date || !time || createEvent.isPending}
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
  btn: { flex: 1, padding: 14, borderRadius: 10, alignItems: "center" },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
