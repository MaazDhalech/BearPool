// Covers ONBOARDING.md §10 "Posting a ride" -> fill in all fields, submit,
// ride appears in the feed (golden path only; missing-field validation,
// editing, and deleting a posted ride are not scripted here).
//
// Required env vars:
//   E2E_TEST_EMAIL    / E2E_TEST_PASSWORD
import { test, expect } from "@mobilewright/test";
import { loginWithEmail, requireCreds } from "./utils/login";
import { postRide } from "./utils/postRide";

test.use({ bundleId: "com.rebu.bearpool" });

test("can post a ride and see it appear in the feed", async ({
  device,
  screen,
  bundleId,
}) => {
  const { email, password } = requireCreds("E2E_TEST_EMAIL", "E2E_TEST_PASSWORD");
  await loginWithEmail(device, screen, bundleId!, email, password);

  // Unique destination so we can unambiguously find this ride in the feed
  // afterwards, even if other rides already exist.
  const destination = `E2E Test Dest ${Date.now()}`;
  await postRide(screen, { from: "Berkeley - Unit 1", to: destination });

  await expect(screen.getByTestId("home-feed-screen")).toBeVisible();
  await expect(screen.getByText(destination)).toBeVisible();
});
