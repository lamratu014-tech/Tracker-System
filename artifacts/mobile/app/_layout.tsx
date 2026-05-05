import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Redirect, Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useColors } from "@/hooks/useColors";
import { AuthProvider, useAuth } from "@/lib/auth/AuthContext";
import { useStore } from "@/store/useStore";

SplashScreen.preventAutoHideAsync();

const PUBLIC_ROUTES = new Set(["login", "accept-invite"]);

function AuthGate({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const { user, isLoading } = useAuth();
  const hydrated = useStore((s) => s.hydrated);
  const segments = useSegments();

  if (isLoading || !hydrated) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const first = segments[0];
  const inPublic = first === undefined || PUBLIC_ROUTES.has(first as string);

  if (!user && !inPublic) return <Redirect href="/login" />;
  if (user && first === "login") return <Redirect href="/(tabs)" />;
  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <AuthGate>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="accept-invite" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="stream/[id]" options={{ title: "Stream", headerBackTitle: "Back" }} />
        <Stack.Screen name="team/[id]" options={{ title: "Team", headerBackTitle: "Back" }} />
        <Stack.Screen name="event/[id]" options={{ title: "Event", headerBackTitle: "Back" }} />
        <Stack.Screen name="project/[id]" options={{ title: "Project", headerBackTitle: "Back" }} />
        <Stack.Screen name="new-stream" options={{ title: "New Stream", presentation: "modal", headerBackTitle: "Cancel" }} />
        <Stack.Screen name="new-team" options={{ title: "New Team", presentation: "modal", headerBackTitle: "Cancel" }} />
        <Stack.Screen name="new-user" options={{ title: "Invite User", presentation: "modal", headerBackTitle: "Cancel" }} />
        <Stack.Screen name="new-project" options={{ title: "New Project", presentation: "modal", headerBackTitle: "Cancel" }} />
        <Stack.Screen name="new-milestone" options={{ title: "New Milestone", presentation: "modal", headerBackTitle: "Cancel" }} />
        <Stack.Screen name="new-event" options={{ title: "New Event", presentation: "modal", headerBackTitle: "Cancel" }} />
      </Stack>
    </AuthGate>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <RootLayoutNav />
              </AuthProvider>
            </QueryClientProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
