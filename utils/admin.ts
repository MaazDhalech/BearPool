import { auth } from "@/services/firebaseConfig";

/**
 * Whether the current user is an admin, per the Firebase Auth custom claim
 * `admin` — the single source of truth for admin status across the app and
 * website.
 *
 * Do NOT read the Firestore `users/{uid}.isAdmin` field for this: it is retired,
 * can be stale, and (before the rules lockdown) was client-writable.
 *
 * @param forceRefresh bypass the cached ID token so a just-granted/revoked claim
 *   is reflected immediately (otherwise the cached token is used, up to ~1h old).
 */
export async function checkIsAdmin(forceRefresh = false): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  try {
    const { claims } = await user.getIdTokenResult(forceRefresh);
    return claims.admin === true;
  } catch {
    return false;
  }
}
