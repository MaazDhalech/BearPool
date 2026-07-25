// Covers ONBOARDING.md §10 "Chat" -> open a joined ride's chat and send a
// message (golden path only; multi-device real-time sync, scroll-to-latest,
// keyboard/FAB behavior, and profanity filtering are not scripted here).
//
// Required env vars:
//   E2E_TEST_EMAIL    / E2E_TEST_PASSWORD
import { test, expect } from "@mobilewright/test";
import { loginWithEmail, requireCreds } from "./utils/login";
import { postRide } from "./utils/postRide";
import { deleteRideByDestination } from "./utils/cleanup";

test.use({ bundleId: "com.rebu.bearpool" });

test("can send a chat message in a joined ride", async ({
  device,
  screen,
  bundleId,
}) => {
  const { email, password } = requireCreds("E2E_TEST_EMAIL", "E2E_TEST_PASSWORD");
  await loginWithEmail(device, screen, bundleId!, email, password);

  // Post a ride so there's a chat we're guaranteed to be a member of — the
  // host is auto-added to memberIds when a ride is created.
  const destination = `E2E Chat Test ${Date.now()}`;
  try {
    await postRide(screen, { from: "Berkeley - Unit 1", to: destination });

    await screen.getByText(destination).tap();
    await screen.getByTestId("open-chat-button").tap();

    const message = `Hello from mobilewright ${Date.now()}`;
    await screen.getByTestId("chat-message-input").fill(message);
    await screen.getByTestId("chat-send-button").tap();

    await expect(screen.getByTestId("chat-message-list")).toBeVisible();
    await expect(screen.getByText(message)).toBeVisible();
  } finally {
    await deleteRideByDestination(email, password, destination);
  }
});
