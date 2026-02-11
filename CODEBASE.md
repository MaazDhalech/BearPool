# BearPool — Codebase Reference

> UC Berkeley-exclusive rideshare app (iOS + Android). Built with Expo/React Native, Firebase, and Clerk auth.

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

BearPool is a **UC Berkeley-exclusive** rideshare coordination app. It lets students post and join shared rides, chat in real-time within ride groups, and rate each other post-ride. Only `@berkeley.edu` emails can sign up. The app is dark-themed throughout and uses a Firebase (Firestore) backend with Clerk for authentication.

- **Version**: 1.1.0
- **Bundle ID**: `com.rebu.bearpool`
- **Firebase Project**: `bearpool-14bb5`
- **External Backend**: `https://bearpool-account-deletion.vercel.app` (account deletion only)

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
| File Storage | Firebase Storage |
| Auth | Clerk (`@clerk/clerk-expo` v2) |
| Cloud Functions | Firebase Functions v2, Node.js 22 |
| Push Notifications | Expo Notifications + Expo Push Service API |
| Analytics | PostHog (`posthog-react-native`) |
| Date Handling | `date-fns` |
| Content Moderation | `leo-profanity` (profanity filtering) |
| Image Handling | `expo-image-picker` + `expo-image-manipulator` |
| Secure Storage | `expo-secure-store` (Clerk token cache) |
| Local Persistence | `@react-native-async-storage/async-storage` |
| IDs | `uuid` |
| Architecture | New Architecture enabled (`newArchEnabled: true`) |

---

## Project Structure

```
BearPool/
├── app/                          # Expo Router app directory
│   ├── _layout.tsx               # Root layout (ClerkProvider + GluestackUIProvider + ThemeProvider)
│   │                             # Also: global feedback modal trigger, notification tap handler
│   ├── +not-found.tsx            # 404 screen
│   ├── (auth)/                   # Unauthenticated route group
│   │   ├── Login.tsx             # Email/password login
│   │   ├── Signup.tsx            # Signup (berkeley.edu gate, email verify, TOS)
│   │   └── Reset.tsx             # Password reset
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
│       │   ├── group-settings.tsx # Kick members, delete ride (host only)
│       │   └── viewProfile.tsx   # View another user's profile, block/report
│       └── settings/
│           ├── settings.tsx      # Settings (logout, delete account, blocked users)
│           ├── contact-support.tsx
│           ├── privacy-policy.tsx
│           ├── report-user.tsx
│           └── terms-of-service.tsx
├── components/
│   ├── RideFeedbackModal.tsx     # Post-ride star rating + review modal
│   ├── TOSOverlay.tsx            # TOS acceptance during signup
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
│   ├── usePushNotifications.ts   # Token registration + Firestore save
│   ├── useNotificationOptInPrompt.ts # 7-day cooldown prompt logic
│   ├── useColorScheme.ts
│   └── useThemeColor.ts
├── services/
│   └── firebaseConfig.ts         # Firebase init — exports `db` and `storage`
├── functions/                    # Firebase Cloud Functions
│   └── src/index.ts              # 3 functions (see Cloud Functions section)
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
- Client-side filtering: archived, >5-day-old rides, gender preference, blocked users, search (origin/destination)
- Join ride with validation: seat availability, gender pref match, not already a member, ride not started/archived

### Ride Posting
- Origin, destination, date/time (cross-platform pickers), seat count (1–5), notes (200 char max), gender preference
- Profanity filtering on all text fields before saving
- Only future-dated rides allowed

### Group Chat
- Real-time messages from `rides/{rideId}/messages` sub-collection
- System messages for join/leave events (server-side, idempotent — see Cloud Functions)
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
- Updates both Clerk (name fields) and Firestore (all fields)

### Post-Ride Feedback
- Smart trigger: 1–30 min after ride `startTime`, within a 24-hour window
- Star ratings per ride member individually + optional text review
- "Rate Later" stores 6-hour reminder in AsyncStorage
- Submitted to `feedback` Firestore collection

### Push Notifications
- Opt-in flow with 7-day cooldown (`useNotificationOptInPrompt`)
- Token saved per-device in `users/{userId}.pushTokens[deviceKey]`
- Notification tap deep-links to the relevant ride chat

### Safety
- **Gender-restricted rides**: Host can restrict to their own gender
- **Blocking**: Blocked users' rides hidden from feed; blocked users can't see/chat in shared rides
- **Reporting**: `reports` Firestore collection with reason + details
- **Profanity filter**: `leo-profanity` on all user-generated text

### Account Deletion
- Two-step confirmation UI → `POST https://bearpool-account-deletion.vercel.app/api/delete-account` with `{ userId }` → deletes Clerk user + Firestore data → signs out

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
  hostId: string,         // Clerk user ID
  memberIds: string[],    // All member Clerk user IDs (host included)
  chatId: string,         // "ride_<timestamp>_<userId>"
  rideFull: boolean,
  isActive: boolean,
  genderPref: "N"|"M"|"F"|"NB",  // N = no preference
  archived: boolean,
  archivedAt: Timestamp | null,
  startTime: Timestamp | null,
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
  blockedUsers: string[],  // Clerk user IDs
  expoPushToken: string,   // Latest token (legacy)
  pushTokens: { [deviceKey: string]: string },
  notifPrefs: {
    enabled: boolean,
    permissionStatus: "granted"|"denied"|"undetermined",
    promptDismissedAt: Timestamp
  }
}
```

### `feedback` collection
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

- **Provider**: Clerk (`@clerk/clerk-expo` v2)
- **Token storage**: Expo SecureStore (keychain/keystore)
- **Auth guard**: `useAuth().isSignedIn` in `app/(tabs)/_layout.tsx` — redirects to `/(auth)/Login` if not signed in
- **Berkeley gate**: Signup validates `email.endsWith("@berkeley.edu")`
- **Sign up flow**: email + password + name + username + gender + TOS → Clerk email verification code → create Firestore `users` doc
- **Identity bridge**: Clerk `userId` is used as the Firestore `users` document ID
- **Firestore auth**: Clerk JWTs are used as Firebase Auth tokens; `firestore.rules` requires `request.auth != null`
- **Password reset**: Clerk's built-in reset flow in `app/(auth)/Reset.tsx`

---

## Navigation Architecture

Expo Router file-system routing with three route groups:

```
/(auth)/          — unauthenticated screens (Login, Signup, Reset)
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
| [app/_layout.tsx](app/_layout.tsx) | Root: providers, global feedback modal (polls Firestore every 5 min), notification tap handler |
| [app/(tabs)/index.tsx](app/(tabs)/index.tsx) | Home feed with real-time subscription, join ride logic, all client-side filtering |
| [app/(tabs)/post.tsx](app/(tabs)/post.tsx) | Ride creation form (profanity filtered, date/time pickers, notification opt-in after post) |
| [app/(tabs)/chats.tsx](app/(tabs)/chats.tsx) | Chat list with avatar caching, active + archived sections |
| [app/(tabs)/profile.tsx](app/(tabs)/profile.tsx) | Profile view/edit, avatar upload via ImagePicker → Base64 |
| [app/(stack)/ride/[id]/chat.tsx](app/(stack)/ride/[id]/chat.tsx) | Real-time group chat, read state tracking, leave ride |
| [app/(stack)/ride/[id]/group-settings.tsx](app/(stack)/ride/[id]/group-settings.tsx) | Host controls: kick members, delete ride |
| [app/(stack)/ride/[id]/viewProfile.tsx](app/(stack)/ride/[id]/viewProfile.tsx) | Public profile view, block/unblock, report |
| [app/(stack)/settings/settings.tsx](app/(stack)/settings/settings.tsx) | Settings: blocked users, logout, account deletion (calls Vercel backend) |
| [components/RideFeedbackModal.tsx](components/RideFeedbackModal.tsx) | Post-ride star ratings per member + review, AsyncStorage cooldown |
| [components/NotificationOptInModal.tsx](components/NotificationOptInModal.tsx) | Push permission request modal |
| [components/TOSOverlay.tsx](components/TOSOverlay.tsx) | Full-screen TOS acceptance during signup |
| [hooks/usePushNotifications.ts](hooks/usePushNotifications.ts) | Token registration, per-device Firestore save, Android channel setup |
| [hooks/useNotificationOptInPrompt.ts](hooks/useNotificationOptInPrompt.ts) | 7-day cooldown logic (AsyncStorage + Firestore), in-memory cache |
| [services/firebaseConfig.ts](services/firebaseConfig.ts) | Firebase init, exports `db` (Firestore) and `storage` |

