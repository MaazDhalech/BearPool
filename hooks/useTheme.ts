import { darkTheme, type Theme } from "@/constants/theme";

/**
 * Returns the active theme token set.
 *
 * BearPool is intentionally dark-only on every platform regardless of the
 * system color scheme, so this always returns the dark theme. Consume this
 * (instead of importing raw hex / Colors.ts constants) so colors stay
 * centralized and a future light mode is a one-line change here.
 *
 *   const t = useTheme();
 *   <View style={{ backgroundColor: t.bg }} />
 *
 * `lightTheme` still exists in constants/theme.ts for when we revisit this.
 */
export function useTheme(): Theme {
  return darkTheme;
}
