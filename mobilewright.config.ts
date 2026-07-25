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
  timeout: 120_000,
  bundleId: "com.rebu.bearpool",
  projects: [
    {
      name: "ios",
      use: {
        platform: "ios",
        deviceName: /iPhone/,
        installApps:
          process.env.MOBILEWRIGHT_IOS_APP_PATH ?? "./builds/ios/BearPool.app",
        installTimeout: 3 * 60_000,
      },
    },
  ],
});
