import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login, setup, needsSetup, isAuthenticated } = useAuth();

  const [mode, setMode] = useState<"login" | "setup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (needsSetup) setMode("setup");
  }, [needsSetup]);

  useEffect(() => {
    if (isAuthenticated) router.replace("/(tabs)");
  }, [isAuthenticated]);

  async function handleSubmit() {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    if (mode === "setup") {
      if (!name.trim()) { setError("Please enter your name."); return; }
      if (password !== confirmPassword) { setError("Passwords do not match."); return; }
      if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    }

    setLoading(true);
    const result =
      mode === "setup"
        ? await setup(email.trim(), name.trim(), password, department.trim() || undefined)
        : await login(email.trim(), password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.replace("/(tabs)");
    }
  }

  const isSetup = mode === "setup";
  const title = isSetup ? "Create Admin Account" : "Sign In";
  const subtitle = isSetup
    ? "Set up the first administrator account for your organisation."
    : "Sign in to your Ops & Planning account.";
  const btnLabel = isSetup ? "Create Account" : "Sign In";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo area */}
          <View style={styles.logoWrap}>
            <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
              <Feather name="briefcase" size={28} color="#fff" />
            </View>
            <Text style={[styles.appName, { color: colors.foreground }]}>
              Ops & Planning
            </Text>
          </View>

          {/* Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>

            {isSetup && (
              <>
                <Field
                  label="Full Name"
                  value={name}
                  onChange={setName}
                  placeholder="Jane Smith"
                  colors={colors}
                />
                <Field
                  label="Department (optional)"
                  value={department}
                  onChange={setDepartment}
                  placeholder="e.g. Operations"
                  colors={colors}
                />
              </>
            )}

            <Field
              label="Email Address"
              value={email}
              onChange={setEmail}
              placeholder="you@organisation.org"
              keyboardType="email-address"
              autoCapitalize="none"
              colors={colors}
            />

            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
              <View style={[styles.passwordRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <TextInput
                  style={[styles.passwordInput, { color: colors.foreground }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>

            {isSetup && (
              <Field
                label="Confirm Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="••••••••"
                secureTextEntry
                colors={colors}
              />
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
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.btnText}>{btnLabel}</Text>
              )}
            </Pressable>
          </View>

          {!isSetup && (
            <Pressable style={styles.forgotLink} onPress={() => router.push("/forgot-password")}>
              <Text style={[styles.forgotLinkText, { color: colors.primary }]}>Forgot your password?</Text>
            </Pressable>
          )}

          <Text style={[styles.footer, { color: colors.mutedForeground }]}>
            Ops & Planning · Secure & Encrypted
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  colors,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  keyboardType?: any;
  autoCapitalize?: any;
  secureTextEntry?: boolean;
  colors: any;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? "none"}
        secureTextEntry={secureTextEntry}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 24 },
  logoWrap: { alignItems: "center", marginBottom: 32 },
  logoCircle: {
    width: 64, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  appName: { fontSize: 22, fontFamily: "Inter_700Bold" },
  card: {
    borderRadius: 16, borderWidth: 1, padding: 24, marginBottom: 24,
  },
  title: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 4 },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 20, lineHeight: 18 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 5 },
  input: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: "Inter_400Regular",
  },
  passwordRow: {
    flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, overflow: "hidden",
  },
  passwordInput: {
    flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular",
  },
  eyeBtn: { paddingHorizontal: 12 },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 8, padding: 10, marginBottom: 12,
  },
  errorText: { color: "#EF4444", fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  btn: {
    paddingVertical: 14, borderRadius: 10, alignItems: "center", marginTop: 4,
  },
  btnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  footer: { textAlign: "center", fontSize: 11, fontFamily: "Inter_400Regular" },
  forgotLink: { alignItems: "center", marginBottom: 16 },
  forgotLinkText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
