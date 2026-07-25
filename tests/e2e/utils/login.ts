import { execFileSync } from "node:child_process";
import type { Device, Screen } from "@mobilewright/core";

/**
 * The app under test is a dev-client build (eas.json's "e2e" profile) that
 * loads JS from a Metro server started by CI, instead of a bundle baked into
 * the binary — this lets CI reuse a cached native build across JS-only PRs
 * instead of rebuilding every time. A dev client doesn't know where Metro is
 * until it's told via this one-time deep link; after that it persists the
 * URL and reconnects automatically on subsequent cold launches within the
 * same simulator session, so this only needs to run once per test run.
 *
 * No-ops when MOBILEWRIGHT_METRO_URL isn't set (e.g. local runs against a
 * non-dev-client build), and assumes exactly one simulator is booted, which
 * mobilewright.config.ts enforces via `workers: 1`.
 */
let devClientConnected = false;

export function connectDevClientToMetro(): void {
  if (devClientConnected) return;
  devClientConnected = true;

  const metroUrl = process.env.MOBILEWRIGHT_METRO_URL;
  if (!metroUrl) return;

  const deepLink = `bearpool://expo-development-client/?url=${encodeURIComponent(metroUrl)}`;
  execFileSync("xcrun", ["simctl", "openurl", "booted", deepLink]);
}

/**
 * Shared login helper used by the post-ride, join-ride, and chat specs.
 *
 * Terminates + relaunches the app (so each test starts from a known state),
 * signs in with the given email/password on the Login screen, and waits for
 * the home feed to appear.
 *
 * NOTE: this assumes the app has no persisted Firebase Auth session when it
 * launches (true for a freshly-installed CI build). If a session is retained
 * between runs on a reused simulator, the app will land directly on the home
 * feed instead of the Login screen and the fill/tap steps below will simply
 * no-op against a screen that's no longer there — see BEAR-40 notes.
 */
export async function loginWithEmail(
  device: Device,
  screen: Screen,
  bundleId: string,
  email: string,
  password: string,
): Promise<void> {
  connectDevClientToMetro();

  await device.terminateApp(bundleId).catch(() => {});
  await device.launchApp(bundleId);

  await screen.getByTestId("login-email-input").fill(email);
  await screen.getByTestId("login-password-input").fill(password);
  await screen.getByTestId("login-submit-button").tap();

  await screen.getByTestId("home-feed-screen").waitFor({ state: "visible" });
}

/** Reads required env vars for a numbered test account, throwing a clear error if missing. */
export function requireCreds(emailVar: string, passwordVar: string): { email: string; password: string } {
  const email = process.env[emailVar];
  const password = process.env[passwordVar];
  if (!email || !password) {
    throw new Error(`${emailVar} and ${passwordVar} must be set to run this test.`);
  }
  return { email, password };
}
