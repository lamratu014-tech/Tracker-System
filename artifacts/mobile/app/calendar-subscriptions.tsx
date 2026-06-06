import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListCalendarSubscriptionsQueryKey,
  getListEventsQueryKey,
  useCreateCalendarSubscription,
  useDeleteCalendarSubscription,
  useListCalendarSubscriptions,
  useListProgrammes,
  useListStreams,
  useListTeams,
  useRefreshCalendarSubscription,
  type CalendarSubscription,
} from "@workspace/api-client-react";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDialog } from "@/components/Dialog";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingRow } from "@/components/LoadingRow";
import { useColors } from "@/hooks/useColors";
import { useMe } from "@/lib/permissions";
import { STREAM_COLOR_PALETTE } from "@/lib/streamColors";

const COLOR_NAMES: Record<string, string> = {
  "#2563EB": "Blue",
  "#9333EA": "Purple",
  "#DB2777": "Pink",
  "#DC2626": "Red",
  "#EA580C": "Orange",
  "#CA8A04": "Gold",
  "#16A34A": "Green",
  "#0D9488": "Teal",
  "#0284C7": "Sky",
  "#7C3AED": "Violet",
};

type ScopePick =
  | { kind: "org" }
  | { kind: "programme"; id: string }
  | { kind: "team"; id: string };

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "never";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function CalendarSubscriptionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const me = useMe();
  const dialog = useDialog();
  const qc = useQueryClient();

  const subsQ = useListCalendarSubscriptions();
  const programmesQ = useListProgrammes();
  const streamsQ = useListStreams();
  const teamsQ = useListTeams();

  const subscriptions = subsQ.data ?? [];
  const programmes = programmesQ.data ?? [];
  const streams = streamsQ.data ?? [];
  const teams = teamsQ.data ?? [];

  function invalidate() {
    qc.invalidateQueries({ queryKey: getListCalendarSubscriptionsQueryKey() });
    qc.invalidateQueries({ queryKey: getListEventsQueryKey() });
  }

  const createSub = useCreateCalendarSubscription({
    mutation: { onSuccess: invalidate },
  });
  const refreshSub = useRefreshCalendarSubscription({
    mutation: { onSuccess: invalidate },
  });
  const deleteSub = useDeleteCalendarSubscription({
    mutation: { onSuccess: invalidate },
  });

  const [busyId, setBusyId] = React.useState<string | null>(null);

  function scopeLabel(sub: CalendarSubscription): string {
    if (sub.teamId) {
      const t = teams.find((x) => x.id === sub.teamId);
      const s = t ? streams.find((x) => x.id === t.streamId) : null;
      if (t) return s ? `${s.name} · ${t.name}` : `Team: ${t.name}`;
      return "Team";
    }
    if (sub.programmeId) {
      const p = programmes.find((x) => x.id === sub.programmeId);
      return p ? `Programme: ${p.name}` : "Programme";
    }
    return "Org-wide";
  }

  async function startCreate() {
    const name = (
      await dialog.prompt({
        title: "New calendar subscription",
        message: "Give this feed a name (e.g. “UK Holidays”).",
        placeholder: "Subscription name",
        confirmText: "Next",
        autoCapitalize: "sentences",
      })
    )?.trim();
    if (!name) return;

    const feedUrl = (
      await dialog.prompt({
        title: "Feed URL",
        message: "Paste a public iCal/.ics link (https:// or webcal://).",
        placeholder: "https://example.com/calendar.ics",
        confirmText: "Next",
        autoCapitalize: "none",
      })
    )?.trim();
    if (!feedUrl) return;

    // Scope: org-wide + each programme + each team the user can see.
    const scopeOptions: { label: string; value: ScopePick }[] = [
      { label: "Org-wide (everyone)", value: { kind: "org" } },
      ...programmes.map((p) => ({
        label: `Programme · ${p.name}`,
        value: { kind: "programme" as const, id: p.id },
      })),
      ...teams.map((t) => {
        const s = streams.find((x) => x.id === t.streamId);
        return {
          label: `Team · ${s ? `${s.name} / ${t.name}` : t.name}`,
          value: { kind: "team" as const, id: t.id },
        };
      }),
    ];
    const scope = await dialog.choice<ScopePick>({
      title: "Scope",
      message: "Who should see events from this feed?",
      options: scopeOptions,
      searchable: true,
      searchPlaceholder: "Search scopes",
    });
    if (!scope) return;

    const color = await dialog.choice<string>({
      title: "Colour",
      message: "Pick a colour for imported events.",
      options: STREAM_COLOR_PALETTE.map((c) => ({
        label: COLOR_NAMES[c] ?? c,
        value: c,
      })),
    });
    if (!color) return;

    createSub.mutate({
      data: {
        name,
        feedUrl,
        color,
        programmeId: scope.kind === "programme" ? scope.id : null,
        teamId: scope.kind === "team" ? scope.id : null,
      },
    });
  }

  async function onRefresh(sub: CalendarSubscription) {
    setBusyId(sub.id);
    refreshSub.mutate(
      { id: sub.id },
      { onSettled: () => setBusyId(null) },
    );
  }

  async function onDelete(sub: CalendarSubscription) {
    const ok = await dialog.confirm({
      title: "Remove subscription",
      message: `Remove “${sub.name}”? All events imported from this feed will be deleted.`,
      destructive: true,
      confirmText: "Remove",
    });
    if (!ok) return;
    setBusyId(sub.id);
    deleteSub.mutate({ id: sub.id }, { onSettled: () => setBusyId(null) });
  }

  if (!me) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 },
        ]}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Calendar subscriptions
            </Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Subscribe to external iCal feeds. Imported events are read-only and
              re-sync automatically.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={startCreate}
          disabled={createSub.isPending}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={16} color="#fff" />
          <Text style={styles.addBtnText}>
            {createSub.isPending ? "Adding…" : "Add subscription"}
          </Text>
        </TouchableOpacity>

        {createSub.isError ? <ErrorBanner error={createSub.error} /> : null}

        {subsQ.isError ? (
          <ErrorBanner error={subsQ.error} onRetry={() => subsQ.refetch()} />
        ) : subsQ.isLoading ? (
          <LoadingRow />
        ) : subscriptions.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.muted }]}>
            <Feather name="calendar" size={24} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No subscriptions yet. Add a public calendar feed to pull its events
              into the calendar.
            </Text>
          </View>
        ) : (
          subscriptions.map((sub) => {
            const busy = busyId === sub.id;
            const statusColor =
              sub.lastSyncStatus === "ok"
                ? colors.success
                : sub.lastSyncStatus === "error"
                  ? colors.destructive
                  : colors.mutedForeground;
            return (
              <View
                key={sub.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderLeftColor: sub.color,
                    borderLeftWidth: 4,
                  },
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.swatch, { backgroundColor: sub.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.cardTitle, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {sub.name}
                    </Text>
                    <Text
                      style={[styles.cardMeta, { color: colors.mutedForeground }]}
                      numberOfLines={1}
                    >
                      {scopeLabel(sub)}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[styles.feedUrl, { color: colors.mutedForeground }]}
                  numberOfLines={1}
                >
                  {sub.feedUrl}
                </Text>

                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {sub.lastSyncStatus === "ok"
                      ? `Synced ${relativeTime(sub.lastSyncedAt)}`
                      : sub.lastSyncStatus === "error"
                        ? "Last sync failed"
                        : "Pending first sync"}
                  </Text>
                </View>
                {sub.lastSyncStatus === "error" && sub.lastSyncError ? (
                  <Text
                    style={[styles.errText, { color: colors.destructive }]}
                    numberOfLines={2}
                  >
                    {sub.lastSyncError}
                  </Text>
                ) : null}

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.muted }]}
                    onPress={() => onRefresh(sub)}
                    disabled={busy}
                    activeOpacity={0.8}
                  >
                    <Feather name="refresh-cw" size={14} color={colors.primary} />
                    <Text style={[styles.actionText, { color: colors.primary }]}>
                      {busy && refreshSub.isPending ? "Refreshing…" : "Refresh"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#FEE2E2" }]}
                    onPress={() => onDelete(sub)}
                    disabled={busy}
                    activeOpacity={0.8}
                  >
                    <Feather name="trash-2" size={14} color="#DC2626" />
                    <Text style={[styles.actionText, { color: "#DC2626" }]}>
                      Remove
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 12 },
  header: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 4 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4, lineHeight: 18 },
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, borderRadius: 10,
  },
  addBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  empty: { padding: 24, alignItems: "center", borderRadius: 10, gap: 8 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  card: { padding: 14, borderWidth: 1, borderRadius: 10, gap: 8 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  cardMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  feedUrl: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  errText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 8,
  },
  actionText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
