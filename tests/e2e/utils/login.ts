import { execFileSync } from "node:child_process";
import type { Device, Screen } from "@mobilewright/core";

/**
 * Suppresses expo-dev-client's one-time "This is the developer menu"
 * onboarding popup, which otherwise renders on top of the app on its first
 * successful Metro connection and blocks all interaction until dismissed
 * (confirmed via an actual failure screenshot from a CI run's mobilewright
 * report — it showed the real Login screen fully and correctly loaded
 * underneath the popup). Traced the actual mechanism through expo-dev-menu's
 * source (node_modules/expo-dev-menu/ios/Modules/DevMenuPreferences.swift):
 * it's gated on a plain UserDefaults boolean, key
 * "EXDevMenuIsOnboardingFinished", scoped to the app's own bundle ID.
 *
 * Must run after the app has been installed at least once (its sandboxed
 * preferences container doesn't exist before that) — Mobilewright's device
 * fixture handles installation before any test body runs, so by the time
 * this is called from within a test it's always safe. Idempotent and cheap,
 * so no need to guard against calling it more than once per run.
 */
function disableDevMenuOnboarding(bundleId: string): void {
  execFileSync("xcrun", [
    "simctl",
    "spawn",
    "booted",
    "defaults",
    "write",
    bundleId,
    "EXDevMenuIsOnboardingFinished",
    "-bool",
    "YES",
  ]);
}

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
 * A cold launch lands on expo-dev-launcher's native "Development servers"
 * screen, which auto-discovers CI's Metro server and lists it (confirmed via
 * an actual screenshot from a failed run's report — it showed
 * "http://localhost:8081" listed with a green "reachable" indicator) but
 * doesn't auto-connect to it; tap that row, same as a developer would
 * manually. Two other mechanisms were tried and abandoned: a runtime
 * `expo-development-client://` deep link, and baking a default-launch-URL
 * into Info.plist at build time (via app.config.js's expo-dev-client plugin
 * config, or later a direct PlistBuddy injection) — both were eventually
 * confirmed pointless because the actual DEV_CLIENT_DEFAULT_LAUNCHER_URL
 * feature doesn't exist in the expo-dev-launcher version this repo has
 * installed (verified by grepping node_modules/expo-dev-launcher/ios
 * directly — zero matches). Once tapped, expo-dev-launcher remembers the
 * connection for subsequent cold launches within the same simulator
 * session, so this only actually taps anything on the very first login.
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
  disableDevMenuOnboarding(bundleId);

  await device.terminateApp(bundleId).catch(() => {});
  await device.launchApp(bundleId);

  const devServerRow = screen.getByText("http://localhost:8081");
  if (await devServerRow.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await devServerRow.tap();
  }

  // First render after connecting to Metro requires a full cold bundle
  // transform (confirmed via Metro's own log: up to ~186s for 3545 modules
  // on the very first request in CI), so wait well beyond that rather than
  // letting fill()'s short default timeout — or an insufficiently generous
  // one — fail before the bundle is even ready. Subsequent logins within
  // the same run reuse Metro's warm cache and are fast (under 2s).
  const loginEmailInput = screen.getByTestId("login-email-input");
  await loginEmailInput.waitFor({ state: "visible", timeout: 240_000 });
  await loginEmailInput.fill(email);
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
