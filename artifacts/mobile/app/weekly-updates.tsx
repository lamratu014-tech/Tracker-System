import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetWeeklyUpdateStatusQueryKey,
  getListWeeklyUpdatesQueryKey,
  useGetWeeklyUpdateStatus,
  useListWeeklyUpdates,
  useSubmitWeeklyUpdate,
  type WeeklyUpdate,
} from "@workspace/api-client-react";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
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

// Monday (UTC, YYYY-MM-DD) of the week containing `d`. Mirrors the server's
// week boundary so the "current week" lines up with what the API stores.
function weekStartOf(d: Date): string {
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = date.getUTCDay();
  const shift = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + shift);
  return date.toISOString().slice(0, 10);
}

function formatWeek(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  return `${fmt(start)} – ${fmt(end)}, ${start.getUTCFullYear()}`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function WeeklyUpdatesScreen() {
  const colors = useColors();
  const me = useMe();
  const qc = useQueryClient();

  const canRead =
    me?.role === "admin" ||
    me?.role === "programme_overseer" ||
    me?.role === "stream_overseer";
  const isOverseer = me?.role === "stream_overseer";

  const updatesQ = useListWeeklyUpdates({
    query: {
      enabled: !!canRead,
      queryKey: getListWeeklyUpdatesQueryKey(),
    },
  });
  const statusQ = useGetWeeklyUpdateStatus({
    query: {
      enabled: !!canRead,
      queryKey: getGetWeeklyUpdateStatusQueryKey(),
    },
  });

  const updates = updatesQ.data ?? [];
  const status = statusQ.data ?? null;
  const currentWeek = weekStartOf(new Date());

  const submit = useSubmitWeeklyUpdate({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListWeeklyUpdatesQueryKey() });
        qc.invalidateQueries({ queryKey: getGetWeeklyUpdateStatusQueryKey() });
        setEditing(false);
      },
    },
  });

  // The signed-in overseer's own update for the current week (if any).
  const myCurrent = useMemo<WeeklyUpdate | null>(() => {
    if (!isOverseer || !me) return null;
    return (
      updates.find(
        (u) => u.authorId === me.id && u.weekStart === currentWeek,
      ) ?? null
    );
  }, [updates, me, isOverseer, currentWeek]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function startEditing() {
    setDraft(myCurrent?.body ?? "");
    setEditing(true);
  }

  function saveDraft() {
    const body = draft.trim();
    if (!body) return;
    submit.mutate({ data: { body } });
  }

  // History = the overseer's own past updates (exclude the current week, which
  // is shown in the composer card above).
  const myHistory = useMemo(() => {
    if (!isOverseer || !me) return [];
    return updates
      .filter((u) => u.authorId === me.id && u.weekStart !== currentWeek)
      .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
  }, [updates, me, isOverseer, currentWeek]);

  // Reader view (admin / PO): updates grouped by programme, then by week
  // (newest first), then by author. Programmes are alphabetical so it's easy
  // to find the section you're after.
  const grouped = useMemo(() => {
    const byProg = new Map<
      string,
      { programmeName: string; updates: WeeklyUpdate[] }
    >();
    for (const u of updates) {
      const key = u.programmeId ?? "__none__";
      if (!byProg.has(key)) {
        byProg.set(key, {
          programmeName: u.programmeName ?? "No programme",
          updates: [],
        });
      }
      byProg.get(key)!.updates.push(u);
    }
    return [...byProg.values()]
      .sort((a, b) => a.programmeName.localeCompare(b.programmeName))
      .map((prog) => {
        const byWeek = new Map<string, WeeklyUpdate[]>();
        for (const u of prog.updates) {
          if (!byWeek.has(u.weekStart)) byWeek.set(u.weekStart, []);
          byWeek.get(u.weekStart)!.push(u);
        }
        const weeks = [...byWeek.entries()]
          .sort((a, b) => (a[0] < b[0] ? 1 : -1))
          .map(([weekStart, items]) => ({
            weekStart,
            items: items.sort((a, b) =>
              (a.authorName ?? "").localeCompare(b.authorName ?? ""),
            ),
          }));
        return { programmeName: prog.programmeName, weeks };
      });
  }, [updates]);

  const notSubmitted = useMemo(
    () => (status?.overseers ?? []).filter((o) => !o.submitted),
    [status],
  );

  if (!me) return null;

  if (!canRead) {
    return (
      <View style={[styles.gate, { backgroundColor: colors.background }]}>
        <Feather name="lock" size={28} color={colors.mutedForeground} />
        <Text style={[styles.gateText, { color: colors.mutedForeground }]}>
          Weekly updates are only available to stream overseers, programme
          overseers, and admins.
        </Text>
      </View>
    );
  }

  const loading = updatesQ.isLoading || statusQ.isLoading;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      {isOverseer ? (
        <>
          <Text style={[styles.h1, { color: colors.foreground }]}>
            This week
          </Text>
          <Text style={[styles.weekLabel, { color: colors.mutedForeground }]}>
            {formatWeek(currentWeek)}
          </Text>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {editing ? (
              <>
                <TextInput
                  style={[
                    styles.input,
                    styles.multi,
                    {
                      backgroundColor: colors.muted,
                      color: colors.foreground,
                      borderColor: colors.border,
                    },
                  ]}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="What progressed, what's blocked, what's next…"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                />
                {submit.isError ? <ErrorBanner error={submit.error} /> : null}
                <View style={styles.row}>
                  <TouchableOpacity
                    style={[styles.btn, { backgroundColor: colors.muted }]}
                    onPress={() => setEditing(false)}
                    disabled={submit.isPending}
                  >
                    <Text style={[styles.btnText, { color: colors.foreground }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.btn,
                      {
                        backgroundColor:
                          draft.trim() && !submit.isPending
                            ? colors.primary
                            : colors.border,
                      },
                    ]}
                    onPress={saveDraft}
                    disabled={!draft.trim() || submit.isPending}
                  >
                    {submit.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={[styles.btnText, { color: "#fff" }]}>
                        {myCurrent ? "Save changes" : "Submit"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : myCurrent ? (
              <>
                <View style={styles.submittedRow}>
                  <Feather name="check-circle" size={16} color={colors.success} />
                  <Text style={[styles.submittedText, { color: colors.success }]}>
                    Submitted
                  </Text>
                  <Text
                    style={[styles.metaRight, { color: colors.mutedForeground }]}
                  >
                    Updated {formatTimestamp(myCurrent.updatedAt)}
                  </Text>
                </View>
                <Text style={[styles.body, { color: colors.foreground }]}>
                  {myCurrent.body}
                </Text>
                <TouchableOpacity
                  style={[styles.editBtn, { borderColor: colors.border }]}
                  onPress={startEditing}
                >
                  <Feather name="edit-2" size={14} color={colors.primary} />
                  <Text style={[styles.editText, { color: colors.primary }]}>
                    Edit
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text
                  style={[styles.emptyCard, { color: colors.mutedForeground }]}
                >
                  You haven't submitted an update for this week yet.
                </Text>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: colors.primary }]}
                  onPress={startEditing}
                >
                  <Text style={[styles.btnText, { color: "#fff" }]}>
                    Write update
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <Text style={[styles.h2, { color: colors.foreground }]}>
            Your history
          </Text>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 12 }} color={colors.primary} />
          ) : myHistory.length === 0 ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              No earlier updates yet.
            </Text>
          ) : (
            myHistory.map((u) => (
              <View
                key={u.id}
                style={[
                  styles.histCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.histWeek, { color: colors.mutedForeground }]}>
                  {formatWeek(u.weekStart)}
                </Text>
                <Text style={[styles.body, { color: colors.foreground }]}>
                  {u.body}
                </Text>
              </View>
            ))
          )}
        </>
      ) : (
        <>
          <Text style={[styles.h1, { color: colors.foreground }]}>
            Weekly updates
          </Text>
          <Text style={[styles.weekLabel, { color: colors.mutedForeground }]}>
            Confidential stream overseer reports
          </Text>

          {updatesQ.isError ? <ErrorBanner error={updatesQ.error} /> : null}

          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.h3, { color: colors.foreground }]}>
              Not yet submitted · {formatWeek(currentWeek)}
            </Text>
            {statusQ.isLoading ? (
              <ActivityIndicator
                style={{ marginTop: 8 }}
                color={colors.primary}
              />
            ) : notSubmitted.length === 0 ? (
              <View style={styles.submittedRow}>
                <Feather name="check-circle" size={16} color={colors.success} />
                <Text style={[styles.submittedText, { color: colors.success }]}>
                  Everyone in scope has submitted.
                </Text>
              </View>
            ) : (
              notSubmitted.map((o) => (
                <View key={o.userId} style={styles.missingRow}>
                  <Feather name="clock" size={14} color={colors.warning} />
                  <Text style={[styles.missingName, { color: colors.foreground }]}>
                    {o.name}
                  </Text>
                  <Text
                    style={[styles.missingStream, { color: colors.mutedForeground }]}
                  >
                    {o.streamName ?? ""}
                  </Text>
                </View>
              ))
            )}
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginTop: 12 }} color={colors.primary} />
          ) : grouped.length === 0 ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              No updates have been submitted yet.
            </Text>
          ) : (
            grouped.map((prog) => (
              <View key={prog.programmeName} style={{ marginTop: 8 }}>
                <View style={styles.progHeader}>
                  <Feather name="grid" size={14} color={colors.primary} />
                  <Text style={[styles.progTitle, { color: colors.primary }]}>
                    {prog.programmeName}
                  </Text>
                </View>
                {prog.weeks.map((g) => (
                  <View key={g.weekStart} style={{ marginTop: 4 }}>
                    <Text
                      style={[styles.weekHeading, { color: colors.mutedForeground }]}
                    >
                      {formatWeek(g.weekStart)}
                    </Text>
                    {g.items.map((u) => (
                      <View
                        key={u.id}
                        style={[
                          styles.histCard,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.author, { color: colors.foreground }]}
                        >
                          {u.authorName ?? "Unknown"}
                        </Text>
                        <Text
                          style={[styles.roleLabel, { color: colors.mutedForeground }]}
                        >
                          {u.streamName
                            ? `${u.streamName} Stream Overseer`
                            : "Stream Overseer"}
                        </Text>
                        <Text style={[styles.body, { color: colors.foreground }]}>
                          {u.body}
                        </Text>
                        <Text
                          style={[styles.metaRight, { color: colors.mutedForeground }]}
                        >
                          Updated {formatTimestamp(u.updatedAt)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 100, gap: 4 },
  gate: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  gateText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  h1: { fontSize: 24, fontFamily: "Inter_700Bold" },
  h2: { fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 20, marginBottom: 8 },
  h3: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  weekLabel: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 16 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, gap: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  multi: { minHeight: 120 },
  row: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, padding: 13, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  submittedRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  submittedText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  metaRight: { fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: "auto" },
  body: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
  },
  editText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  emptyCard: { fontSize: 14, fontFamily: "Inter_400Regular" },
  empty: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 12, textAlign: "center" },
  histCard: { padding: 14, borderRadius: 10, borderWidth: 1, gap: 4, marginBottom: 8 },
  histWeek: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  progHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16, marginBottom: 4 },
  progTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  weekHeading: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 8, marginBottom: 4 },
  author: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  roleLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  missingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  missingName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  missingStream: { fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: "auto" },
});
