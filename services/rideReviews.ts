import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";

export type RideReviewInput = {
  /** 1–5 stars for the ride as a whole. */
  rating: number;
  /** Whether the ride actually took place. */
  completed: boolean;
  /**
   * Optional free-text feedback from the rider. Named `feedback` rather than
   * `notes` to keep it distinct from the ride's own `notes` field, which is the
   * description the host writes when posting the ride.
   */
  feedback?: string;
};

/**
 * Records one rider's review of a ride and rolls it into the ride's aggregate.
 *
 * Each rider gets exactly one review doc at rides/{rideId}/reviews/{userId}, so
 * re-submitting updates their vote rather than double-counting it. The running
 * totals live on the ride doc itself:
 *
 *   ratingSum, ratingCount, ratingAvg, completedCount
 *
 * `ratingCount` is the total number of reviews, so the number of riders who said
 * the ride did NOT happen is simply `ratingCount - completedCount`. It isn't
 * stored, since a derived field can only drift out of sync with its source.
 *
 * Both the vote and the aggregate are written in a single transaction, so the
 * average can never drift out of sync with the underlying votes.
 *
 * Note: the aggregate is maintained client-side because firestore.rules already
 * permits authenticated writes to rides/{rideId}. That means a determined client
 * could write a bogus ratingAvg. This is a deliberate tradeoff to avoid a Cloud
 * Function deploy; move this into an onDocumentWritten trigger to harden it.
 */
export async function submitRideReview(
  rideId: string,
  userId: string,
  { rating, completed, feedback = "" }: RideReviewInput
): Promise<void> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error("Rating must be an integer between 1 and 5");
  }

  const rideRef = doc(db, "rides", rideId);
  const reviewRef = doc(db, "rides", rideId, "reviews", userId);

  await runTransaction(db, async (txn) => {
    // All reads must happen before any writes inside a transaction.
    const rideSnap = await txn.get(rideRef);
    const prevSnap = await txn.get(reviewRef);

    if (!rideSnap.exists()) throw new Error("This ride no longer exists");

    const ride = rideSnap.data();
    let ratingSum: number = ride.ratingSum ?? 0;
    let ratingCount: number = ride.ratingCount ?? 0;
    let completedCount: number = ride.completedCount ?? 0;

    // Rider is changing an existing vote — back the old one out first.
    if (prevSnap.exists()) {
      const prev = prevSnap.data();
      ratingSum -= prev.rating ?? 0;
      ratingCount -= 1;
      if (prev.completed) completedCount -= 1;
    }

    ratingSum += rating;
    ratingCount += 1;
    if (completed) completedCount += 1;

    // Guard against drift from any pre-existing bad data.
    ratingSum = Math.max(0, ratingSum);
    ratingCount = Math.max(0, ratingCount);
    completedCount = Math.max(0, completedCount);

    txn.set(reviewRef, {
      userId,
      rating,
      completed,
      feedback: feedback.trim(),
      createdAt: serverTimestamp(),
    });

    txn.update(rideRef, {
      ratingSum,
      ratingCount,
      ratingAvg:
        ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 100) / 100 : 0,
      completedCount,
      lastReviewedAt: serverTimestamp(),
    });
  });
}
