import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
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

export default function ResetPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: "center", padding: 32 }]}>
        <Feather name="alert-circle" size={40} color="#EF4444" style={{ alignSelf: "center", marginBottom: 16 }} />
        <Text style={[styles.title, { color: colors.foreground, textAlign: "center" }]}>Invalid Link</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: "center" }]}>
          This reset link is missing a token. Please request a new one.
        </Text>
        <Pressable style={[styles.btn, { backgroundColor: colors.primary, marginTop: 24 }]} onPress={() => router.replace("/forgot-password")}>
          <Text style={styles.btnText}>Request New Link</Text>
        </Pressable>
      </View>
    );
  }

  async function handleReset() {
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const res = await api.resetPassword(token!, password);
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.replace("/login"), 2000);
      } else {
        const body = await res.json() as { error?: string };
        setError(body.error ?? "Something went wrong. Please request a new link.");
      }
    } catch {
      setError("Could not connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <View style={[styles.successCircle, { backgroundColor: "#D1FAE5" }]}>
          <Feather name="check" size={32} color="#059669" />
        </View>
        <Text style={[styles.title, { color: colors.foreground, marginTop: 16 }]}>Password Updated!</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Taking you to sign in…</Text>
      </View>
    );
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
            <View style={[styles.iconRow, { backgroundColor: "#DBEAFE" }]}>
              <Feather name="lock" size={24} color="#2563EB" />
            </View>

            <Text style={[styles.title, { color: colors.foreground, marginTop: 16 }]}>Choose a New Password</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Your new password must be at least 8 characters.
            </Text>

            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>New Password</Text>
              <View style={[styles.passwordRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <TextInput
                  style={[styles.passwordInput, { color: colors.foreground }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoFocus
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>

            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Confirm New Password</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            {/* Strength indicator */}
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                {[8, 12, 16].map((threshold, i) => (
                  <View
                    key={i}
                    style={[
                      styles.strengthBar,
                      {
                        backgroundColor:
                          password.length >= threshold
                            ? i === 0 ? "#F59E0B" : i === 1 ? "#3B82F6" : "#10B981"
                            : colors.border,
                      },
                    ]}
                  />
                ))}
                <Text style={[styles.strengthLabel, { color: colors.mutedForeground }]}>
                  {password.length < 8 ? "Too short" : password.length < 12 ? "Fair" : password.length < 16 ? "Good" : "Strong"}
                </Text>
              </View>
            )}

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
              onPress={handleReset}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnText}>Update Password</Text>
              )}
            </Pressable>

            <Pressable style={styles.backLink} onPress={() => router.replace("/login")}>
              <Feather name="arrow-left" size={14} color={colors.primary} />
              <Text style={[styles.backLinkText, { color: colors.primary }]}>Back to Sign In</Text>
            </Pressable>
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
  iconRow: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 4 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 20, lineHeight: 18 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 5 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  passwordRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, overflow: "hidden" },
  passwordInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  eyeBtn: { paddingHorizontal: 12 },
  strengthRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontFamily: "Inter_500Medium", width: 52, textAlign: "right" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, padding: 10, marginBottom: 12 },
  errorText: { color: "#EF4444", fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  btn: { paddingVertical: 14, borderRadius: 10, alignItems: "center", marginTop: 4 },
  btnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  backLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16 },
  backLinkText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  successCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
});
