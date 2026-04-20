# BearPool — Codebase Reference

> UC Berkeley-exclusive rideshare app (iOS + Android). Built with Expo/React Native and Firebase.

---

## Table of Contents
1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Features](#features)
5. [Data Models (Firestore)](#data-models-firestore)
6. [Authentication](#authentication)
7. [Navigation Architecture](#navigation-architecture)
8. [Key Components](#key-components)
9. [Cloud Functions](#cloud-functions)
10. [State Management](#state-management)
11. [Push Notifications](#push-notifications)
12. [Environment Variables](#environment-variables)
13. [Build & Deployment](#build--deployment)
14. [Patterns & Conventions](#patterns--conventions)

---

## Overview

BearPool is a **UC Berkeley-exclusive** rideshare coordination app. It lets students post and join shared rides, chat in real-time within ride groups, and rate each other post-ride. Only `@berkeley.edu` emails can sign up. The app is dark-themed throughout and uses a Firebase backend (Firestore + Firebase Auth).

- **Version**: 1.2.0 (build 5)
- **Bundle ID**: `com.rebu.bearpool`
- **Firebase Project**: `bearpool-14bb5`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 54, React Native 0.81.5, React 19.1.0 |
| Language | TypeScript ~5.9.2 |
| Navigation | Expo Router v6 (file-system routing, typed routes) |
| UI Components | Gluestack UI v1 (`@gluestack-ui/themed`) |
| Styling | NativeWind v4 + TailwindCSS (utility classes) |
| Icons | Lucide React Native, Expo Vector Icons (Ionicons) |
| Database | Firebase Firestore (real-time, NoSQL) |
| Auth | Firebase Auth (`firebase/auth`) |
| Cloud Functions | Firebase Functions v2, Node.js 22 |
| Push Notifications | Expo Notifications + Expo Push Service API |
| Date Handling | `date-fns` |
| Content Moderation | `leo-profanity` (profanity filtering) |
| Image Handling | `expo-image-picker` + `expo-image-manipulator` |
| Local Persistence | `@react-native-async-storage/async-storage` (also used for Firebase Auth session persistence) |
| IDs | `uuid` |
| Architecture | New Architecture enabled (`newArchEnabled: true`) |

---

## Project Structure

```
BearPool/
├── app/                          # Expo Router app directory
│   ├── _layout.tsx               # Root layout (GluestackUIProvider + ThemeProvider)
│   │                             # Also: force update gate, global feedback modal, notification tap handler
│   ├── +not-found.tsx            # 404 screen
│   ├── (auth)/                   # Unauthenticated route group
│   │   ├── Login.tsx             # Email/password + Google + Apple Sign-In
│   │   ├── Signup.tsx            # Registration (berkeley.edu gate, email verify, TOS)
│   │   ├── VerifyEmail.tsx       # Email verification gate (post-signup)
│   │   ├── CompleteProfile.tsx   # Profile completion after social sign-in
│   │   ├── Reset.tsx             # Password reset
│   │   └── Welcome.tsx           # One-time onboarding screen
│   ├── (tabs)/                   # Main tab navigator (authenticated)
│   │   ├── _layout.tsx           # Tab config (Home, Chats, Post, Profile)
│   │   ├── index.tsx             # Home — ride feed
│   │   ├── chats.tsx             # Chats — list of user's rides
│   │   ├── post.tsx              # Post — create a ride
│   │   └── profile.tsx           # Profile — view/edit
│   └── (stack)/                  # Stack screens (modals / detail)
│       ├── ride/[id]/
│       │   ├── index.tsx         # Ride details
│       │   ├── chat.tsx          # Group chat
│       │   ├── edit.tsx          # Edit ride (host only)
│       │   ├── group-settings.tsx # Kick members, transfer host, delete ride (host only)
│       │   └── viewProfile.tsx   # View another user's profile, block/report
│       └── settings/
│           ├── settings.tsx      # Settings (logout, delete account, blocked users, notif prefs)
│           ├── contact-support.tsx
│           ├── privacy-policy.tsx
│           ├── report-user.tsx
│           └── terms-of-service.tsx
├── components/
│   ├── RideFeedbackModal.tsx     # Post-ride star rating + review modal
│   ├── TOSOverlay.tsx            # TOS acceptance during signup (fetches from GitHub Gist)
│   ├── NotificationOptInModal.tsx # Push notif permission request
│   ├── ThemedText.tsx / ThemedView.tsx
│   ├── HapticTab.tsx             # Tab bar with haptic feedback
│   ├── ParallaxScrollView.tsx
│   ├── Collapsible.tsx
│   └── ui/
│       ├── IconSymbol.ios.tsx    # iOS SF Symbols
│       ├── IconSymbol.tsx        # Cross-platform icon wrapper
│       ├── TabBarBackground.tsx  # iOS blur tab bar
│       └── gluestack-ui-provider/
├── hooks/
│   ├── useFirebaseAuth.ts        # Firebase Auth state hook (onAuthStateChanged)
│   ├── usePushNotifications.ts   # Token registration + Firestore save
│   ├── useNotificationOptInPrompt.ts # 7-day cooldown prompt logic
│   ├── useColorScheme.ts
│   └── useThemeColor.ts
├── services/
│   └── firebaseConfig.ts         # Firebase init — exports `auth`, `db`, `storage`
├── functions/                    # Firebase Cloud Functions
│   └── src/index.ts              # 4 functions (see Cloud Functions section)
├── scripts/
│   └── migration/                # One-time Clerk → Firebase Auth migration script (historical)
├── app.config.js                 # Expo config (env vars, plugins, bundle IDs)
├── babel.config.js               # NativeWind + module resolver aliases
├── tailwind.config.js            # Tailwind/NativeWind config
├── firebase.json                 # Firebase project config
├── firestore.rules               # Firestore security rules
├── eas.json                      # EAS Build profiles
└── .env                          # Secret env vars (never commit)
```

---

## Features

### Ride Feed (Home)
- Real-time Firestore `onSnapshot` subscription to all rides
- Client-side filtering: archived, >5-day-old rides, gender preference, blocked users
- Join ride with validation: seat availability, gender pref match, not already a member, ride not started/archived

### Ride Posting
- Origin, destination, date/time (cross-platform pickers), seat count (1–5), notes (200 char max), gender preference
- Profanity filtering on all text fields before saving
- Only future-dated rides allowed
- Admins see a "Test Ride" toggle (test rides are hidden from non-admin users in the feed)

### Group Chat
- Real-time messages from `rides/{rideId}/messages` sub-collection
- System messages for join/leave/kick/host-transfer events (server-side, idempotent — see Cloud Functions)
- Read state tracking (`rides/{rideId}/readState/{userId}`) for notification suppression
- Archive countdown shown in chat header
- Leave ride from within chat

### Chats List
- Active rides + archived "PAST RIDES" section
- User avatar cache via `useRef` to minimize Firestore reads
- Unread indicator driven by `readState.lastReadAt` vs latest message timestamp

### Profile
- First name, last name, username, gender, avatar
- Avatar: compressed to JPEG Base64 (max 900KB), stored directly in Firestore document
- Updates Firestore only

### Post-Ride Feedback
- Smart trigger: 1–60 min after ride `startTime`, within a 24-hour window
- Star ratings per ride member individually + optional text review
- "Rate Later" stores 6-hour reminder in AsyncStorage
- Submitted to `reviews` Firestore collection

### Push Notifications
- Opt-in flow with 7-day cooldown (`useNotificationOptInPrompt`)
- Token saved per-device in `users/{userId}.pushTokens[deviceKey]`
- Notification tap deep-links to the relevant ride chat

### Safety
- **Gender-restricted rides**: Host can restrict to their own gender
- **Blocking**: Blocked users' rides hidden from feed; blocking also removes you from all of their hosted rides
- **Reporting**: `reports` Firestore collection with reason + details
- **Profanity filter**: `leo-profanity` on all user-generated text

### Account Deletion
- Two-step confirmation UI → re-authenticate (email/password, Google, or Apple) → calls `deleteAccount` Firebase Cloud Function → deletes Firebase Auth user + Firestore doc → signs out

---

## Data Models (Firestore)

### `rides` collection
```typescript
{
  from: string,
  to: string,
  date: string,           // "MMMM d" format, e.g. "January 16"
  time: string,           // "h:mm a" format, e.g. "3:00 PM"
  seats: number,          // Remaining seats (decrements on join)
  notes: string,
  createdAt: Timestamp,
  hostId: string,         // Firebase Auth UID
  memberIds: string[],    // All member Firebase Auth UIDs (host included)
  chatId: string,         // "ride_<timestamp>_<userId>" (legacy field, unused)
  rideFull: boolean,
  isActive: boolean,
  genderPref: "N"|"M"|"F"|"NB",  // N = no preference
  archived: boolean,
  archivedAt: Timestamp | null,
  startTime: Timestamp | null,
  isTest: boolean,        // Admin-only test ride flag
  kickedBy: { [userId: string]: true }
}
```

### `rides/{rideId}/messages` sub-collection
```typescript
{
  text: string,
  senderId: string | null,   // null for system messages
  senderName: string,
  timestamp: Timestamp,
  system: boolean,
  archivedNotice: boolean
}
```

### `rides/{rideId}/readState/{userId}` sub-collection
```typescript
{
  activeChat: boolean,     // User currently has chat open
  activeAt: Timestamp,     // Last active timestamp
  lastReadAt: Timestamp
}
```

### `users` collection
```typescript
{
  email: string,
  first_name: string,
  last_name: string,
  username: string,
  avatar: string,          // Base64 JPEG data URI
  gender: "M"|"F"|"NB"|null,
  ridesJoined: number,
  ridesHosted: number,
  createdAt: Timestamp,
  tosAcceptedAt: Timestamp,
  tosVersion: string,
  isAdmin: boolean,
  blockedUsers: string[],  // Firebase Auth UIDs
  expoPushToken: string,   // Latest token (legacy single-device field)
  pushTokens: { [deviceKey: string]: string },
  notifPrefs: {
    enabled: boolean,
    permissionStatus: "granted"|"denied"|"undetermined",
    promptDismissedAt: Timestamp
  }
}
```

### `reviews` collection
```typescript
{
  rideId: string,
  raterId: string,
  ratings: { [userId: string]: number },
  review: string,
  createdAt: Timestamp
}
```

### `reports` collection
```typescript
{
  reporterId: string,
  targetUserId: string,
  rideId: string,
  reason: string,
  details: string,
  createdAt: Timestamp
}
```

### `supportTickets` collection
```typescript
{
  name: string,
  email: string,
  subject: string,
  message: string,
  userId: string,
  createdAt: Timestamp,
  appVersion: string
}
```

### `pushReceipts` collection
```typescript
{
  userId: string,
  token: string,
  createdAt: Timestamp
}
```

---

## Authentication

- **Provider**: Firebase Auth (`firebase/auth`)
- **Session persistence**: `getReactNativePersistence(AsyncStorage)` — session survives app restarts
- **Auth hook**: `useFirebaseAuth()` in `hooks/useFirebaseAuth.ts` — wraps `onAuthStateChanged`, returns `{ user, userId, loading, isLoaded, isSignedIn }`
- **Auth guard**: `useFirebaseAuth().isSignedIn` in `app/(tabs)/_layout.tsx` — redirects to `/(auth)/Login` if not signed in
- **Identity bridge**: Firebase Auth `uid` is used as the Firestore `users` document ID

### Sign-up flow (email/password)
1. `createUserWithEmailAndPassword` → `sendEmailVerification` → write Firestore `users` doc
2. Route to `VerifyEmail` screen → user clicks link → `user.reload()` → check `emailVerified`
3. Route to `Welcome` screen → tabs

### Social sign-in (Google / Apple)
- **Google**: `GoogleSignin.signIn()` → enforce `@berkeley.edu` → `signInWithCredential` → Firestore doc exists? → tabs : `CompleteProfile`
- **Apple** (iOS only): `AppleAuthentication.signInAsync` with hashed nonce → `signInWithCredential` → enforce `@berkeley.edu` (if not, calls `deleteUser` to clean up the orphaned Firebase Auth account) → Firestore doc exists? → tabs : `CompleteProfile`
- **Account linking**: if `auth/account-exists-with-different-credential`, prompt password → `signInWithEmailAndPassword` → `linkWithCredential`

### Berkeley gate
```typescript
const isBerkeleyEmail = (email: string) =>
  email.toLowerCase().endsWith("@berkeley.edu");
```
- Email/password: validated client-side at signup
- Google: validated before `signInWithCredential`
- Apple: validated after sign-in; non-berkeley accounts are deleted immediately

### Password reset
`sendPasswordResetEmail` — shows success regardless of whether the email exists (security). Hints to check spam folder.

### Account deletion
Client cleans up ride memberships → re-authenticates (email/password, Google, or Apple credential) → calls `deleteAccount` Cloud Function which deletes Firebase Auth user + Firestore doc in parallel.

---

## Navigation Architecture

Expo Router file-system routing with three route groups:

```
/(auth)/          — unauthenticated screens
  Login           — gestureEnabled: false
  Signup
  VerifyEmail     — gestureEnabled: false
  CompleteProfile — gestureEnabled: false (social sign-in profile completion)
  Reset
  Welcome         — gestureEnabled: false (one-time onboarding)

/(tabs)/          — tab navigator (Home, Chats, Post, Profile)

/(stack)/         — stack screens pushed on top of tabs
  ride/[id]/      — ride details, chat, edit, group-settings, viewProfile
  settings/       — settings hub and sub-pages
```

**Deep linking**: Notification taps navigate directly to `/(stack)/ride/[id]/chat` via `addNotificationResponseReceivedListener` in `app/_layout.tsx`.

---

## Key Components

| File | Responsibility |
|------|---------------|
| [app/_layout.tsx](app/_layout.tsx) | Root: providers, force update gate, global feedback modal (polls Firestore every 5 min + on foreground), notification tap handler |
| [app/(tabs)/index.tsx](app/(tabs)/index.tsx) | Home feed with real-time subscription, join ride logic, all client-side filtering |
| [app/(tabs)/post.tsx](app/(tabs)/post.tsx) | Ride creation form (profanity filtered, date/time pickers, notification opt-in after post) |
| [app/(tabs)/chats.tsx](app/(tabs)/chats.tsx) | Chat list with avatar caching, active + archived sections |
| [app/(tabs)/profile.tsx](app/(tabs)/profile.tsx) | Profile view/edit, avatar upload via ImagePicker → Base64 |
| [app/(stack)/ride/[id]/chat.tsx](app/(stack)/ride/[id]/chat.tsx) | Real-time group chat, read state tracking, leave ride |
| [app/(stack)/ride/[id]/group-settings.tsx](app/(stack)/ride/[id]/group-settings.tsx) | Host controls: kick members, transfer host, delete ride |
| [app/(stack)/ride/[id]/viewProfile.tsx](app/(stack)/ride/[id]/viewProfile.tsx) | Public profile view, block/unblock, report |
| [app/(stack)/settings/settings.tsx](app/(stack)/settings/settings.tsx) | Settings: notification prefs, blocked users, logout, account deletion (re-auth + Cloud Function) |
| [components/RideFeedbackModal.tsx](components/RideFeedbackModal.tsx) | Post-ride star ratings per member + review, AsyncStorage cooldown |
| [components/NotificationOptInModal.tsx](components/NotificationOptInModal.tsx) | Push permission request modal |
| [components/TOSOverlay.tsx](components/TOSOverlay.tsx) | Full-screen TOS acceptance during signup (fetches live from GitHub Gist) |
| [hooks/useFirebaseAuth.ts](hooks/useFirebaseAuth.ts) | Firebase Auth state — `onAuthStateChanged` subscriber, three states: loading / signed-out / signed-in |
| [hooks/usePushNotifications.ts](hooks/usePushNotifications.ts) | Token registration, per-device Firestore save, Android channel setup |
| [hooks/useNotificationOptInPrompt.ts](hooks/useNotificationOptInPrompt.ts) | 7-day cooldown logic (AsyncStorage + Firestore), in-memory cache |
| [services/firebaseConfig.ts](services/firebaseConfig.ts) | Firebase init, exports `auth`, `db` (Firestore), `storage` |

---

## Cloud Functions

All in [functions/src/index.ts](functions/src/index.ts):

### 1. `onRideMessageCreated` (Firestore trigger)
- Trigger: `rides/{rideId}/messages/{messageId}` onCreate
- Sends push notifications to all ride members except the sender
- Suppresses if recipient has `activeChat: true` and `activeAt` within 75 seconds, or if `lastReadAt >= messageTimestamp`
- Suppresses if user has `notifPrefs.enabled === false`
- Supports both legacy `expoPushToken` (string) and `pushTokens` (multi-device map)
- Sends in batches of 100 to `POST https://exp.host/--/api/v2/push/send`
- On `DeviceNotRegistered` receipt error: removes invalid token via Firestore transaction
- Stores receipt IDs in `pushReceipts` collection for deferred verification

### 2. `onRideMembersChanged` (Firestore trigger)
- Trigger: `rides/{rideId}` onUpdate, when `memberIds` or `hostId` changes
- Writes system messages ("X has joined/left/was removed from the ride") with deterministic doc IDs for idempotency: `${event.id}-join-${uid}`
- Detects `kickedBy[uid]` to write "was removed" vs "has left"
- Detects `hostId` changes → writes "X has been made the host" system message
- Sends push notifications to existing members on join/leave

### 3. `deleteAccount` (Callable HTTPS function)
- Requires authenticated caller
- Deletes Firebase Auth user + Firestore `users` doc in parallel
- Called from the settings screen after client-side ride cleanup and re-authentication

### 4. `checkPushReceipts` (Scheduled — every 60 minutes)
- Calls `POST https://exp.host/--/api/v2/push/getReceipts`
- Removes invalid/unregistered tokens from Firestore `users` docs
- Processes up to 300 receipts per run, always deletes receipt docs after processing

---

## State Management

**No global state library** (no Redux, Zustand, or Context for app state). All state is:

- **Local `useState`**: Each screen owns its own data
- **`onSnapshot` subscriptions**: Firestore real-time listeners in `useEffect` → drive UI updates reactively
- **`useRef` for listeners**: Unsubscribe functions stored in refs for proper cleanup
- **AsyncStorage**: Rated rides set, rate-later cooldowns, notification prompt dismissal timestamps
- **In-memory caching**: Avatar cache in `useRef` (chats screen), notification preference cache in module-level variable (`useNotificationOptInPrompt`)

---

## Push Notifications

1. User taps "Enable" in `NotificationOptInModal` (shown after posting or joining a ride)
2. `usePushNotifications` requests permission → gets Expo push token
3. Token saved to `users/{userId}.pushTokens[deviceKey]` in Firestore (and legacy `expoPushToken` field)
4. Cloud Function `onRideMessageCreated` reads tokens and calls Expo Push API
5. `checkPushReceipts` cleans up dead tokens hourly
6. Notification tap → `addNotificationResponseReceivedListener` → `router.push` to ride chat

**Cooldown logic** (`useNotificationOptInPrompt`): 7-day cooldown stored in AsyncStorage + Firestore. Won't re-prompt if permission already granted/denied or within cooldown period.

---

## Environment Variables

Defined in `.env`, injected via `app.config.js` into `Constants.expoConfig.extra`:

| Variable | Purpose |
|----------|---------|
| `FIREBASE_API_KEY` | Firebase Web API key |
| `FIREBASE_AUTH_DOMAIN` | `bearpool-14bb5.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | `bearpool-14bb5` |
| `FIREBASE_STORAGE_BUCKET` | `bearpool-14bb5.appspot.com` |
| `FIREBASE_MESSAGING_SENDER_ID` | `290357677941` |
| `FIREBASE_APP_ID` | Firebase app ID |
| `FIREBASE_MEASUREMENT_ID` | Google Analytics measurement ID |
| `WEB3FORMS_API_KEY` | Contact support form submission |

---

## Build & Deployment

### Local Development
```bash
npx expo start          # Expo dev server
npx expo start --ios    # iOS simulator
npx expo start --android
```

### EAS Build Profiles (`eas.json`)
| Profile | Distribution | Use |
|---------|-------------|-----|
| `development` | Internal | Dev client build |
| `preview` | Internal | QA/testing |
| `production` | Store | App Store / Play Store |

**Build number management**: EAS reads `CFBundleVersion` from `ios/BearPool/Info.plist` — **not** from `app.config.js`. Before each new App Store submission, increment both:
1. `buildNumber` in `app.config.js`
2. `CFBundleVersion` in `ios/BearPool/Info.plist`

### EAS Update (OTA)

JS/asset-only changes can be shipped over-the-air without a new App Store submission. OTA updates are delivered to all builds with a matching `runtimeVersion` (currently `"1.2.0"`).

```bash
# Push an OTA update to production
eas update --channel production --message "Description of change"
```

Native changes (new plugins, new permissions, native package upgrades) still require a full `eas build` + `eas submit`.

### Force Update Gate

A Firestore document at `config/appVersion` gates old app versions:

```json
{ "minRequiredVersion": "1.2.0" }
```

- On startup (after auth loads), the app fetches this document and compares `minRequiredVersion` against the installed `Constants.expoConfig?.version`.
- If the installed version is below the minimum, a **non-dismissible modal** blocks the app and links to the App Store.
- To gate a version: update `minRequiredVersion` in Firestore — no app update required.
- **Firestore rules**: the `config` collection must allow public reads:
  ```
  match /config/{docId} {
    allow read: if true;
    allow write: if false;
  }
  ```

### Firebase Functions
```bash
cd functions
npm run build           # TypeScript compile
firebase deploy --only functions
```
Pre-deploy hooks run ESLint + tsc. Node.js 22 runtime.

### Native Projects
- **iOS**: `/ios/` — includes `GoogleService-Info.plist`, APNs background modes configured
- **Android**: `/android/` — includes `google-services.json`

---

## Patterns & Conventions

### Real-time Data Pattern
Every list/feed screen follows this pattern:
```typescript
const unsubscribeRef = useRef<(() => void) | null>(null);
useEffect(() => {
  unsubscribeRef.current = onSnapshot(query, (snapshot) => { /* update state */ });
  return () => unsubscribeRef.current?.();
}, []);
```

### Atomic Batch Writes
Join ride uses `writeBatch` to atomically update `memberIds`, `seats`, and `ridesJoined`:
```typescript
const batch = writeBatch(db);
batch.update(rideRef, { memberIds: arrayUnion(userId), seats: increment(-1) });
batch.update(userRef, { ridesJoined: increment(1) });
await batch.commit();
```

### Profanity Filtering
Applied at both `onChange` and `onSubmit` across all user-generated text fields (`leo-profanity`).

### Idempotent System Messages (Cloud Functions)
Deterministic Firestore doc IDs prevent duplicate system messages on retries:
```typescript
await messagesRef.doc(`${event.id}-join-${uid}`).set({ ... });
```

### Notification Suppression
Notifications are suppressed when recipient has `activeChat: true` and `activeAt` within 75 seconds — prevents noisy alerts for active chat users.

### Avatar Storage
Avatars are stored as Base64 JPEG data URIs directly in the Firestore `users` document (not Firebase Storage). Max 900KB enforced client-side. Simplifies reads but increases document size.

### Dark Theme (Hard-coded)
App is entirely dark-themed with fixed color values from `constants/Colors.ts`:
- `#121212` — primary background
- `#1e1e1e` — card/surface
- `#2a2a2a` — elevated surface
- `#FFBE5C` — accent (gold/amber, exported as `ACCENT`)
- `#a0a0a0` — muted text
- `#333` — border

### Berkeley Email Gate
```typescript
const isBerkeleyEmail = (email: string) =>
  email.toLowerCase().endsWith("@berkeley.edu");
```

### Firestore Security Rules
Currently: any authenticated user can read/write most collections. `readState` is restricted so users can only write their own entry. **Note**: rules need tightening in a future update.

---

*Last updated: April 2026*
