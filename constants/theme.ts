/**
 * BearPool theme tokens - light + dark.
 *
 * Both themes expose the SAME semantic keys so components can be migrated
 * mechanically: read a color from `useTheme()` instead of importing a raw hex
 * or a fixed constant from Colors.ts.
 *
 * The accent (BearPool gold) stays constant across themes by design.
 *
 * Migration pattern:
 *   const t = useTheme();
 *   <View style={{ backgroundColor: t.bg }}>          // was "#121212" / BG_PRIMARY
 *   <Text style={{ color: t.textSecondary }}>         // was "#a0a0a0" / TEXT_SECONDARY
 *
 * Colors.ts is kept intact - existing imports keep working during migration.
 */

import { ACCENT, ACCENT_DIM } from "./Colors";

export type Theme = {
  /** true when this is the dark theme - handy for one-off conditionals */
  isDark: boolean;

  // Brand
  accent: string;
  accentDim: string;
  /** Foreground that sits on top of an accent-filled surface (e.g. button label) */
  onAccent: string;

  // Surfaces (low → high elevation)
  bg: string;
  surface: string;
  /** Between surface and raised */
  surfaceAlt: string;
  raised: string;

  // Text
  textPrimary: string;
  /** Near-white body text */
  textBright: string;
  textSecondary: string;
  textMuted: string;
  /** Fainter than textMuted */
  textFaint: string;
  /** Very low-emphasis text: hints, disabled labels, fine print */
  textGhost: string;

  // Lines
  border: string;
  /** Lighter divider/border than border */
  borderStrong: string;
  borderSubtle: string;

  // Status
  /** Destructive-action red (delete / leave / report) */
  danger: string;
  error: string;
  errorText: string;
  errorBg: string;
  errorBorder: string;
  success: string;

  // Misc
  /** Scrim behind modals / sheets */
  overlay: string;
  /** Tint for pull-to-refresh spinners, placeholders */
  placeholder: string;
};

export const darkTheme: Theme = {
  isDark: true,

  accent: ACCENT,
  accentDim: ACCENT_DIM,
  onAccent: "#121212",

  bg: "#121212",
  surface: "#1e1e1e",
  surfaceAlt: "#252525",
  raised: "#2a2a2a",

  textPrimary: "#ffffff",
  textBright: "#e8e8e8",
  textSecondary: "#a0a0a0",
  textMuted: "#666666",
  textFaint: "#888888",
  textGhost: "#545456",

  border: "#333333",
  borderStrong: "#444444",
  borderSubtle: "#222222",

  danger: "#ff6b6b",
  error: "#ff4444",
  errorText: "#ff7d7d",
  errorBg: "#2a0e0e",
  errorBorder: "#4a1e1e",
  success: "#4CAF50",

  overlay: "rgba(0,0,0,0.6)",
  placeholder: "#666666",
};

export const lightTheme: Theme = {
  isDark: false,

  accent: ACCENT,
  accentDim: ACCENT_DIM,
  onAccent: "#1a1300",

  bg: "#ffffff",
  surface: "#f4f4f5",
  surfaceAlt: "#ececef",
  raised: "#e9e9ec",

  textPrimary: "#11181c",
  textBright: "#11181c",
  textSecondary: "#52525b",
  textMuted: "#8a8a90",
  textFaint: "#9a9aa0",
  textGhost: "#aeaeb2",

  border: "#d8d8dc",
  borderStrong: "#c8c8cc",
  borderSubtle: "#ececef",

  danger: "#d92626",
  error: "#d92626",
  errorText: "#b91c1c",
  errorBg: "#fdecec",
  errorBorder: "#f5c2c2",
  success: "#2e7d32",

  overlay: "rgba(0,0,0,0.4)",
  placeholder: "#9a9aa0",
};

export const themes = { light: lightTheme, dark: darkTheme } as const;
