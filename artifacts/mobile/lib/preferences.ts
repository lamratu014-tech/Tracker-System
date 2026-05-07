import { Platform } from "react-native";

const LAST_PROGRAMME_KEY = "ops-planning-last-programme-v1";

let SecureStore: typeof import("expo-secure-store") | null = null;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SecureStore = require("expo-secure-store");
}

async function readKey(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(key);
    }
    return (await SecureStore!.getItemAsync(key)) ?? null;
  } catch {
    return null;
  }
}

async function writeKey(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(key, value);
      return;
    }
    await SecureStore!.setItemAsync(key, value);
  } catch {
    /* noop */
  }
}

export function getLastUsedProgrammeId(): Promise<string | null> {
  return readKey(LAST_PROGRAMME_KEY);
}

export function setLastUsedProgrammeId(id: string): Promise<void> {
  return writeKey(LAST_PROGRAMME_KEY, id);
}
