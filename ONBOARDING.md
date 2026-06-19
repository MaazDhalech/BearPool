# BearPool — Developer Onboarding Guide

Welcome to BearPool, a UC Berkeley-exclusive rideshare coordination app for iOS and Android.
This guide assumes you have never built a mobile app before and walks you through everything
from setting up your machine to running and testing the app.

---

## Table of Contents

1. [What is this app?](#1-what-is-this-app)
2. [How mobile app development works (the mental model)](#2-how-mobile-app-development-works)
3. [Prerequisites — tools to install](#3-prerequisites)
4. [Clone and install dependencies](#4-clone-and-install-dependencies)
5. [Environment variables](#5-environment-variables)
6. [Understanding Expo — the core tool](#6-understanding-expo)
7. [Running the app for the first time](#7-running-the-app-for-the-first-time)
8. [Project structure walkthrough](#8-project-structure-walkthrough)
9. [Key concepts in the codebase](#9-key-concepts-in-the-codebase)
10. [Testing guide](#10-testing-guide)
11. [Making a change — end-to-end workflow](#11-making-a-change-end-to-end-workflow)
12. [Building for distribution (EAS)](#12-building-for-distribution-eas)
13. [Common problems and fixes](#13-common-problems-and-fixes)

---

## 1. What is this app?

BearPool is a rideshare coordination app restricted to `@berkeley.edu` email addresses.
Users can post rides, join rides, and chat with ride members in real time.

**Tech summary:**
- Written in **TypeScript** (typed JavaScript)
- Built with **React Native** (write once, runs on iOS and Android)
- Uses **Expo** to simplify the React Native toolchain
- Backend is **Firebase** (database, authentication, cloud functions)
- No traditional server — Firebase handles everything server-side

---

## 2. How Mobile App Development Works

### The big picture

Unlike a website, a mobile app must be compiled into a binary (`.ipa` for iOS, `.apk` for Android)
and either installed on a physical device or run inside a **simulator/emulator**.

### The normal web dev → mobile dev translation

| Web concept | Mobile equivalent |
|---|---|
| Browser | iOS Simulator / Android Emulator / physical device |
| `localhost:3000` | The app running on device (no URL bar) |
| HTML `<div>`, `<p>` | React Native `<View>`, `<Text>` |
| CSS | StyleSheet objects or Tailwind-like classes (NativeWind) |
| `npm run dev` | `npx expo start` |
| Browser DevTools | Expo Dev Tools + React DevTools |

### Why Expo?

Without Expo, setting up React Native requires Xcode, Android Studio, CocoaPods, Java,
Gradle, and days of configuration. Expo wraps all of that and gives you:

- **Expo Go** — a pre-built app you install from the App Store. It can load your code
  over Wi-Fi without needing a full build.
- **Development builds** — a custom version of Expo Go compiled with your specific
  native dependencies (needed for this project because we use Firebase native modules).
- **EAS (Expo Application Services)** — cloud build and distribution service. You push
  code, EAS builds the binary in the cloud, no local Xcode required.

---

## 3. Prerequisites

Install these in order. Each section links to the official installer.

### 3.1 Node.js (JavaScript runtime)

Download and install **Node.js 22 LTS** from https://nodejs.org.

Verify:
```bash
node --version   # should print v22.x.x
npm --version    # should print 10.x.x
```

### 3.2 Git

macOS ships with git. Verify:
```bash
git --version
```

If missing, install Xcode Command Line Tools:
```bash
xcode-select --install
```

### 3.3 Expo CLI and EAS CLI

```bash
npm install -g expo-cli eas-cli
```

Verify:
```bash
expo --version
eas --version
```

### 3.4 An Expo account

Go to https://expo.dev and create a free account.
Then log in from your terminal:
```bash
eas login
```

### 3.5 For iOS testing on a simulator (Mac only)

Install **Xcode** from the Mac App Store (it's large — ~15 GB, allow 30+ minutes).
After installing, open Xcode once to accept the license, then install simulators:

```
Xcode → Settings → Platforms → iOS → Download
```

Install the **iPhone 16** simulator (or any recent model).

### 3.6 For iOS testing on a physical device (optional but preferred)

You need an **Apple Developer account** (free tier works for development).
The team lead will need to register your device's UDID in the EAS project —
ask them to do this before you try to install a dev build.

---

## 4. Clone and Install Dependencies

```bash
git clone <repo-url> BearPool
cd BearPool
npm install
```

`npm install` reads `package.json` and downloads ~300 MB of JavaScript packages into
`node_modules/`. This is normal. Never commit `node_modules/`.

---

## 5. Environment Variables

The app connects to Firebase using secret API keys. These are **not** committed to git.
You need a `.env` file in the project root.

Ask the team lead for the `.env` file contents. It should contain these keys:

```
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=
FIREBASE_MEASUREMENT_ID=
GOOGLE_IOS_CLIENT_ID=
GOOGLE_WEB_CLIENT_ID=
WEB3FORMS_API_KEY=
```

Place the populated `.env` file at `/BearPool/.env` (same level as `package.json`).
The app reads these at build time via `app.config.js`.

---

## 6. Understanding Expo

### Expo SDK

The project uses **Expo SDK 54**. This is the version of the Expo toolkit. It pins
compatible versions of React Native (0.81.5) and React (19). You generally do not
change this unless doing a major upgrade.

### expo-router

Navigation (which screen shows when) is handled by **expo-router v6**, which uses
the **file system as the route map**. This is the same idea as Next.js:

```
app/
  (auth)/login.tsx       →  the Login screen (no URL, just a stack screen)
  (tabs)/index.tsx       →  the Home tab
  (stack)/ride/[id]/chat.tsx  →  the Chat screen for a specific ride (dynamic route)
```

Parentheses in folder names like `(auth)` are **route groups** — they group screens
without affecting the navigation path.

Square brackets like `[id]` are **dynamic segments** — the `id` part changes per ride.

### Expo Go vs. Development Build

| | Expo Go | Development Build |
|---|---|---|
| Install from | App Store | EAS (internal distribution) |
| Native modules | Only built-in Expo modules | Any npm package with native code |
| Required for this project? | **No** — Firebase needs a dev build | **Yes** |
| How to get | App Store search "Expo Go" | See Section 12 |

BearPool uses Firebase native modules, so you **must** use a development build,
not Expo Go.

---

## 7. Running the App for the First Time

### Option A — iOS Simulator (Mac only, no Apple account needed)

```bash
npx expo start --ios
```

This starts the **Metro bundler** (the dev server that serves your JavaScript to the
device) and opens the iOS Simulator. The first launch takes 1–2 minutes.

> **What is Metro?** Metro is the JavaScript bundler for React Native. It watches your
> files for changes and instantly sends updated code to the running app — this is called
> **Fast Refresh**. You do not need to rebuild the app for most code changes.

### Option B — Physical iPhone (requires a dev build installed)

```bash
npx expo start
```

Then scan the QR code that appears in your terminal with the **Camera app** on iPhone.
This only works if you have the BearPool development build installed (not Expo Go).

### Option C — Physical iPhone via USB (more reliable than Wi-Fi)

Connect your iPhone via USB cable, then:

```bash
npx expo start --localhost
```

Choose your device from the list Expo prints.

### What you should see

After a ~30 second bundle, the app launches showing a login screen with the BearPool
logo. You can sign up with any `@berkeley.edu` email address.

> **Note:** The app checks email domain on signup. If you want a test account that
> bypasses real email verification, ask the team lead for a test account credential.

---

## 8. Project Structure Walkthrough

```
BearPool/
├── app/                        # Every file here = a screen or layout
│   ├── _layout.tsx             # Root: providers, dark theme, deep link handler
│   ├── (auth)/                 # Screens shown before login
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   ├── Reset.tsx           # Password reset
│   │   ├── VerifyEmail.tsx
│   │   ├── Welcome.tsx         # Splash/landing
│   │   └── CompleteProfile.tsx # Profile setup after first sign-in
│   ├── (tabs)/                 # Bottom tab bar screens
│   │   ├── index.tsx           # Home feed (list of rides)
│   │   ├── chats.tsx           # All ride chats
│   │   ├── post.tsx            # Post a new ride
│   │   └── profile.tsx         # Your profile
│   └── (stack)/ride/[id]/      # Screens for a specific ride
│       ├── index.tsx           # Ride detail
│       ├── chat.tsx            # Real-time group chat
│       ├── edit.tsx            # Edit ride (driver only)
│       ├── group-settings.tsx  # Group management
│       └── viewProfile.tsx     # View another user's profile
│
├── components/                 # Reusable UI pieces
├── constants/
│   ├── Colors.ts               # Color palette (ACCENT = #3a7bd5, all dark theme)
│   ├── Typography.ts           # Font sizes and weights
│   └── Spacing.ts              # Spacing scale
├── hooks/                      # Custom React hooks
│   ├── useFirebaseAuth.ts      # Wraps Firebase Auth state
│   ├── usePushNotifications.ts
│   └── useNotificationOptInPrompt.ts
├── services/
│   └── firebaseConfig.ts       # Firebase initialization
├── functions/src/index.ts      # Firebase Cloud Functions (server-side)
├── assets/                     # Images, fonts
├── app.config.js               # Expo project config (reads from .env)
├── eas.json                    # EAS build profiles
├── package.json                # Dependencies and scripts
└── .env                        # Secret keys (never commit this)
```

---

## 9. Key Concepts in the Codebase

### State management

This app uses **no Redux or Zustand**. State is plain React `useState` hooks.
Real-time data comes from Firestore's `onSnapshot` listeners, which fire a callback
every time data changes in the database.

Pattern used throughout:

```typescript
useEffect(() => {
  const unsubscribe = onSnapshot(docRef, (snap) => {
    setData(snap.data());
  });
  return () => unsubscribe(); // cleanup when component unmounts
}, []);
```

### Firebase Auth

Authentication is handled by **Firebase Auth**. After login, `useFirebaseAuth()`
(from `hooks/useFirebaseAuth.ts`) gives you the current user object. The user's
Firebase `uid` is also their document ID in the Firestore `users` collection.

### Firestore database structure

```
rides/{rideId}
  messages/{messageId}          # Chat messages
  readState/{userId}            # Tracks last-read timestamp per user

users/{userId}                  # Profile, avatar (Base64 JPEG), push tokens

feedback/{id}                   # Post-ride star ratings
reports/{id}                    # Safety reports
config/appVersion               # Force-update gate
```

### Styling

Styles are written in two ways:

1. **StyleSheet.create()** — React Native's built-in inline style system (like CSS objects)
2. **NativeWind** — Tailwind CSS class names on components (e.g., `className="flex-1 bg-black"`)

The app is **dark theme only**. The core colors are defined in `constants/Colors.ts`.

### Navigation

To navigate between screens, use the `router` object from `expo-router`:

```typescript
import { router } from "expo-router";

router.push("/(stack)/ride/123/chat");  // go to chat screen for ride 123
router.back();                           // go back
```

---

## 10. Testing Guide

### Philosophy

BearPool has **no automated test suite** (no Jest unit tests, no Detox e2e tests).
All testing is manual, on-device or in the simulator.

### Setting up a test account

1. Sign up using a real `@berkeley.edu` email address (or ask for a shared test account)
2. Complete the profile setup (username, name, optional gender)
3. You can create additional test accounts to simulate multi-user scenarios

### Core flows to test after any change

Work through these in order — each depends on the one before it:

#### Auth flows
- [ ] Sign up with a new `@berkeley.edu` email → verify email → complete profile
- [ ] Log out → log back in with email/password
- [ ] Log in with Google (`@berkeley.edu` Google account)
- [ ] Log in with Apple ID
- [ ] Request a password reset → check email

#### Home feed
- [ ] Feed loads and shows rides
- [ ] Rides you've joined appear highlighted
- [ ] Tapping a ride opens the detail screen
- [ ] Pull-to-refresh works

#### Posting a ride
- [ ] Fill in all fields → submit → ride appears in feed
- [ ] Try submitting with missing required fields → should show validation errors
- [ ] Edit a ride you posted
- [ ] Delete a ride you posted

#### Joining and leaving
- [ ] Join a ride → you appear in the member list
- [ ] Leave a ride
- [ ] Try to join a gender-restricted ride with mismatched gender → should be blocked

#### Chat (most complex screen)
- [ ] Open chat for a joined ride → messages load
- [ ] Send a message → appears instantly
- [ ] Open the same chat on two devices/accounts simultaneously → messages appear on both in real time
- [ ] Scroll up in history → "Latest messages" button appears → tap it → snaps to bottom
- [ ] Keyboard appears → input bar lifts → FAB repositions above keyboard
- [ ] Send a profanity-filtered word → should be blocked

#### Notifications
- [ ] On a physical device (not simulator), join a ride
- [ ] Have another account send a message in that ride's chat
- [ ] A push notification should arrive within ~5 seconds

#### Unread badges
- [ ] Receive a message in a chat you're not currently viewing
- [ ] The Chats tab should show an unread indicator on that conversation
- [ ] Open the chat → indicator clears

### Testing on the simulator vs. physical device

| Feature | Simulator | Physical Device |
|---|---|---|
| UI/layout | ✅ Works | ✅ Works |
| Firebase read/write | ✅ Works | ✅ Works |
| Push notifications | ❌ Not supported | ✅ Required |
| Camera / photo picker | ⚠️ Limited | ✅ Works |
| Haptics | ❌ Silent | ✅ Works |
| Performance feel | ⚠️ Faster than real device | ✅ More accurate |

**Always test push notifications and camera on a real device before shipping.**

### Simulating multiple users

Open two simulator windows (File → Open Simulator → pick a different device model),
or use one simulator + one physical device. Log into different accounts on each.
This lets you test real-time features like chat and join/leave notifications.

### Checking the database directly

Go to https://console.firebase.google.com → select the BearPool project → Firestore Database.
You can read and manually edit any document here. Useful for:
- Verifying data was written correctly
- Resetting test state (e.g., deleting a test ride)
- Checking if a message was stored with the right fields

### Checking Cloud Function logs

Go to Firebase Console → Functions → Logs.
If push notifications aren't arriving, the logs here will show why.

### Checking push notification receipts

After a notification is sent, Expo logs delivery status to the `pushReceipts` Firestore
collection. Dead/invalid tokens are automatically cleaned up hourly by the
`checkPushReceipts` Cloud Function.

### Fast Refresh (hot reload)

While `npx expo start` is running, every time you save a file the app updates
**instantly** without losing state. You do not need to restart the app for:
- UI layout changes
- Style changes
- Logic changes in screen components

You **do** need to restart (press `r` in the terminal or shake the device → Reload) for:
- Changes to `app.config.js`
- Changes to native modules or `package.json`
- Any change that causes Fast Refresh to error out

### Reading the dev console

Shake the device (or press `m` in terminal for simulator) to open the **Expo Dev Menu**.
From there you can open **React DevTools** to inspect component trees and state.

`console.log()` output appears in the terminal where you ran `npx expo start`.

---

## 11. Making a Change — End-to-End Workflow

```
1. Pull the latest code
   git pull origin main

2. Create a feature branch
   git checkout -b feat/your-feature-name

3. Start the dev server
   npx expo start --ios   (or --android)

4. Edit files — Fast Refresh shows changes instantly

5. Test the change manually (see Section 10)

6. Commit
   git add <specific files>
   git commit -m "feat: short description of what and why"

7. Push and open a pull request
   git push origin feat/your-feature-name
```

### Before opening a PR, verify:

- [ ] The changed screen loads without crashing
- [ ] The golden path (main happy flow) still works
- [ ] You haven't broken an adjacent screen (e.g., if you changed chat, also check chats list)
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No lint errors: `npm run lint`

---

## 12. Building for Distribution (EAS)

When a change is ready for real users, it goes through **EAS Build** (cloud build service).
You do not need Xcode installed locally.

### Build profiles (defined in `eas.json`)

| Profile | Purpose | Distribution |
|---|---|---|
| `development` | Internal dev build with dev menu | Internal (TestFlight-like link) |
| `preview` | Internal QA build, no dev menu | Internal |
| `production` | App Store release build | Apple App Store |

### Trigger a development build (most common)

```bash
eas build --platform ios --profile development
```

EAS will:
1. Upload your code to Expo's servers
2. Compile it on a macOS build machine
3. Sign it with the project's Apple Developer certificates (automatic)
4. Give you a download link or install it directly to registered devices

This takes ~10–15 minutes.

### OTA updates (for JS-only changes)

If you only changed JavaScript (not native modules), you can push an **Over-the-Air update**
that users get without downloading a new app version:

```bash
eas update --channel production --message "fix: chat scroll bug"
```

The app checks for OTA updates on launch. Users get the fix within 1–2 app opens.
OTA updates **cannot** change native code (e.g., adding a new npm package that
uses native modules always requires a full EAS build).

### Force update gate

The Firestore document `config/appVersion` has a `minRequiredVersion` field.
If a user's app version is below this, they're shown a mandatory update screen.
Only change this when you're certain old versions are broken.

---

## 13. Common Problems and Fixes

### "Metro bundler failed to start"
```bash
npx expo start --clear
```
This clears the Metro cache. Try this first for any mysterious startup error.

### "Unable to resolve module X"
```bash
npm install
npx expo start --clear
```
A dependency is missing or stale. Reinstall and clear cache.

### App shows white screen / crashes on launch
Check the terminal for a red error. The most common causes:
- A missing environment variable (`.env` incomplete)
- A TypeScript/JS syntax error in a file that runs at startup

### Simulator keyboard not showing
In the iOS Simulator menu bar: **I/O → Keyboard → Toggle Software Keyboard**

### Push notifications not working
- Must be on a physical device (not simulator)
- Make sure you accepted the notification permission prompt on first launch
- Check Firebase Console → Functions → Logs for errors

### "FirebaseError: Missing or insufficient permissions"
Firestore security rules are blocking a read/write. Check the Firebase Console →
Firestore → Rules tab. Ask the team lead before changing rules.

### Fast Refresh keeps erroring out
Shake device → **Reload** (full JS reload, resets state).
If that doesn't fix it, stop Metro (`Ctrl+C`) and re-run `npx expo start`.

### `npm install` fails with peer dependency errors
```bash
npm install --legacy-peer-deps
```

### EAS build fails
Check the build log URL that EAS prints. The most common causes:
- Missing environment variable in EAS (ask team lead to add it to EAS project secrets)
- iOS certificate or provisioning profile expired (EAS usually fixes this automatically)

---

## Quick Reference

| Task | Command |
|---|---|
| Start dev server (simulator) | `npx expo start --ios` |
| Start dev server (Android) | `npx expo start --android` |
| Clear Metro cache | `npx expo start --clear` |
| Type check | `npx tsc --noEmit` |
| Lint | `npm run lint` |
| EAS dev build (iOS) | `eas build --platform ios --profile development` |
| EAS production build (iOS) | `eas build --platform ios --profile production` |
| Push OTA update | `eas update --channel production --message "..."` |
| View build logs | https://expo.dev/accounts/[your-username]/projects/BearPool |
| Firebase console | https://console.firebase.google.com |
