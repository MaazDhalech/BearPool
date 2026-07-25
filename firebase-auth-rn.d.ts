// `firebase/auth`'s package.json has no conditional `exports` map, so its
// typings always resolve to the web build regardless of platform — the web
// build's public API doesn't include `getReactNativePersistence`, even
// though it exists at runtime (React Native's Metro resolver picks the
// correct platform-specific build). This augments the module so the type
// matches what's actually available at runtime, per Firebase's documented
// React Native setup: https://firebase.google.com/docs/auth/web/react-native
import type { Persistence, ReactNativeAsyncStorage } from "firebase/auth";

declare module "firebase/auth" {
  export function getReactNativePersistence(
    storage: ReactNativeAsyncStorage,
  ): Persistence;
}
