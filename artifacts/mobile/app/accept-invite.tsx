import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getInviteByToken,
  useAcceptInvite,
  type InvitePreview,
} from "@workspace/api-client-react";

function describeError(err: unknown, fallback: string): string {
  const e = err as { status?: number; message?: string } | null;
  if (!e) return fallback;
  if (e.status === 400) return "That invite code is invalid or has expired.";
  if (e.status === 409) return "An account with this email already exists. Please sign in.";
  if (typeof e.status === "number" && e.status >= 500) {
    return "The server is unavailable. Please try again shortly.";
  }
  return e.message ?? fallback;
}

export default function AcceptInviteScreen() {
  const colors = useColors();
  const router = useRouter();
  const { applySession } = useAuth();
  const accept = useAcceptInvite();

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // When the user finishes typing a 16-char code, fetch the invite preview
  // so we can pre-fill their name and confirm the code is valid before
  // they pick a password.
  useEffect(() => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 16) {
      setPreview(null);
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setError(null);
    getInviteByToken(trimmed)
      .then((p) => {
        if (cancelled) return;
        setPreview(p);
      })
      .catch((err) => {
        if (cancelled) return;
        setPreview(null);
        setError(describeError(err, "That invite code is invalid or has expired."));
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => { cancelled = true; };
  }, [code]);

  const submitting = accept.isPending;
  const canSubmit =
    preview !== null &&
    password.length >= 8 &&
    !submitting;

  async function submit() {
    if (!canSubmit || !preview) return;
    setError(null);
    try {
      const session = await accept.mutateAsync({
        data: {
          token: code.trim().toUpperCase(),
          password,
        },
      });
      await applySession(session);
      router.replace("/(tabs)");
    } catch (err) {
      setError(describeError(err, "Could not activate your account. Please try again."));
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.back} hitSlop={8}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>

          <View style={[styles.brand, { backgroundColor: colors.primary }]}>
            <Feather name="mail" size={28} color="#fff" />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Accept invite</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Enter the 16-character invite code your administrator sent you,
            then set a password.
          </Text>

          <View style={{ height: 24 }} />

          <Text style={[styles.label, { color: colors.mutedForeground }]}>Invite code</Text>
          <TextInput
            style={[
              styles.codeInput,
              {
                backgroundColor: colors.muted,
                color: colors.foreground,
                borderColor: error && !preview ? "#DC2626" : colors.border,
              },
            ]}
            value={code}
            onChangeText={(v) => { setCode(v.toUpperCase()); setError(null); }}
            placeholder="ABCD1234EFGH5678"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={16}
            editable={!submitting}
            autoFocus
          />

          {previewLoading ? (
            <Text style={[styles.helper, { color: colors.mutedForeground }]}>Checking code…</Text>
          ) : preview ? (
            <View style={[styles.previewBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="check-circle" size={14} color="#059669" />
              <Text style={[styles.previewText, { color: colors.foreground }]}>
                Invited as <Text style={{ fontFamily: "Inter_600SemiBold" }}>{preview.name}</Text>
                {" "}(<Text>{preview.email}</Text>)
              </Text>
            </View>
          ) : null}

          <View style={{ height: 12 }} />

          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Password (at least 8 characters)
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border },
            ]}
            value={password}
            onChangeText={(v) => { setPassword(v); setError(null); }}
            placeholder="••••••••"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={submit}
            editable={!submitting}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[
              styles.btn,
              { backgroundColor: canSubmit ? colors.primary : colors.border },
            ]}
            onPress={submit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Activate account</Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
            Once activated you can sign in with your email and password.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 60 },
  back: { padding: 4, alignSelf: "flex-start", marginBottom: 8 },
  brand: {
    width: 64, height: 64, borderRadius: 16,
    alignItems: "center", justifyContent: "center", alignSelf: "center",
    marginTop: 16, marginBottom: 16,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center" },
  sub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 6, lineHeight: 18 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6 },
  codeInput: {
    padding: 16, borderRadius: 10, borderWidth: 1,
    fontSize: 14, fontFamily: "Inter_700Bold",
    textAlign: "center", letterSpacing: 3,
  },
  input: { padding: 14, borderRadius: 10, borderWidth: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  helper: { marginTop: 6, fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  previewBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 8, padding: 10, borderRadius: 8, borderWidth: 1,
  },
  previewText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  error: { color: "#DC2626", fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 8, textAlign: "center" },
  btn: { padding: 14, borderRadius: 10, alignItems: "center", marginTop: 16, minHeight: 50, justifyContent: "center" },
  btnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  footnote: { marginTop: 16, fontSize: 11, textAlign: "center", fontFamily: "Inter_400Regular" },
});
