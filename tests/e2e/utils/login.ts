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
 * A cold launch lands on expo-dev-launcher's native "Development servers"
 * screen, which auto-discovers CI's Metro server and lists it (confirmed via
 * an actual screenshot from a failed run's report — it showed
 * "http://localhost:8081" listed with a green "reachable" indicator) but
 * doesn't auto-connect to it; tap that row, same as a developer would
 * manually. Two prior mechanisms were tried and abandoned: a runtime
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
  await device.terminateApp(bundleId).catch(() => {});
  await device.launchApp(bundleId);

  const devServerRow = screen.getByText("http://localhost:8081");
  if (await devServerRow.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await devServerRow.tap();
  }

  // The very first successful connection triggers Expo's one-time "This is
  // the developer menu" onboarding popup, rendered on top of the (correctly
  // loaded) Login screen underneath it — confirmed via an actual failure
  // screenshot. It only appears once the JS bundle has fully rendered, which
  // can take a while on a cold Metro cache (confirmed via Metro's own log:
  // up to ~186s for 3545 modules on the very first request in CI) — but on
  // every other login in the same run it never reappears at all. Rather
  // than a single fixed wait that's either too short for a slow first
  // bundle or wastefully long on every other login, poll for whichever of
  // the popup or the login screen itself appears first, dismissing the
  // popup the moment it shows up.
  const loginEmailInput = screen.getByTestId("login-email-input");
  const devMenuContinueButton = screen.getByText("Continue");
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    if (await devMenuContinueButton.isVisible({ timeout: 500 }).catch(() => false)) {
      await devMenuContinueButton.tap();
      break;
    }
    if (await loginEmailInput.isVisible({ timeout: 500 }).catch(() => false)) {
      break;
    }
  }

  // Safety-net wait: fast in practice at this point (bundle's already
  // loaded and any onboarding popup dismissed), just confirms we didn't
  // exit the loop above via the deadline.
  await loginEmailInput.waitFor({ state: "visible", timeout: 30_000 });
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
