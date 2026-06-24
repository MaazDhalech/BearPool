// Central AdMob configuration and helpers.
//
// AdMob app + unit IDs live here so the rest of the app never hard-codes them.
// In development we always fall back to Google's official TEST unit IDs — using
// the real units in dev risks invalid-traffic strikes on the AdMob account.
// Android is not shipped yet (iOS-only release), so Android resolves to test IDs.

import { Platform } from "react-native";
import mobileAds, {
  AdEventType,
  InterstitialAd,
  MaxAdContentRating,
  TestIds,
} from "react-native-google-mobile-ads";

// Real production unit IDs (iOS).
const PROD_BANNER_IOS = "ca-app-pub-3671007839721369/6530242145";
const PROD_INTERSTITIAL_IOS = "ca-app-pub-3671007839721369/5453798349";

export const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : Platform.select({ ios: PROD_BANNER_IOS, default: TestIds.BANNER })!;

export const INTERSTITIAL_AD_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : Platform.select({ ios: PROD_INTERSTITIAL_IOS, default: TestIds.INTERSTITIAL })!;

// We request non-personalized ads everywhere so we stay compliant without
// shipping a full UMP/ATT consent flow yet.
export const AD_REQUEST_OPTIONS = { requestNonPersonalizedAdsOnly: true };

let initialized = false;

/** Initialize the Mobile Ads SDK once at app startup. Safe to call repeatedly. */
export async function initializeAds(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: MaxAdContentRating.PG,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
    await mobileAds().initialize();
    preloadInterstitial();
  } catch (err) {
    // Never let ad init crash or block the app.
    console.warn("[ads] initialization failed", err);
  }
}

// ─── Interstitial manager ──────────────────────────────────────────────────
// One reusable interstitial that auto-reloads after each show, with a hard
// frequency cap so we never interrupt the core flow more than once per window.

const MIN_INTERSTITIAL_INTERVAL_MS = 90 * 1000; // at most one per 90s
let interstitial: InterstitialAd | null = null;
let interstitialLoaded = false;
let lastShownAt = 0;

function ensureInterstitial(): void {
  if (interstitial) return;
  interstitial = InterstitialAd.createForAdRequest(
    INTERSTITIAL_AD_UNIT_ID,
    AD_REQUEST_OPTIONS,
  );
  interstitial.addAdEventListener(AdEventType.LOADED, () => {
    interstitialLoaded = true;
  });
  interstitial.addAdEventListener(AdEventType.CLOSED, () => {
    interstitialLoaded = false;
    interstitial?.load(); // preload the next one
  });
  interstitial.addAdEventListener(AdEventType.ERROR, () => {
    interstitialLoaded = false;
  });
}

/** Begin loading an interstitial so it is ready by the next natural break. */
export function preloadInterstitial(): void {
  ensureInterstitial();
  if (!interstitialLoaded) {
    try {
      interstitial!.load();
    } catch (err) {
      console.warn("[ads] interstitial load failed", err);
    }
  }
}

/**
 * Show an interstitial at a natural break, then run `onDone`. If no ad is ready
 * or we're inside the frequency-cap window, `onDone` runs immediately so the
 * user's navigation is never blocked.
 */
export function showInterstitial(onDone?: () => void): void {
  ensureInterstitial();
  const now = Date.now();
  const withinCooldown = now - lastShownAt < MIN_INTERSTITIAL_INTERVAL_MS;

  if (!interstitialLoaded || withinCooldown) {
    preloadInterstitial();
    onDone?.();
    return;
  }

  lastShownAt = now;
  const unsubscribe = interstitial!.addAdEventListener(AdEventType.CLOSED, () => {
    unsubscribe();
    onDone?.();
  });

  try {
    interstitial!.show();
  } catch (err) {
    console.warn("[ads] interstitial show failed", err);
    unsubscribe();
    onDone?.();
  }
}
