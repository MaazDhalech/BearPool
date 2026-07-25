import "dotenv/config";

// Uses the public Firebase Web API key + the poster's own idToken, mirroring
// how the app itself writes/deletes — no admin credentials needed. See
// firestore.rules: any signed-in user may write/delete any `rides` doc.
const API_KEY = process.env.FIREBASE_API_KEY;
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Sign-in failed for ${email}: ${JSON.stringify(data)}`);
  return data.idToken as string;
}

/**
 * Deletes the ride(s) this test run created (matched by the unique `to`
 * destination string each spec generates), so E2E runs don't leave permanent
 * clutter in Firestore. Best-effort: logs and swallows failures instead of
 * failing the test, since each destination is unique-per-run and a leftover
 * doc is harmless clutter, not a correctness problem.
 */
export async function deleteRideByDestination(
  email: string,
  password: string,
  destination: string,
): Promise<void> {
  if (!API_KEY || !PROJECT_ID) {
    console.warn("Skipping ride cleanup: FIREBASE_API_KEY/FIREBASE_PROJECT_ID not set.");
    return;
  }

  try {
    const idToken = await signIn(email, password);

    const queryRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "rides" }],
            where: {
              fieldFilter: {
                field: { fieldPath: "to" },
                op: "EQUAL",
                value: { stringValue: destination },
              },
            },
            limit: 5,
          },
        }),
      },
    );
    const results: Array<{ document?: { name: string } }> = await queryRes.json();
    const docNames = (results ?? []).map((r) => r.document?.name).filter((n): n is string => !!n);

    for (const name of docNames) {
      await fetch(`https://firestore.googleapis.com/v1/${name}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}` },
      });
    }
  } catch (err) {
    console.warn(`Ride cleanup failed for "${destination}":`, err);
  }
}
