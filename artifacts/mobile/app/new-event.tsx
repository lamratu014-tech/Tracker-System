import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import {
  getListEventsQueryKey,
  useCreateEvent,
  useListProgrammes,
  useListStreams,
  useListTeams,
} from "@workspace/api-client-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { PickerSheet, type PickerSection } from "@/components/PickerSheet";
import { useColors } from "@/hooks/useColors";
import { useMe } from "@/lib/permissions";
import type { RecurrenceFreq } from "@/lib/recurrence";

const REPEAT_OPTIONS: { value: RecurrenceFreq; label: string }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function defaultTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

function parseDateTime(date: string, time: string): Date | null {
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return null;
  const [dStr, moStr, yStr] = date.split("/");
  const [hStr, miStr] = time.split(":");
  const y = Number(yStr);
  const mo = Number(moStr);
  const d = Number(dStr);
  const h = Number(hStr);
  const mi = Number(miStr);
  if (!Number.isFinite(y)) return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > daysInMonth(y, mo)) return null;
  if (h < 0 || h > 23) return null;
  if (mi < 0 || mi > 59) return null;
  const out = new Date(y, mo - 1, d, h, mi, 0, 0);
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

type Scope = "org" | "programme" | "team";

export default function NewEventScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();

  const teamsQ = useListTeams();
  const teams = teamsQ.data ?? [];
  const programmesQ = useListProgrammes();
  const programmes = programmesQ.data ?? [];
  const streamsQ = useListStreams();
  const streams = streamsQ.data ?? [];

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const initialDate = defaultTomorrow();
  const [startDate, setStartDate] = useState<string>(initialDate);
  const [startTime, setStartTime] = useState<string>("10:00");
  const [endDate, setEndDate] = useState<string>(initialDate);
  const [endTime, setEndTime] = useState<string>("11:00");
  const [recurrenceFreq, setRecurrenceFreq] = useState<RecurrenceFreq>("none");
  const [untilEnabled, setUntilEnabled] = useState(false);
  const [untilDate, setUntilDate] = useState<string>("");

  // Initial scope: leader → team; admin → org; everyone else picks "programme"
  // once data resolves (the role-based default effect below sets the right
  // scope/programme). Default to "programme" for non-admins so we don't briefly
  // surface a disallowed "org" scope.
  const [scope, setScope] = useState<Scope>(
    me?.role === "leader" ? "team" : me?.role === "admin" ? "org" : "programme",
  );
  const [programmeId, setProgrammeId] = useState<string | undefined>(undefined);
  const [teamId, setTeamId] = useState<string | undefined>(
    (me?.role === "leader" || me?.role === "team_admin")
      ? (me.leaderTeamIds?.[0] ?? me.teamAdminTeamIds?.[0])
      : undefined,
  );
  const [pickerOpen, setPickerOpen] = useState<null | "programme" | "team">(null);

  const allowedTeams = useMemo(() => {
    if (!me) return [];
    if (me.role === "admin") return teams;
    if (me.role === "programme_overseer" && me.programmeId) {
      // Teams whose stream sits inside the PO's programme.
      const programmeStreamIds = new Set(
        streams.filter((s) => s.programmeId === me.programmeId).map((s) => s.id),
      );
      return teams.filter((t) => t.streamId && programmeStreamIds.has(t.streamId));
    }
    if (me.role === "stream_overseer") return teams.filter((t) => t.streamId === me.streamId);
    if (me.role === "leader" || me.role === "team_admin") {
      const managed = new Set([...(me.leaderTeamIds ?? []), ...(me.teamAdminTeamIds ?? [])]);
      return teams.filter((t) => managed.has(t.id));
    }
    return [];
  }, [teams, streams, me]);

  const allowedProgrammes = useMemo(() => {
    if (!me) return [];
    if (me.role === "admin") return programmes;
    if (me.role === "programme_overseer" && me.programmeId) {
      return programmes.filter((p) => p.id === me.programmeId);
    }
    if (me.role === "stream_overseer" && me.streamId) {
      const myStream = streams.find((s) => s.id === me.streamId);
      if (!myStream) return [];
      return programmes.filter((p) => p.id === myStream.programmeId);
    }
    return [];
  }, [programmes, streams, me]);

  const allowedScopes: Scope[] = useMemo(() => {
    if (!me) return [];
    const scopes: Scope[] = [];
    // Org-wide events are admin-only by server policy.
    if (me.role === "admin") scopes.push("org");
    if (
      (me.role === "admin" ||
        me.role === "programme_overseer" ||
        me.role === "stream_overseer") &&
      allowedProgrammes.length > 0
    ) {
      scopes.push("programme");
    }
    if (allowedTeams.length > 0) scopes.push("team");
    return scopes;
  }, [me, allowedProgrammes, allowedTeams]);

  // One-shot role-based defaults applied as soon as `me` resolves
  // (useMe() returns null on first render). Won't overwrite later user
  // interaction because we set the ref the first time we run.
  const didDefault = useRef(false);
  useEffect(() => {
    if (didDefault.current) return;
    if (!me) return;
    const myFirstTeam = me.leaderTeamIds?.[0] ?? me.teamAdminTeamIds?.[0] ?? null;
    if ((me.role === "leader" || me.role === "team_admin") && myFirstTeam) {
      didDefault.current = true;
      setScope("team");
      setTeamId(myFirstTeam);
      return;
    }
    if (me.role === "programme_overseer" && me.programmeId) {
      const prog = programmes.find((p) => p.id === me.programmeId);
      if (!prog) return;
      didDefault.current = true;
      setScope("programme");
      setProgrammeId(prog.id);
      return;
    }
    if (me.role === "stream_overseer" && me.streamId) {
      const myStream = streams.find((s) => s.id === me.streamId);
      if (!myStream) return;
      const prog = programmes.find((p) => p.id === myStream.programmeId);
      if (!prog) return;
      didDefault.current = true;
      setScope("programme");
      setProgrammeId(prog.id);
      return;
    }
    if (me.role === "admin") {
      // Admin's initial useState already gave us "org" — just lock it in.
      didDefault.current = true;
    }
  }, [me, streams, programmes]);

  // Auto-pick the only available item when a scope has exactly one option.
  useEffect(() => {
    if (scope === "programme" && allowedProgrammes.length === 1 && !programmeId) {
      setProgrammeId(allowedProgrammes[0].id);
    }
    if (scope === "team" && allowedTeams.length === 1 && !teamId) {
      setTeamId(allowedTeams[0].id);
    }
  }, [scope, allowedProgrammes, allowedTeams, programmeId, teamId]);

  function changeScope(next: Scope) {
    if (next === scope) return;
    setScope(next);
    // Clear the prior choice; auto-pick effect will fill in the only option.
    if (next !== "programme") setProgrammeId(undefined);
    if (next !== "team") setTeamId(undefined);
  }

  // Build picker sections.
  const programmeSections: PickerSection[] = useMemo(() => {
    const sorted = [...allowedProgrammes].sort((a, b) => a.name.localeCompare(b.name));
    const streamCountFor = (pid: string) =>
      streams.filter((s) => s.programmeId === pid).length;
    return [
      {
        items: sorted.map((p) => {
          const n = streamCountFor(p.id);
          return {
            id: p.id,
            label: p.name,
            sublabel: `${n} ${n === 1 ? "stream" : "streams"}`,
          };
        }),
      },
    ];
  }, [allowedProgrammes, streams]);

  const teamSections: PickerSection[] = useMemo(() => {
    // Group teams by their stream. Teams with no stream go in "Unassigned".
    const programmeName = (pid: string | null | undefined) =>
      pid ? programmes.find((p) => p.id === pid)?.name ?? "Unknown programme" : null;

    type Group = { streamName: string; programmeName: string | null; items: typeof allowedTeams };
    const groups = new Map<string, Group>();
    for (const team of allowedTeams) {
      const sid = team.streamId ?? "__none__";
      if (!groups.has(sid)) {
        if (sid === "__none__") {
          groups.set(sid, { streamName: "Unassigned", programmeName: null, items: [] });
        } else {
          const stream = streams.find((s) => s.id === sid);
          groups.set(sid, {
            streamName: stream?.name ?? "Unknown stream",
            programmeName: programmeName(stream?.programmeId),
            items: [],
          });
        }
      }
      groups.get(sid)!.items.push(team);
    }
    const sortedGroups = [...groups.values()].sort((a, b) =>
      a.streamName.localeCompare(b.streamName),
    );
    return sortedGroups.map((g) => ({
      header: g.programmeName ? `${g.streamName} · ${g.programmeName}` : g.streamName,
      items: [...g.items]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((t) => {
          const stream = t.streamId ? streams.find((s) => s.id === t.streamId) : null;
          const prog = stream ? programmeName(stream.programmeId) : null;
          const sub =
            stream && prog ? `${stream.name} · ${prog}` : stream ? stream.name : "Unassigned";
          return { id: t.id, label: t.name, sublabel: sub };
        }),
    }));
  }, [allowedTeams, streams, programmes]);

  const startDt = parseDateTime(startDate, startTime);
  const endDt = parseDateTime(endDate, endTime);
  const startValid = !!startDt;
  const endValid = !!endDt;
  const orderValid = !!(startDt && endDt && endDt.getTime() > startDt.getTime());
  const MAX_SPAN_MS = 7 * 24 * 60 * 60 * 1000;
  const durationValid = !!(
    startDt &&
    endDt &&
    orderValid &&
    endDt.getTime() - startDt.getTime() <= MAX_SPAN_MS
  );
  const dateError =
    !startValid ? "Start date or time isn't valid (use DD/MM/YYYY and HH:MM)."
    : !endValid ? "End date or time isn't valid (use DD/MM/YYYY and HH:MM)."
    : !orderValid ? "End must be after start."
    : !durationValid ? "Events can span at most 7 days."
    : null;

  // Recurrence end date: parsed as the end of that day so the "until" is
  // inclusive. Only relevant when the event repeats and an end is enabled.
  const showRecurrence = recurrenceFreq !== "none";
  const untilDt = untilEnabled ? parseDateTime(untilDate, "23:59") : null;
  const recurrenceError =
    showRecurrence && untilEnabled
      ? !untilDt
        ? "Repeat-until date isn't valid (use DD/MM/YYYY)."
        : startDt && untilDt.getTime() < startDt.getTime()
          ? "Repeat-until date can't be before the start date."
          : null
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

  const linkValid =
    (scope === "org" && me.role === "admin") ||
    (scope === "programme" && !!programmeId && allowedProgrammes.some((p) => p.id === programmeId)) ||
    (scope === "team" && !!teamId && allowedTeams.some((t) => t.id === teamId));

  const canSave =
    !!title.trim() && !dateError && !recurrenceError && linkValid && !createEvent.isPending;

  function save() {
    if (!title.trim()) return Alert.alert("Title required", "Please enter an event title.");
    if (dateError) return Alert.alert("Invalid date or time", dateError);
    if (recurrenceError) return Alert.alert("Invalid repeat", recurrenceError);
    if (!linkValid) {
      return Alert.alert(
        "Pick a link",
        scope === "programme"
          ? "Choose a programme."
          : scope === "team"
            ? "Choose a team."
            : "Choose org-wide, a programme, or a team.",
      );
    }
    if (!startDt || !endDt) return;
    createEvent.mutate({
      data: {
        title: title.trim(),
        sharedDescription: desc.trim(),
        startDate: startDt.toISOString(),
        endDate: endDt.toISOString(),
        recurrenceFreq,
        recurrenceUntil:
          showRecurrence && untilEnabled && untilDt ? untilDt.toISOString() : null,
        invitedTeamIds: scope === "team" && teamId ? [teamId] : [],
        programmeId: scope === "programme" && programmeId ? programmeId : null,
      },
    });
  }

  const selectedProgramme = programmeId
    ? allowedProgrammes.find((p) => p.id === programmeId)
    : null;
  const selectedTeam = teamId ? allowedTeams.find((t) => t.id === teamId) : null;

  const programmeLocked = allowedProgrammes.length <= 1;
  const teamLocked = allowedTeams.length <= 1;

  function scopeLabel(s: Scope) {
    return s === "org" ? "Org-wide" : s === "programme" ? "Programme" : "Team";
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
            placeholder="DD/MM/YYYY"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
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
            keyboardType="numbers-and-punctuation"
          />
        </View>
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
            placeholder="DD/MM/YYYY"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
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
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>

      {dateError ? (
        <Text style={[styles.errorText, { color: colors.destructive }]}>{dateError}</Text>
      ) : null}

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Repeat</Text>
      <View style={styles.chipWrap}>
        {REPEAT_OPTIONS.map((opt) => {
          const active = recurrenceFreq === opt.value;
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
                setRecurrenceFreq(opt.value);
                if (opt.value === "none") setUntilEnabled(false);
              }}
            >
              <Text style={[styles.chipText, { color: active ? "#fff" : colors.foreground }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {showRecurrence ? (
        <>
          <TouchableOpacity
            style={styles.untilToggle}
            onPress={() => setUntilEnabled((v) => !v)}
            activeOpacity={0.7}
          >
            <Feather
              name={untilEnabled ? "check-square" : "square"}
              size={18}
              color={untilEnabled ? colors.primary : colors.mutedForeground}
            />
            <Text style={[styles.untilToggleText, { color: colors.foreground }]}>
              End on a date
            </Text>
          </TouchableOpacity>
          {untilEnabled ? (
            <>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.muted,
                    color: colors.foreground,
                    borderColor: recurrenceError ? colors.destructive : colors.border,
                  },
                ]}
                value={untilDate}
                onChangeText={setUntilDate}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numbers-and-punctuation"
              />
              {recurrenceError ? (
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  {recurrenceError}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={[styles.caption, { color: colors.mutedForeground }]}>
              Repeats with no end date.
            </Text>
          )}
        </>
      ) : null}

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Link this event to</Text>
      <View style={styles.scopeRow}>
        {allowedScopes.map((s) => {
          const active = scope === s;
          return (
            <TouchableOpacity
              key={s}
              style={[
                styles.chip,
                {
                  borderColor: colors.border,
                  backgroundColor: active ? colors.primary : colors.muted,
                },
              ]}
              onPress={() => changeScope(s)}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: active ? "#fff" : colors.foreground },
                ]}
              >
                {scopeLabel(s)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {scope === "org" ? (
        <Text style={[styles.caption, { color: colors.mutedForeground }]}>
          Visible to everyone in the organisation.
        </Text>
      ) : null}

      {scope === "programme" ? (
        <>
          <TouchableOpacity
            style={[
              styles.trigger,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                opacity: programmeLocked ? 0.7 : 1,
              },
            ]}
            onPress={() => {
              if (!programmeLocked) setPickerOpen("programme");
            }}
            disabled={programmeLocked}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.triggerText,
                  {
                    color: selectedProgramme ? colors.foreground : colors.mutedForeground,
                  },
                ]}
              >
                {selectedProgramme ? selectedProgramme.name : "Tap to choose a programme…"}
              </Text>
            </View>
            {!programmeLocked ? (
              <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
            ) : null}
          </TouchableOpacity>
          {programmeLocked && allowedProgrammes.length === 1 ? (
            <Text style={[styles.caption, { color: colors.mutedForeground }]}>
              Only one programme available.
            </Text>
          ) : null}
          {programmeLocked && allowedProgrammes.length === 0 ? (
            <Text style={[styles.caption, { color: colors.destructive }]}>
              No programmes available to you.
            </Text>
          ) : null}
        </>
      ) : null}

      {scope === "team" ? (
        <>
          <TouchableOpacity
            style={[
              styles.trigger,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                opacity: teamLocked ? 0.7 : 1,
              },
            ]}
            onPress={() => {
              if (!teamLocked) setPickerOpen("team");
            }}
            disabled={teamLocked}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.triggerText,
                  { color: selectedTeam ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {selectedTeam ? selectedTeam.name : "Tap to choose a team…"}
              </Text>
              {selectedTeam?.streamId ? (
                <Text style={[styles.triggerSub, { color: colors.mutedForeground }]}>
                  {(() => {
                    const stream = streams.find((s) => s.id === selectedTeam.streamId);
                    if (!stream) return "";
                    const prog = programmes.find((p) => p.id === stream.programmeId);
                    return prog ? `${stream.name} · ${prog.name}` : stream.name;
                  })()}
                </Text>
              ) : null}
            </View>
            {!teamLocked ? (
              <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
            ) : null}
          </TouchableOpacity>
          {teamLocked && allowedTeams.length === 1 ? (
            <Text style={[styles.caption, { color: colors.mutedForeground }]}>
              Only one team available.
            </Text>
          ) : null}
          {teamLocked && allowedTeams.length === 0 ? (
            <Text style={[styles.caption, { color: colors.destructive }]}>
              No teams available to you.
            </Text>
          ) : null}
        </>
      ) : null}

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

      <PickerSheet
        visible={pickerOpen === "programme"}
        onClose={() => setPickerOpen(null)}
        title="Choose a programme"
        sections={programmeSections}
        selectedId={programmeId}
        onSelect={(id) => setProgrammeId(id)}
        searchPlaceholder="Search programmes…"
      />
      <PickerSheet
        visible={pickerOpen === "team"}
        onClose={() => setPickerOpen(null)}
        title="Choose a team"
        sections={teamSections}
        selectedId={teamId}
        onSelect={(id) => setTeamId(id)}
        searchPlaceholder="Search teams or streams…"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 10 },
  gate: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 4 },
  input: { padding: 12, borderRadius: 10, borderWidth: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  multi: { minHeight: 80, textAlignVertical: "top" },
  scopeRow: { flexDirection: "row", gap: 6 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  untilToggle: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  untilToggleText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  caption: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  triggerText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  triggerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  row: { flexDirection: "row", gap: 8, marginTop: 16 },
  row2: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, padding: 14, borderRadius: 10, alignItems: "center" },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  errorText: { fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 4 },
});
