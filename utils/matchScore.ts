// utils/matchScore.ts
//
// Ride Match Scoring
// ------------------
// Given a user's saved preferences, this gives every ride a score from 0 to 100
// for how well it fits that user. The home feed can then sort by this score so
// the rides a person is most likely to want float to the top.
//
// We score on three signals:
//   1. Departure time  — how close the ride leaves to the user's preferred time
//   2. Destination     — does the ride go where the user usually goes
//   3. Seats available  — rides with open seats are more useful than full ones
//
// Each signal produces a 0..1 sub-score. We combine them with weights that add
// up to 1, then multiply by 100 for a friendly number. Tuning the weights later
// (based on which rides actually get joined) is exactly the "tune a recommender
// on real behavior" story that makes this a strong portfolio piece.

// ---- The shape of a user's saved preferences ----
export type MatchPreferences = {
  // "HH:MM" in 24-hour form, e.g. "08:30" or "17:00". Optional — user may skip it.
  preferredDepartureTime?: string | null;
  // A place the user usually heads to, e.g. "SFO" or "Downtown Berkeley". Optional.
  usualDestination?: string | null;
};

// ---- The slice of a ride we need to score it ----
// (Matches the field names already used in app/(tabs)/index.tsx)
export type ScorableRide = {
  to: string;
  date: string; // e.g. "January 16"
  time: string; // e.g. "3:30 PM"
  seats: number;
};

// ---- Weights: how much each signal matters. Must sum to 1. ----
// These are the knobs you tune later. Start with time mattering most.
export const WEIGHTS = {
  time: 0.5,
  destination: 0.35,
  seats: 0.15,
};

// Convert a "3:30 PM" style string into minutes-since-midnight (0..1439).
// Returns null if it can't be parsed.
function timeStringToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();

  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

// Convert a "HH:MM" 24-hour preference into minutes-since-midnight.
function prefTimeToMinutes(pref: string): number | null {
  const match = pref.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

// --- Sub-score 1: departure time closeness (0..1) ---
// 1.0 = exact match. Falls off smoothly the further apart the times are.
// We treat "3 hours off" as basically no match.
function timeScore(ride: ScorableRide, prefs: MatchPreferences): number {
  if (!prefs.preferredDepartureTime) return 0.5; // no preference = neutral
  const rideMinutes = timeStringToMinutes(ride.time);
  const prefMinutes = prefTimeToMinutes(prefs.preferredDepartureTime);
  if (rideMinutes === null || prefMinutes === null) return 0.5;

  // Difference in minutes, accounting for the clock wrapping around midnight.
  let diff = Math.abs(rideMinutes - prefMinutes);
  diff = Math.min(diff, 1440 - diff);

  const MAX_DIFF = 180; // 3 hours = score floor
  if (diff >= MAX_DIFF) return 0;
  return 1 - diff / MAX_DIFF;
}

// --- Sub-score 2: destination match (0..1) ---
// Simple, readable text matching: exact-ish match scores high, a partial
// (one contains the other) scores medium, otherwise low.
function destinationScore(ride: ScorableRide, prefs: MatchPreferences): number {
  if (!prefs.usualDestination) return 0.5; // no preference = neutral
  const rideTo = ride.to.trim().toLowerCase();
  const pref = prefs.usualDestination.trim().toLowerCase();
  if (!rideTo || !pref) return 0.5;

  if (rideTo === pref) return 1;
  if (rideTo.includes(pref) || pref.includes(rideTo)) return 0.75;

  // Light word-overlap check so "SFO Terminal 2" still matches "SFO".
  const rideWords = new Set(rideTo.split(/\s+/));
  const prefWords = pref.split(/\s+/);
  const overlap = prefWords.filter((w) => rideWords.has(w)).length;
  if (overlap > 0) return 0.5;

  return 0.1;
}

// --- Sub-score 3: seat availability (0..1) ---
// More open seats = more likely you can actually get in. Caps out at 4 seats.
function seatsScore(ride: ScorableRide): number {
  const seats = ride.seats ?? 0;
  if (seats <= 0) return 0;
  return Math.min(seats, 4) / 4;
}

// ---- The main function the feed calls ----
// Returns a number from 0 to 100.
export function matchScore(
  ride: ScorableRide,
  prefs: MatchPreferences,
): number {
  // If the user has set NO preferences at all, everything is equally "neutral".
  const hasAnyPref =
    !!prefs.preferredDepartureTime || !!prefs.usualDestination;
  if (!hasAnyPref) return 50;

  const t = timeScore(ride, prefs);
  const d = destinationScore(ride, prefs);
  const s = seatsScore(ride);

  const combined =
    t * WEIGHTS.time + d * WEIGHTS.destination + s * WEIGHTS.seats;

  return Math.round(combined * 100);
}