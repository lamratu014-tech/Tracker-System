import { Feather } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
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
import { useStore } from "@/store/useStore";

export default function LoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const loginByEmail = useStore((s) => s.loginByEmail);
  const userCount = useStore((s) => s.users.length);

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const result = loginByEmail(email);
    if (!result.ok) {
      setError(result.error ?? "Login failed");
      return;
    }
    router.replace("/(tabs)");
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
          <Text style={[styles.title, { color: colors.foreground }]}>Ops & Planning</Text>
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
            returnKeyType="go"
            onSubmitEditing={submit}
            autoFocus
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: email.trim() ? colors.primary : colors.border }]}
            onPress={submit}
            disabled={!email.trim()}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>Sign in</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
          </View>

          <Link href="/accept-invite" asChild>
            <TouchableOpacity style={[styles.btnGhost, { borderColor: colors.border }]} activeOpacity={0.7}>
              <Feather name="mail" size={14} color={colors.primary} />
              <Text style={[styles.btnGhostText, { color: colors.primary }]}>I have an invite code</Text>
            </TouchableOpacity>
          </Link>

          <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
            {userCount} account{userCount !== 1 ? "s" : ""} on this device.
            {"\n"}Demo logins: admin@ops.test · pat@ops.test · jess@ops.test · morgan@ops.test
          </Text>
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
  btn: { padding: 14, borderRadius: 10, alignItems: "center", marginTop: 16 },
  btnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  divider: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 20 },
  line: { flex: 1, height: 1 },
  dividerText: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  btnGhost: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, padding: 14, borderRadius: 10, borderWidth: 1,
  },
  btnGhostText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  footnote: { marginTop: 24, fontSize: 11, textAlign: "center", fontFamily: "Inter_400Regular", lineHeight: 16 },
});
