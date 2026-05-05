import { Platform } from "react-native";

const KEY = "ops-planning-session-token-v1";

let SecureStore: typeof import("expo-secure-store") | null = null;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SecureStore = require("expo-secure-store");
}

export async function getStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(KEY);
    }
    return (await SecureStore!.getItemAsync(KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function setStoredToken(token: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(KEY, token);
      return;
    }
    await SecureStore!.setItemAsync(KEY, token);
  } catch {
    /* noop */
  }
}

export async function clearStoredToken(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(KEY);
      return;
    }
    await SecureStore!.deleteItemAsync(KEY);
  } catch {
    /* noop */
  }
}
