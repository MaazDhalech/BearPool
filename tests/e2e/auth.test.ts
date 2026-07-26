// Covers ONBOARDING.md §10 "Auth flows" -> log out / log back in with
// email + password (golden path only). Signup + email verification is
// intentionally NOT scripted here: it requires a real @berkeley.edu inbox,
// which CI does not have. This assumes a pre-existing, already-verified
// test account.
//
// Required env vars (set as GitHub Actions secrets in CI):
//   E2E_TEST_EMAIL    - email of an existing, verified BearPool test account
//   E2E_TEST_PASSWORD - password for that account
import { test, expect } from "@mobilewright/test";
import { loginWithEmail, requireCreds } from "./utils/login";

test.use({ bundleId: "com.rebu.bearpool" });

test("can log in with email/password and lands on the home feed", async ({
  device,
  screen,
  bundleId,
}) => {
  const { email, password } = requireCreds("E2E_TEST_EMAIL", "E2E_TEST_PASSWORD");

  await loginWithEmail(device, screen, bundleId!, email, password);

  await expect(screen.getByText("Home")).toBeVisible();
});
