import type { Device, Screen } from "@mobilewright/core";

/**
 * Shared login helper used by the post-ride, join-ride, and chat specs.
 *
 * Terminates + relaunches the app (so each test starts from a known state),
 * signs in with the given email/password on the Login screen, and waits for
 * the home feed to appear.
 *
 * The app under test is a dev-client build (eas.json's "e2e" profile) that
 * loads JS from a Metro server started by CI instead of a bundle baked into
 * the binary — this lets CI reuse a cached native build across JS-only PRs.
 * It connects to that Metro server on every cold launch via
 * expo-dev-client's defaultLaunchURL, baked in at build time from
 * app.config.js's E2E_METRO_URL (see there for why: a prior runtime
 * deep-link-based approach proved unreliable — Metro's own log never showed
 * a single incoming bundle request across several attempts). So a plain
 * launchApp() is all that's needed here; no deep link required.
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
  await device.terminateApp(bundleId).catch(() => {});
  await device.launchApp(bundleId);

  // First render after a fresh Metro connect can take well over the default
  // 5s action timeout while the bundle transforms, so wait explicitly
  // before interacting rather than letting fill()'s short default wait fail.
  await screen.getByTestId("login-email-input").waitFor({ state: "visible", timeout: 90_000 });
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
