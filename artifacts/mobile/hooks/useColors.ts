import { useColorScheme } from "react-native";

import colors from "@/constants/colors";

export function useColors() {
  const scheme = useColorScheme();
  const c = colors as unknown as {
    light: typeof colors.light;
    dark?: typeof colors.light;
    radius: number;
  };
  const palette = scheme === "dark" && c.dark ? c.dark : c.light;
  return { ...palette, radius: c.radius };
}
