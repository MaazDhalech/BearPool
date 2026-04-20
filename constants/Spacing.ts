/**
 * BearPool spacing scale (4px base grid).
 * Use these instead of raw pixel values throughout the app.
 *
 * xs  →  4   (tight grouping within a component)
 * sm  →  8   (between related elements)
 * md  →  12  (standard internal padding)
 * lg  →  16  (standard section padding / horizontal screen inset)
 * xl  →  20  (breathing room between distinct elements)
 * 2xl →  24  (between sections within a screen)
 * 3xl →  32  (between major sections)
 * 4xl →  48  (top-of-screen breathing room)
 * 5xl →  64  (large vertical separation)
 */

export const SPACE = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 48,
  "5xl": 64,
} as const;

export type SpaceKey = keyof typeof SPACE;
