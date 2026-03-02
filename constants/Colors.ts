/**
 * BearPool theme colors.
 * To change the accent color, update ACCENT here — all files import it from this constant.
 */

export const ACCENT = "#FFBE5C";        // Primary accent
export const ACCENT_DIM = "#E8B55A";    // Slightly darker for pressed/shadow states

export const BG_PRIMARY = "#121212";  // Main screen background
export const BG_SURFACE = "#1e1e1e";  // Cards, inputs, modals
export const BG_RAISED = "#2a2a2a";   // Elevated surfaces, secondary cards

export const TEXT_PRIMARY = "#ffffff";
export const TEXT_SECONDARY = "#a0a0a0";
export const TEXT_MUTED = "#666666";

export const BORDER = "#333333";
export const BORDER_SUBTLE = "#222222";

export const ERROR = "#ff4444";
export const ERROR_TEXT = "#ff7d7d";
export const ERROR_BG = "#2a0e0e";
export const ERROR_BORDER = "#4a1e1e";

export const SUCCESS = "#4CAF50";

// Legacy export shape (used by Expo template hooks)
const tintColorDark = ACCENT;
const tintColorLight = ACCENT;

export const Colors = {
  light: {
    text: "#11181C",
    background: "#fff",
    tint: tintColorLight,
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: TEXT_PRIMARY,
    background: BG_PRIMARY,
    tint: ACCENT,
    icon: TEXT_SECONDARY,
    tabIconDefault: TEXT_SECONDARY,
    tabIconSelected: ACCENT,
  },
};
