import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { TouchableOpacity } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useCurrentUser } from "@/store/useStore";

export default function AdminLayout() {
  const colors = useColors();
  const router = useRouter();
  const me = useCurrentUser();
  const isAdmin = me?.role === "admin";

  useEffect(() => {
    if (!isAdmin) router.replace("/(tabs)");
  }, [isAdmin, router]);

  if (!isAdmin) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: "#fff",
        headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Admin Panel",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: -4, padding: 8 }}>
              <Feather name="x" size={20} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          ),
        }}
      />
    </Stack>
  );
}
