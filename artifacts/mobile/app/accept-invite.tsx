import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { api, storeToken } from "@/services/api";

type InviteInfo = {
  email: string;
  name: string;
  role: string;
  department: string;
};

export default function AcceptInviteScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [fetchError, setFetchError] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchInvite() {
      if (!token) { setFetchError("No invite token found."); return; }
      try {
        const res = await api.getInvite(token);
        if (res.ok) {
          const data = (await res.json()) as InviteInfo;
          setInvite(data);
          setName(data.name || "");
        } else {
          setFetchError("This invite link is invalid or has expired.");
        }
      } catch {
        setFetchError("Could not connect to server. Please try again.");
      }
    }
    fetchInvite();
  }, [token]);

  async function handleAccept() {
    setError("");
    if (!name.trim()) { setError("Please enter your name."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const res = await api.acceptInvite({ token: token!, name: name.trim(), password });
      if (res.ok) {
        const { token: sessionToken } = (await res.json()) as { token: string };
        await storeToken(sessionToken);
        setSuccess(true);
        setTimeout(() => router.replace("/(tabs)"), 1500);
      } else {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Could not connect to server.");
    } finally {
      setLoading(false);
    }
  }

  if (fetchError) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: "center", padding: 32 }]}>
        <Feather name="alert-circle" size={40} color="#EF4444" style={{ alignSelf: "center", marginBottom: 16 }} />
        <Text style={[styles.title, { color: colors.foreground, textAlign: "center" }]}>Invalid Invite</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: "center" }]}>{fetchError}</Text>
        <Pressable style={[styles.btn, { backgroundColor: colors.primary, marginTop: 24 }]} onPress={() => router.replace("/login")}>
          <Text style={styles.btnText}>Go to Login</Text>
        </Pressable>
      </View>
    );
  }

  if (!invite) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.subtitle, { color: colors.mutedForeground, marginTop: 16 }]}>Loading invite…</Text>
      </View>
    );
  }

  if (success) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <View style={[styles.successCircle, { backgroundColor: "#D1FAE5" }]}>
          <Feather name="check" size={32} color="#059669" />
        </View>
        <Text style={[styles.title, { color: colors.foreground, marginTop: 16 }]}>Account Created!</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Taking you in…</Text>
      </View>
    );
  }

  const roleLabel = invite.role.charAt(0).toUpperCase() + invite.role.slice(1);

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
            <Text style={[styles.title, { color: colors.foreground }]}>Accept Invitation</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              You've been invited as a <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>{roleLabel}</Text>.
              Complete your account setup below.
            </Text>

            <View style={[styles.emailRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="mail" size={14} color={colors.mutedForeground} />
              <Text style={[styles.emailText, { color: colors.foreground }]}>{invite.email}</Text>
            </View>

            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Your Name</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground }]}
                value={name}
                onChangeText={setName}
                placeholder="Jane Smith"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Choose a Password</Text>
              <View style={[styles.passwordRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <TextInput
                  style={[styles.passwordInput, { color: colors.foreground }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>

            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Confirm Password</Text>
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
              onPress={handleAccept}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnText}>Create My Account</Text>
              )}
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
  title: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 4 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 20, lineHeight: 18 },
  emailRow: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, borderWidth: 1, padding: 10, marginBottom: 16 },
  emailText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 5 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  passwordRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, overflow: "hidden" },
  passwordInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  eyeBtn: { paddingHorizontal: 12 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, padding: 10, marginBottom: 12 },
  errorText: { color: "#EF4444", fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  btn: { paddingVertical: 14, borderRadius: 10, alignItems: "center", marginTop: 4 },
  btnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  successCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
});
