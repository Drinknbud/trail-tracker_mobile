import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import { storage } from "@/lib/storage";
import { colorsForScheme, DEFAULT_ACCENT, type ThemeColors } from "./colors";

export type ThemeMode = "light" | "dark" | "system";
export type TextSize = "standard" | "large" | "xlarge";

// Web app uses a three-step root font scale of ~16 / 18 / 24 px.
export const TEXT_SCALE: Record<TextSize, number> = {
  standard: 1,
  large: 1.125,
  xlarge: 1.5,
};

const MODE_KEY = "theme.mode";
const TEXT_SIZE_KEY = "theme.textSize";
const ACCENT_KEY = "theme.accentColor";

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  scheme: "light" | "dark";
  colors: ThemeColors;
  textSize: TextSize;
  setTextSize: (size: TextSize) => void;
  fontScale: number;
  /** Sets the user's custom accent color (mirrors web's per-user accentColor). Pass null to reset to the trail-green default. */
  setAccentColor: (hex: string | null) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const rawScheme = useColorScheme();
  const systemScheme: "light" | "dark" = rawScheme === "dark" ? "dark" : "light";
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [textSize, setTextSizeState] = useState<TextSize>("standard");
  const [accent, setAccentState] = useState<string>(DEFAULT_ACCENT);

  useEffect(() => {
    (async () => {
      const [storedMode, storedSize, storedAccent] = await Promise.all([
        storage.get(MODE_KEY),
        storage.get(TEXT_SIZE_KEY),
        storage.get(ACCENT_KEY),
      ]);
      if (storedMode === "light" || storedMode === "dark" || storedMode === "system") {
        setModeState(storedMode);
      }
      if (storedSize === "standard" || storedSize === "large" || storedSize === "xlarge") {
        setTextSizeState(storedSize);
      }
      if (storedAccent) setAccentState(storedAccent);
    })();
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void storage.set(MODE_KEY, next);
  }, []);

  const setTextSize = useCallback((next: TextSize) => {
    setTextSizeState(next);
    void storage.set(TEXT_SIZE_KEY, next);
  }, []);

  const setAccentColor = useCallback((hex: string | null) => {
    const next = hex ?? DEFAULT_ACCENT;
    setAccentState(next);
    void storage.set(ACCENT_KEY, next);
  }, []);

  const scheme = mode === "system" ? systemScheme : mode;

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      setMode,
      scheme,
      colors: colorsForScheme(scheme, accent),
      textSize,
      setTextSize,
      fontScale: TEXT_SCALE[textSize],
      setAccentColor,
    }),
    [mode, setMode, scheme, accent, textSize, setTextSize, setAccentColor]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
