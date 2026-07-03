// Default avatar: a user's initials (first + last) on a solid random color.
// Rendered via ui-avatars.com, which returns a PNG — so it works everywhere an
// avatar URL is shown (RN Image, expo-image, gluestack Avatar, the web admin).

const AVATAR_COLORS = [
  "1ABC9C", "2ECC71", "3498DB", "9B59B6", "E67E22",
  "E74C3C", "F39C12", "16A085", "27AE60", "2980B9",
  "8E44AD", "D35400", "C0392B", "2C3E50", "E84393",
];

export function randomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

/**
 * Builds an initials avatar URL. `color` defaults to a random palette color so
 * each user gets a stable, distinct background once it's saved to their doc.
 */
export function initialsAvatarUrl(
  firstName?: string,
  lastName?: string,
  color: string = randomAvatarColor(),
): string {
  const initials =
    ((firstName?.trim()?.[0] ?? "") + (lastName?.trim()?.[0] ?? "")).toUpperCase() || "U";
  const query = [
    `name=${encodeURIComponent(initials)}`,
    `background=${color}`,
    `color=FFFFFF`,
    `bold=true`,
    `size=256`,
    `length=2`,
    `format=png`,
  ].join("&");
  return `https://ui-avatars.com/api/?${query}`;
}
