import { Stack, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";

export default function AdminLayout() {
  const colors = useColors();
  const router = useRouter();
  const { isProgrammeLead } = useAuth();

  useEffect(() => {
    if (!isProgrammeLead) router.replace("/(tabs)");
  }, [isProgrammeLead]);

  if (!isProgrammeLead) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.navyDark },
        headerTintColor: "#fff",
        headerTitleStyle: { fontFamily: "Inter_600SemiBold" },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Programme Lead Panel",
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: -4, padding: 8 }}>
              <Feather name="x" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          ),
        }}
      />
    </Stack>
  );
}
