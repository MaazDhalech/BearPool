// utils/userRatings.ts
//
// User-to-user ratings, one Firestore document per rating in "userRatings".
//
// The document ID is deterministic: `${rideId}_${raterId}_${ratedUserId}`.
// That single trick is our duplicate-prevention: a rater can only ever have
// ONE rating per person per ride, because writing again just overwrites the
// same document instead of creating a new one.

import { db } from "@/services/firebaseConfig";
import {
    collection,
    doc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    where,
} from "firebase/firestore";

export type MemberRating = {
  ratedUserId: string;
  stars: number; // 1–5
};

export type RatingSummary = {
  average: number; // 0 when the user has no ratings yet
  count: number;
};

/** Write one rating doc per rated member. Skips self-ratings and 0-star rows. */
export async function submitMemberRatings(
  rideId: string,
  raterId: string,
  ratings: MemberRating[],
): Promise<void> {
  const valid = ratings.filter(
    (r) => r.stars >= 1 && r.stars <= 5 && r.ratedUserId !== raterId,
  );

  await Promise.all(
    valid.map((r) =>
      setDoc(doc(db, "userRatings", `${rideId}_${raterId}_${r.ratedUserId}`), {
        rideId,
        raterId,
        ratedUserId: r.ratedUserId,
        stars: r.stars,
        createdAt: serverTimestamp(),
      }),
    ),
  );
}

/** Average + count of all ratings a user has received, computed client-side. */
export async function getUserRatingSummary(
  userId: string,
): Promise<RatingSummary> {
  const snap = await getDocs(
    query(collection(db, "userRatings"), where("ratedUserId", "==", userId)),
  );

  if (snap.empty) return { average: 0, count: 0 };

  let sum = 0;
  snap.forEach((d) => {
    sum += d.data().stars || 0;
  });

  return { average: sum / snap.size, count: snap.size };
}