import type { Device, Screen } from "@mobilewright/core";

/**
 * Launches the app, connecting a dev-client build (eas.json's "e2e" profile,
 * which loads JS from a Metro server started by CI instead of a bundle baked
 * into the binary) to that Metro server via a one-time-per-launch deep link.
 * Falls through to a plain launch when MOBILEWRIGHT_METRO_URL isn't set
 * (e.g. local runs against a non-dev-client build).
 *
 * The deep link MUST be what performs the launch — it cannot be sent to an
 * already-running app. Per expo-dev-launcher's iOS source
 * (EXDevLauncherController._handleExternalDeepLink), the dev launcher only
 * treats this URL as a "load this Metro project" command when the app isn't
 * already running; if it's already running (isReactInstanceValid), the URL
 * is instead forwarded to the app via the normal Linking API as a plain
 * external deep link and silently does nothing useful. This is why a prior
 * version of this code — which called device.launchApp() and then sent the
 * deep link afterward — never actually connected to Metro at all (confirmed
 * by Metro's own log showing zero incoming bundle requests across an entire
 * run): by the time the link arrived, the dev launcher's React instance was
 * already alive. The caller must terminate the app first; this function
 * does the (re)launch via device.openUrl, never device.launchApp, when a
 * Metro URL is configured.
 */
export async function launchAppConnectedToMetro(device: Device, bundleId: string): Promise<void> {
  const metroUrl = process.env.MOBILEWRIGHT_METRO_URL;
  if (!metroUrl) {
    await device.launchApp(bundleId);
    return;
  }

  const deepLink = `bearpool://expo-development-client/?url=${encodeURIComponent(metroUrl)}`;
  await device.openUrl(deepLink);
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
  await device.terminateApp(bundleId).catch(() => {});
  await launchAppConnectedToMetro(device, bundleId);

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
