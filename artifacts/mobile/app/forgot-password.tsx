import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { api } from "@/services/api";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleRequest() {
    setError("");
    const trimmed = email.trim();
    if (!trimmed) { setError("Please enter your email address."); return; }

    setLoading(true);
    try {
      const res = await api.forgotPassword(trimmed);
      const body = await res.json() as { message?: string; error?: string };
      if (res.ok) {
        setSent(true);
      } else {
        setError(body.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Could not connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoWrap}>
            <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
              <Feather name="briefcase" size={28} color="#fff" />
            </View>
            <Text style={[styles.appName, { color: colors.foreground }]}>Ops & Planning</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {sent ? (
              <View style={{ alignItems: "center" }}>
                <View style={[styles.successCircle, { backgroundColor: "#DBEAFE" }]}>
                  <Feather name="mail" size={32} color="#2563EB" />
                </View>
                <Text style={[styles.title, { color: colors.foreground, textAlign: "center", marginTop: 16 }]}>
                  Check your inbox
                </Text>
                <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: "center" }]}>
                  If <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{email.trim()}</Text> is
                  registered, a reset link has been sent. It expires in 1 hour.
                </Text>

                <Pressable
                  style={[styles.btn, { backgroundColor: colors.primary, marginTop: 8 }]}
                  onPress={() => router.replace("/login")}
                >
                  <Text style={styles.btnText}>Back to Sign In</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={[styles.title, { color: colors.foreground }]}>Forgot Password?</Text>
                <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                  Enter your email address and we'll send you a link to reset your password.
                </Text>

                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>Email Address</Text>
                  <TextInput
                    style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground }]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@organisation.org"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoFocus
                  />
                </View>

                {error ? (
                  <View style={[styles.errorBox, { backgroundColor: "#FEE2E2" }]}>
                    <Feather name="alert-circle" size={14} color="#EF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <Pressable
                  style={({ pressed }) => [
                    styles.btn,
                    { backgroundColor: colors.primary, opacity: pressed || loading ? 0.85 : 1 },
                  ]}
                  onPress={handleRequest}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.btnText}>Send Reset Link</Text>
                  )}
                </Pressable>

                <Pressable style={styles.backLink} onPress={() => router.back()}>
                  <Feather name="arrow-left" size={14} color={colors.primary} />
                  <Text style={[styles.backLinkText, { color: colors.primary }]}>Back to Sign In</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 24 },
  logoWrap: { alignItems: "center", marginBottom: 32 },
  logoCircle: { width: 64, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  appName: { fontSize: 22, fontFamily: "Inter_700Bold" },
  card: { borderRadius: 16, borderWidth: 1, padding: 24, marginBottom: 24 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 4 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 20, lineHeight: 18 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 5 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, padding: 10, marginBottom: 12 },
  errorText: { color: "#EF4444", fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  btn: { paddingVertical: 14, borderRadius: 10, alignItems: "center", marginTop: 4 },
  btnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  backLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 },
  backLinkText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  successCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
});
