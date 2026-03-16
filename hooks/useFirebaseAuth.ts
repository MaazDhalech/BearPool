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
