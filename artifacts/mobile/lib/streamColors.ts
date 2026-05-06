export const STREAM_COLOR_PALETTE = [
  "#2563EB",
  "#9333EA",
  "#DB2777",
  "#DC2626",
  "#EA580C",
  "#CA8A04",
  "#16A34A",
  "#0D9488",
  "#0284C7",
  "#7C3AED",
] as const;

export const NEUTRAL_STREAM_COLOR = "#64748B";

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function colorForStream(streamId: string | null | undefined): string {
  if (!streamId) return NEUTRAL_STREAM_COLOR;
  const idx = hashString(streamId) % STREAM_COLOR_PALETTE.length;
  return STREAM_COLOR_PALETTE[idx]!;
}
