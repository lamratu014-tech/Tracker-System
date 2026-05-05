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

export default function AcceptInviteScreen() {
  const colors = useColors();
  const router = useRouter();
  const acceptInvite = useStore((s) => s.acceptInvite);

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const result = acceptInvite(code);
    if (!result.ok) {
      setError(result.error ?? "Could not accept invite");
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
          <TouchableOpacity onPress={() => router.back()} style={styles.back} hitSlop={8}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>

          <View style={[styles.brand, { backgroundColor: colors.primary }]}>
            <Feather name="mail" size={28} color="#fff" />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>Accept invite</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            Enter the 6-character invite code your administrator sent you.
          </Text>

          <View style={{ height: 24 }} />

          <Text style={[styles.label, { color: colors.mutedForeground }]}>Invite code</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.muted,
                color: colors.foreground,
                borderColor: error ? "#DC2626" : colors.border,
              },
            ]}
            value={code}
            onChangeText={(v) => { setCode(v.toUpperCase()); setError(null); }}
            placeholder="ABC123"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            returnKeyType="go"
            onSubmitEditing={submit}
            autoFocus
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[
              styles.btn,
              { backgroundColor: code.trim().length === 6 ? colors.primary : colors.border },
            ]}
            onPress={submit}
            disabled={code.trim().length !== 6}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>Activate account</Text>
          </TouchableOpacity>

          <Text style={[styles.footnote, { color: colors.mutedForeground }]}>
            Once activated you can sign in with your email next time.
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
  input: {
    padding: 16, borderRadius: 10, borderWidth: 1,
    fontSize: 22, fontFamily: "Inter_700Bold",
    textAlign: "center", letterSpacing: 8,
  },
  error: { color: "#DC2626", fontSize: 12, fontFamily: "Inter_500Medium", marginTop: 6, textAlign: "center" },
  btn: { padding: 14, borderRadius: 10, alignItems: "center", marginTop: 16 },
  btnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  footnote: { marginTop: 16, fontSize: 11, textAlign: "center", fontFamily: "Inter_400Regular" },
});
