import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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

function describeAuthError(err: unknown): string {
  const e = err as { status?: number; message?: string } | null;
  if (!e) return "Sign-in failed. Please try again.";
  if (e.status === 401) return "Invalid email or password.";
  if (e.status === 400) return "Please enter a valid email and password.";
  if (e.status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (typeof e.status === "number" && e.status >= 500) {
    return "The server is unavailable. Please try again shortly.";
  }
  if (e.message) return e.message;
  return "Sign-in failed. Please try again.";
}

export default function LoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/(tabs)");
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.brand, { backgroundColor: colors.primary }]}>
            <Feather name="briefcase" size={28} color="#fff" />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Updates</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>Sign in to your account</Text>

          <View style={{ height: 24 }} />

          <Text style={[styles.label, { color: colors.mutedForeground }]}>Work email</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.muted,
                color: colors.foreground,
                borderColor: error ? "#DC2626" : colors.border,
              },
            ]}
            value={email}
            onChangeText={(v) => { setEmail(v); setError(null); }}
            placeholder="you@company.com"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
            editable={!submitting}
            autoFocus
          />

          <View style={{ height: 12 }} />

          <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.muted,
                color: colors.foreground,
                borderColor: error ? "#DC2626" : colors.border,
              },
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
            style={[styles.btn, { backgroundColor: canSubmit ? colors.primary : colors.border }]}
            onPress={submit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Sign in</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
          </View>

          <TouchableOpacity
            style={[styles.btnGhost, { borderColor: colors.border }]}
            activeOpacity={0.7}
            onPress={() => router.push("/accept-invite")}
          >
            <Feather name="mail" size={14} color={colors.primary} />
            <Text style={[styles.btnGhostText, { color: colors.primary }]}>I have an invite code</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 60 },
  brand: {
    width: 64, height: 64, borderRadius: 16,
    alignItems: "center", justifyContent: "center", alignSelf: "center",
    marginTop: 24, marginBottom: 16,
  },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", textAlign: "center" },
  sub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 4 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6 },
  input: { padding: 14, borderRadius: 10, borderWidth: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  error: { color: "#DC2626", fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 6 },
  btn: { padding: 14, borderRadius: 10, alignItems: "center", marginTop: 16, minHeight: 50, justifyContent: "center" },
  btnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  divider: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 20 },
  line: { flex: 1, height: 1 },
  dividerText: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  btnGhost: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, padding: 14, borderRadius: 10, borderWidth: 1,
  },
  btnGhostText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
