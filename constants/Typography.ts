/**
 * BearPool type scale.
 * Use these instead of raw fontSize/fontWeight values throughout the app.
 */

export const TYPE = {
  size: {
    display:    32,   // Screen hero titles ("Post a Ride", "Upcoming Rides")
    heading:    22,   // Card primary content (route names, section headings)
    subheading: 18,   // Sub-section titles, modal headings
    body:       15,   // General body text, list items
    caption:    13,   // Secondary metadata (date, seats, posted time)
    label:      12,   // Field labels, tags, timestamps
    micro:      11,   // Hints, fine print, archive sub-text
  },
  weight: {
    regular:  "400" as const,
    medium:   "500" as const,
    semibold: "600" as const,
    bold:     "700" as const,
  },
  leading: {
    tight:   1.2,
    normal:  1.5,
    relaxed: 1.7,
  },
} as const;
