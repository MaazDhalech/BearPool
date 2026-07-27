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
  // Per-test timeout wraps fixture setup too, including app install (up to
  // installTimeout below, 3min) and — for the first test in the run only —
  // waiting through Metro's cold bundle transform (confirmed via Metro's own
  // log: 186s for 3545 modules the first time; every subsequent login in the
  // same run reuses the warm cache and takes under 2s). 10min leaves
  // headroom for install + a slow first bundle + the actual test steps.
  timeout: 10 * 60_000,
  // The underlying mobilecli agent occasionally fails device allocation with
  // "timed out waiting for WebDriverAgent to be ready" — a cold-start/
  // resource-contention issue in third-party native tooling outside this
  // repo's control, not a real app or test bug. Retrying is the standard
  // mitigation for this class of CI-only device flakiness.
  retries: process.env.CI ? 2 : 0,
  bundleId: "com.rebu.bearpool",
  // Dumps the full accessibility tree (identifiers, visibility, bounds) as a
  // JSON attachment whenever a test fails, alongside the screenshot. Needed
  // to see what mobilewright's driver actually resolves testIDs to — a
  // screenshot alone can't tell us whether an element mobilewright can't
  // find is actually absent from the tree, present but marked not-visible,
  // or matched against the wrong node.
  viewTree: "on-failure",
  // The app under test is now a dev-client build (see eas.json's "e2e"
  // profile) that loads its JS from a locally-running Metro server rather
  // than a bundle baked into the binary — this lets CI skip a native rebuild
  // on JS-only PRs. It connects to Metro by tapping the auto-detected server
  // on expo-dev-launcher's native launcher screen — see utils/login.ts for
  // why. The Boot iOS simulator CI step only boots one simulator, so this
  // only works correctly with exactly one worker.
  workers: 1,
  // Avoids a redundant extra terminate+launch cycle on top of the one every
  // spec already does itself in utils/login.ts.
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
        // Default is 20s. Generous headroom in case a cold launch is slow
        // to reach the foreground on a loaded CI runner.
        appLaunchTimeout: 2 * 60_000,
      },
    },
  ],
});
