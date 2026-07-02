/**
 * Deterministic conversation ID for a 1:1 direct-message thread.
 *
 * Sorts the two UIDs ascending and joins them with "_", so the same pair of
 * users always maps to the same conversation ID regardless of argument order.
 * Firebase Auth UIDs never contain underscores, so the ID can later be split
 * back into its two participants on "_".
 */
export function getConversationId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join("_");
}

/** Returns the other participant UID from a 1:1 conversation ID. */
export function getOtherUid(conversationId: string, userId: string): string | null {
  const parts = conversationId.split("_");
  if (parts.length !== 2) return null;
  return parts.find((uid) => uid !== userId) ?? null;
}
