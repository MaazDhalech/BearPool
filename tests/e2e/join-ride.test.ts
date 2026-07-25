// Covers ONBOARDING.md §10 "Joining and leaving" -> join a ride (golden
// path only; leaving and gender-restriction blocking are not scripted here).
//
// Joining requires a ride posted by someone else, so this test uses a
// second test account (E2E_TEST_EMAIL_2 / E2E_TEST_PASSWORD_2) to host the
// ride, then joins it with the primary account. This also mirrors how
// joining works in the real app — you can't meaningfully join your own ride.
//
// Required env vars:
//   E2E_TEST_EMAIL    / E2E_TEST_PASSWORD    - primary account (joins)
//   E2E_TEST_EMAIL_2  / E2E_TEST_PASSWORD_2  - secondary account (hosts)
import { test, expect } from "@mobilewright/test";
import { loginWithEmail, requireCreds } from "./utils/login";
import { postRide } from "./utils/postRide";
import { deleteRideByDestination } from "./utils/cleanup";

test.use({ bundleId: "com.rebu.bearpool" });

test("can join a ride posted by another account", async ({
  device,
  screen,
  bundleId,
}) => {
  const host = requireCreds("E2E_TEST_EMAIL_2", "E2E_TEST_PASSWORD_2");
  const joiner = requireCreds("E2E_TEST_EMAIL", "E2E_TEST_PASSWORD");
  const destination = `E2E Join Test ${Date.now()}`;

  try {
    // --- Host posts a ride ---
    await loginWithEmail(device, screen, bundleId!, host.email, host.password);
    await postRide(screen, { from: "Berkeley - Unit 1", to: destination });
    await expect(screen.getByText(destination)).toBeVisible();

    // --- Joiner logs in, finds the ride via search, and joins it ---
    await loginWithEmail(device, screen, bundleId!, joiner.email, joiner.password);
    await screen.getByTestId("home-search-input").fill(destination);
    await screen.getByText(destination).tap();
    await screen.getByTestId("join-ride-button").tap();

    // The ride-details CTA flips from "Join Ride" to "Open Chat" once you're a
    // member — the most reliable signal that the join went through, without
    // knowing the joining account's Firestore uid up front to target a
    // specific row in the member list directly.
    await expect(screen.getByTestId("open-chat-button")).toBeVisible();
    await expect(screen.getByTestId("ride-member-list")).toBeVisible();
  } finally {
    // Deleted by the host account — firestore.rules allows any signed-in
    // user to delete any ride, but using the host keeps this consistent
    // with the other specs' cleanup.
    await deleteRideByDestination(host.email, host.password, destination);
  }
});
