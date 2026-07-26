import { defineConfig } from "mobilewright";

// Mobilewright E2E config for BearPool (BEAR-40).
//
// Scripts the "Core flows to test" checklist from ONBOARDING.md section 10
// (auth, home feed, posting a ride, joining a ride, chat) so they can run in
// CI instead of only manually. iOS only for now — Android is out of scope
// for BEAR-40.
//
// The .app/.zip under test is built by CI (EAS build --local or an EAS
// simulator build) and its path is passed in via MOBILEWRIGHT_IOS_APP_PATH.
// For local development, point that env var at a simulator build you've
// produced with `eas build --platform ios --profile <sim-profile> --local`,
// or run `expo run:ios` once and set it to the resulting .app under
// ios/build/Build/Products/*-iphonesimulator/BearPool.app.
export default defineConfig({
  testDir: "./tests/e2e",
  // Per-test timeout wraps fixture setup too, including app install — must
  // stay comfortably above installTimeout below (3min) or every test times
  // out mid-install before it ever gets to run. 5min leaves ~2min headroom
  // for the actual test steps after a slow dev-client install.
  timeout: 5 * 60_000,
  bundleId: "com.rebu.bearpool",
  // The app under test is now a dev-client build (see eas.json's "e2e"
  // profile) that loads its JS from a locally-running Metro server rather
  // than a bundle baked into the binary — this lets CI skip a native rebuild
  // on JS-only PRs. Connecting the dev client to Metro requires launching it
  // via a deep link (tests/e2e/utils/login.ts's launchAppConnectedToMetro),
  // so this only works correctly with exactly one simulator/worker at a time
  // (the deep link targets whichever device the test fixture allocated).
  workers: 1,
  // The device fixture auto-launches the app (plain, no Metro connection)
  // before every test body runs — this raced against our own
  // terminate+deep-link-launch in loginWithEmail and was silently
  // discarding the deep link (a dev client only honors it as a "load this
  // Metro project" command when not already running). We control launching
  // ourselves in every spec, so disable the fixture's redundant auto-launch.
  autoAppLaunch: false,
  projects: [
    {
      name: "ios",
      use: {
        platform: "ios",
        deviceName: /iPhone/,
        installApps:
          process.env.MOBILEWRIGHT_IOS_APP_PATH ?? "./builds/ios/BearPool.app",
        installTimeout: 3 * 60_000,
        // Applies to the plain device.launchApp() fallback path only (no
        // MOBILEWRIGHT_METRO_URL set, e.g. local runs) — the deep-link path
        // uses device.openUrl(), which doesn't do this foreground poll at
        // all. Default is 20s, which wouldn't be enough for a dev-client
        // build's first launch fetching/transforming JS from a cold Metro
        // server.
        appLaunchTimeout: 2 * 60_000,
      },
    },
  ],
});