---

## Cloud Functions

All in [functions/src/index.ts](functions/src/index.ts):

### 1. `onRideMessageCreated` (Firestore trigger)
- Trigger: `rides/{rideId}/messages/{messageId}` onCreate
- Sends push notifications to all ride members except the sender
- Suppresses if recipient has `activeChat: true` and `activeAt` within 75 seconds
- Calls `POST https://exp.host/--/api/v2/push/send`

### 2. `onRideMembersChanged` (Firestore trigger)
- Trigger: `rides/{rideId}` onUpdate, when `memberIds` changes
- Writes system messages ("X has joined/left the ride") with deterministic doc IDs for idempotency: `${event.id}-join-${uid}`
- Sends push notifications to existing members on join/leave

### 3. `checkPushReceipts` (Scheduled — every 60 minutes)
- Calls `POST https://exp.host/--/api/v2/push/getReceipts`
- Removes invalid/unregistered tokens from Firestore `users` docs
- Processes up to 300 receipts per run

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

1. User taps "Enable" in `NotificationOptInModal` (shown after posting a ride)
2. `usePushNotifications` requests permission → gets Expo push token
3. Token saved to `users/{userId}.pushTokens[deviceKey]` in Firestore
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
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `WEB3FORMS_API_KEY` | Contact support form |
| `BACKEND_URL` | `https://bearpool-account-deletion.vercel.app` |

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
| `production` | Store | App Store / Play Store, auto-increments version |

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
Applied at both onChange and onSubmit. Filter instance is set up with custom additions:
```typescript
filter.add(["ridehate", "berkeleybully"]);
```

### Idempotent System Messages (Cloud Functions)
Deterministic Firestore doc IDs prevent duplicate system messages on retries:
```typescript
await messagesRef.doc(`${event.id}-join-${uid}`).set({ ... });
```

### Notification Suppression
Notifications are suppressed when recipient has `activeChat: true` and `activeAt` within 75 seconds — prevents noisy alerts for active chat users.

### Avatar Storage
Avatars are stored as Base64 JPEG data URIs directly in the Firestore `users` document (not Firebase Storage). Max 900KB. Simplifies reads but increases document size.

### Dark Theme (Hard-coded)
App is entirely dark-themed with fixed color values:
- `#121212` — primary background
- `#1e1e1e` — card/surface
- `#2a2a2a` — elevated surface
- `#3a7bd5` — accent blue
- `#a0a0a0` — muted text
- `#333` — border

### Berkeley Email Gate
```typescript
const isBerkeleyEmail = (email: string) =>
  email.toLowerCase().endsWith("@berkeley.edu");
```

### Firestore Security Rules
Currently: any authenticated user can read/write most collections. `readState` is restricted so users can only write their own entry if they're a ride member. **Note**: rules need tightening in a future update.

---

*Last updated: February 2026*
