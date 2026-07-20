import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/services/firebaseConfig";

// undefined = auth state not yet determined (loading)
// null      = no user signed in
// User      = signed-in user
type AuthState = User | null | undefined;

export function useFirebaseAuth() {
  const [user, setUser] = useState<AuthState>(undefined);

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      // Refresh the ID token once on sign-in so custom claims (e.g. `admin`)
      // are current without waiting for the ~1h auto-refresh. Fire-and-forget.
      if (firebaseUser) {
        // TEMP DEBUG: surface token refresh failures instead of swallowing them.
        firebaseUser.getIdToken(true).then(
          (token) => console.log("[auth debug] token refresh OK, uid:", firebaseUser.uid, "len:", token.length),
          (err) => console.error("[auth debug] token refresh FAILED:", err?.code, err?.message),
        );
      }
    });
  }, []);

  return {
    user: user ?? null,
    loading: user === undefined,
    userId: user?.uid ?? null,
    // Clerk-compatible aliases
    isLoaded: user !== undefined,
    isSignedIn: user != null,
  };
}
