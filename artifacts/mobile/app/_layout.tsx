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
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();

  if (isLoading) return null;

  const inPublic =
    segments[0] === "login" ||
    segments[0] === "accept-invite" ||
    segments[0] === "forgot-password" ||
    segments[0] === "reset-password" ||
    segments.length === 0;

  if (!isAuthenticated && !inPublic) {
    return <Redirect href="/login" />;
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <AuthGate>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="accept-invite" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen
          name="event/[id]"
          options={{ title: "Event Details", headerBackTitle: "Back" }}
        />
        <Stack.Screen
          name="project/[id]"
          options={{ title: "Project", headerBackTitle: "Back" }}
        />
        <Stack.Screen
          name="new-event"
          options={{
            title: "New Event",
            presentation: "modal",
            headerBackTitle: "Cancel",
          }}
        />
        <Stack.Screen
          name="new-project"
          options={{
            title: "New Project",
            presentation: "modal",
            headerBackTitle: "Cancel",
          }}
        />
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

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <DataProvider>
              <GestureHandlerRootView>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </DataProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
