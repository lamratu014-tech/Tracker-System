import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth/AuthContext";
import type { Role } from "@/models/types";
import {
  getListStreamTeamsQueryKey,
  useCreateInvite,
  useListStreams,
  useListStreamTeams,
} from "@workspace/api-client-react";

const ROLES: Role[] = ["admin", "stream_overseer", "leader"];
const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  stream_overseer: "Stream Overseer",
  leader: "Team Leader",
};
const ROLE_HINT: Record<Role, string> = {
  admin: "Full access to everything",
  stream_overseer: "Manages all teams within one stream",
  leader: "Manages a single team",
};

function describeError(err: unknown): string {
  const e = err as { status?: number; message?: string } | null;
  if (!e) return "Could not send invite. Please try again.";
  if (e.status === 401) return "Your session has expired. Please sign in again.";
  if (e.status === 403) return "You don't have permission to invite users.";
  if (e.status === 409) return "A user with this email already exists.";
  if (e.status === 400) return "Please double-check the form fields.";
  if (typeof e.status === "number" && e.status >= 500) {
    return "The server is unavailable. Please try again shortly.";
  }
  return e.message ?? "Could not send invite. Please try again.";
}

export default function NewUserScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user: me } = useAuth();
  const createInvite = useCreateInvite();
  // Source streams/teams from the API so the IDs we submit are the same
  // ones the server will validate against — invite scope IDs come from
  // server state, never from the local Zustand store.
  const streamsQuery = useListStreams();
  const serverStreams = streamsQuery.data ?? [];

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("leader");
  const [streamId, setStreamId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = me?.role === "admin";
  const isOverseer = me?.role === "stream_overseer";

  // Overseers are locked to their own stream and may only invite leaders
  // (or peer overseers) within it.
  const visibleRoles: Role[] = isAdmin
    ? ROLES
    : isOverseer
      ? (["stream_overseer", "leader"] as Role[])
      : [];

  const visibleStreams = useMemo(
    () =>
      isOverseer && me?.streamId
        ? serverStreams.filter((s) => s.id === me.streamId)
        : serverStreams,
    [isOverseer, me?.streamId, serverStreams],
  );

  // Teams for the leader-invite path are loaded per-stream from the API
  // once a stream is picked; this guarantees teamId originates from
  // server data and will pass server-side validation.
  const teamsQuery = useListStreamTeams(streamId ?? "", {
    query: {
      enabled: role === "leader" && !!streamId,
      queryKey: getListStreamTeamsQueryKey(streamId ?? ""),
    },
  });
  const streamTeams = teamsQuery.data ?? [];

  // Auto-pin overseer's stream so they can't accidentally pick a different one.
  React.useEffect(() => {
    if (isOverseer && me?.streamId && streamId !== me.streamId) {
      setStreamId(me.streamId);
    }
  }, [isOverseer, me?.streamId, streamId]);

  // If an overseer somehow lands on `admin` (e.g. stale state), bump them
  // back to a role they're allowed to invite.
  React.useEffect(() => {
    if (isOverseer && role === "admin") setRole("leader");
  }, [isOverseer, role]);

  if (!isAdmin && !isOverseer) {
    return (
      <View style={[styles.gate, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground }}>
          Only admins and stream overseers can invite users.
        </Text>
      </View>
    );
  }

  const submitting = createInvite.isPending;

  async function save() {
    setError(null);
    if (!name.trim()) return Alert.alert("Name required", "Please enter a name.");
    if (!email.trim() || !email.includes("@")) {
      return Alert.alert("Email required", "Please enter a valid email.");
    }
    if (role === "stream_overseer" && !streamId) {
      return Alert.alert("Stream required", "Pick a stream for this overseer.");
    }
    if (role === "leader" && !teamId) {
      return Alert.alert("Team required", "Pick a team for this leader.");
    }

    try {
      const res = await createInvite.mutateAsync({
        data: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role,
          streamId: role === "stream_overseer" ? streamId : null,
          teamId: role === "leader" ? teamId : null,
        },
      });
      setCreatedCode(res.code);
      setCreatedName(name.trim());
    } catch (err) {
      setError(describeError(err));
    }
  }

  function copyCode() {
    if (!createdCode) return;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(createdCode);
      Alert.alert("Copied", "Invite code copied to clipboard.");
    } else {
      Alert.alert("Invite code", createdCode);
    }
  }

  if (createdCode) {
    return (
      <View style={[styles.successWrap, { backgroundColor: colors.background }]}>
        <View style={[styles.successIcon, { backgroundColor: "#05966922" }]}>
          <Feather name="check" size={32} color="#059669" />
        </View>
        <Text style={[styles.successTitle, { color: colors.foreground }]}>{createdName} invited</Text>
        <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
          Share this invite code. They'll enter it on the accept-invite screen
          along with a password to activate their account.
        </Text>

        <View style={[styles.codeBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Text style={[styles.code, { color: colors.foreground }]}>{createdCode}</Text>
        </View>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1 }]}
          onPress={copyCode}
        >
          <Feather name="copy" size={14} color={colors.primary} />
          <Text style={[styles.btnText, { color: colors.primary, marginLeft: 6 }]}>Copy code</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary, marginTop: 8 }]}
          onPress={() => router.back()}
        >
          <Text style={[styles.btnText, { color: "#fff" }]}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>Full name *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        value={name}
        onChangeText={(v) => { setName(v); setError(null); }}
        placeholder="e.g. Sam Smith"
        placeholderTextColor={colors.mutedForeground}
        editable={!submitting}
        autoFocus
      />

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Work email *</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
        value={email}
        onChangeText={(v) => { setEmail(v); setError(null); }}
        placeholder="sam@company.com"
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        editable={!submitting}
      />

      <Text style={[styles.label, { color: colors.mutedForeground }]}>Role *</Text>
      {visibleRoles.map((r) => (
        <TouchableOpacity
          key={r}
          style={[
            styles.roleRow,
            {
              borderColor: role === r ? colors.primary : colors.border,
              backgroundColor: role === r ? colors.primary + "11" : colors.card,
            },
          ]}
          onPress={() => { setRole(r); setStreamId(null); setTeamId(null); }}
          activeOpacity={0.85}
          disabled={submitting}
        >
          <View style={[styles.radio, { borderColor: role === r ? colors.primary : colors.border }]}>
            {role === r ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.roleLabel, { color: colors.foreground }]}>{ROLE_LABEL[r]}</Text>
            <Text style={[styles.roleHint, { color: colors.mutedForeground }]}>{ROLE_HINT[r]}</Text>
          </View>
        </TouchableOpacity>
      ))}

      {role === "stream_overseer" ? (
        <>
          <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 8 }]}>Assign to stream *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {visibleStreams.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.chip, { borderColor: colors.border, backgroundColor: streamId === s.id ? colors.primary : colors.muted }]}
                onPress={() => !isOverseer && setStreamId(s.id)}
                disabled={submitting || isOverseer}
              >
                <Text style={[styles.chipText, { color: streamId === s.id ? "#fff" : colors.foreground }]}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      ) : null}

      {role === "leader" ? (
        <>
          <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 8 }]}>Stream *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {visibleStreams.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.chip, { borderColor: colors.border, backgroundColor: streamId === s.id ? colors.primary : colors.muted }]}
                onPress={() => { if (!isOverseer) { setStreamId(s.id); setTeamId(null); } }}
                disabled={submitting || isOverseer}
              >
                <Text style={[styles.chipText, { color: streamId === s.id ? "#fff" : colors.foreground }]}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 8 }]}>Assign to team *</Text>
          {!streamId ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Pick a stream first.</Text>
          ) : teamsQuery.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : streamTeams.length === 0 ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>No teams in this stream yet.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {streamTeams.map((team) => (
                <TouchableOpacity
                  key={team.id}
                  style={[styles.chip, { borderColor: colors.border, backgroundColor: teamId === team.id ? colors.primary : colors.muted }]}
                  onPress={() => setTeamId(team.id)}
                  disabled={submitting}
                >
                  <Text style={[styles.chipText, { color: teamId === team.id ? "#fff" : colors.foreground }]}>
                    {team.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.muted }]}
          onPress={() => router.back()}
          disabled={submitting}
        >
          <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: name.trim() && email.trim() && !submitting ? colors.primary : colors.border }]}
          onPress={save}
          disabled={!name.trim() || !email.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.btnText, { color: "#fff" }]}>Send invite</Text>
          )}
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
  roleRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, borderRadius: 10, borderWidth: 1, marginTop: 6,
  },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  roleLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  roleHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  row: { flexDirection: "row", gap: 8, marginTop: 16 },
  btn: {
    flex: 1, padding: 14, borderRadius: 10, alignItems: "center",
    flexDirection: "row", justifyContent: "center", minHeight: 50,
  },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  error: { color: "#DC2626", fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 8 },

  successWrap: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center" },
  successIcon: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  successTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  successSub: {
    fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center",
    marginTop: 8, lineHeight: 18,
  },
  codeBox: {
    paddingHorizontal: 32, paddingVertical: 20,
    borderRadius: 12, borderWidth: 1, marginTop: 24, marginBottom: 16,
  },
  code: { fontSize: 18, fontFamily: "Inter_700Bold", letterSpacing: 4, textAlign: "center" },
});
