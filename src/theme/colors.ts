// Design tokens ported from the Trail Tracker web app (docs/mobile-app-requirements.md §7.1).
// Keep in sync with the web Tailwind config until a shared package exists.

export const palettes = {
  light: {
    bg: "#FFFFFF",
    surface: "#F8FAFC",
    border: "#E2E8F0",
    text: "#0F172A",
    muted: "#64748B",
    accent: "#2D6A4F",
  },
  dark: {
    bg: "#0A0E14",
    surface: "#111821",
    border: "#1E2937",
    text: "#E5EAF2",
    muted: "#64748B",
    accent: "#2D6A4F",
  },
} as const;

// Colors that are identical in both schemes.
export const fixed = {
  trailLight: "#74C69D",
  planned: "#3B82F6",
  completed: "#22C55E",
  trailBrown: "#6B4C3B",
  offlineAmber: "#F59E0B",
  bugOrange: "#FF7A00",
  featurePurple: "#A855F7",
  destructiveRed: "#EF4444",
  celebrationYellow: "#FBBF24",
  gold: "#EAB308",
  badgeBronze: "#D97706",
  badgeSilver: "#94A3B8",
  badgeGold: "#FACC15",
  badgeSpecial: "#A855F7",
} as const;

export type SchemeColors = { [K in keyof (typeof palettes)["light"]]: string };
export type ThemeColors = SchemeColors & { [K in keyof typeof fixed]: string };

export function colorsForScheme(scheme: "light" | "dark"): ThemeColors {
  return { ...palettes[scheme], ...fixed };
}
