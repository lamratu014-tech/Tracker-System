import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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

export default function CreateAdminScreen() {
  const colors = useColors();
  const router = useRouter();
  const inviteUser = useStore((s) => s.inviteUser);
  const updateUser = useStore((s) => s.updateUser);
  const loginById = useStore((s) => s.loginById);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (!name.trim()) return setError("Name is required");
    if (!email.trim() || !email.includes("@")) return setError("Enter a valid email");

    const user = inviteUser({
      name: name.trim(),
      email: email.trim(),
      role: "admin",
      streamId: null,
      teamId: null,
    });
    if (!user) {
      setError("Could not create account. The email may already be in use.");
      return;
    }
    updateUser(user.id, { active: true });
    loginById(user.id);
    router.replace("/(tabs)");
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
            <Feather name="shield" size={28} color="#fff" />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Create admin account</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Sets up a full-access admin and signs you in immediately.
          </Text>

          <View style={{ height: 24 }} />

          <Text style={[styles.label, { color: colors.mutedForeground }]}>Full name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            value={name}
            onChangeText={(v) => { setName(v); setError(null); }}
            placeholder="e.g. Alex Morgan"
            placeholderTextColor={colors.mutedForeground}
            autoFocus
          />

          <View style={{ height: 12 }} />

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
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: name.trim() && email.trim() ? colors.primary : colors.border }]}
            onPress={submit}
            disabled={!name.trim() || !email.trim()}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>Create & sign in</Text>
          </TouchableOpacity>

          <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
            Admins can invite stream overseers and team leaders from the Admin tab.
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
  input: { padding: 14, borderRadius: 10, borderWidth: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  error: { color: "#DC2626", fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 6 },
  btn: { padding: 14, borderRadius: 10, alignItems: "center", marginTop: 16 },
  btnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  footnote: { marginTop: 16, fontSize: 11, textAlign: "center", fontFamily: "Inter_400Regular", lineHeight: 16 },
});
