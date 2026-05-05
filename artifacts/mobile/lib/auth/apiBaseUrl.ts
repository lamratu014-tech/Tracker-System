import Constants from "expo-constants";
import { Platform } from "react-native";

export function resolveApiBaseUrl(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.location?.origin) {
      return window.location.origin;
    }
    return null;
  }

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;

  const hostUri =
    Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.hostUri ?? null;
  if (hostUri) {
    const host = hostUri.split(":")[0];
    return `http://${host}:8081`;
  }
  return null;
}
