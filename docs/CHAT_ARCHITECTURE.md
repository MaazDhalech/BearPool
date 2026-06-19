# BearPool Chat — Architecture & Feature Reference

> **Source:** [`app/(stack)/ride/[id]/chat.tsx`](../app/(stack)/ride/[id]/chat.tsx)  
> **Open source reference:** [`kesha-antonov/react-native-chat`](https://github.com/kesha-antonov/react-native-chat) (MIT)  
> Last updated: June 2026

---

## Table of Contents
1. [What We Built (Current Features)](#1-what-we-built)
2. [What the Open Source App Has](#2-open-source-feature-inventory)
3. [What We Integrated and How](#3-what-we-integrated)
4. [What's Left to Consider](#4-whats-left-to-consider)
5. [What We Decided to Skip and Why](#5-what-we-skipped)
6. [Firestore Data Model](#6-firestore-data-model)

---

## 1. What We Built

Our chat is a fully custom implementation. We did not adopt the open source library wholesale — we cherry-pick specific components and patterns from it.

### Core infrastructure
| Feature | Implementation |
|---|---|
| Message list | `ReAnimated.FlatList` (inverted) with `useAnimatedRef` + Reanimated's `scrollTo` |
| Keyboard handling | `react-native-keyboard-controller` `KeyboardAvoidingView` with `behavior="translate-with-padding"` |
| Real-time messages | Firestore `onSnapshot` on `rides/{rideId}/messages`, ordered by `timestamp asc` |
| User detail fetching | Separate `useEffect` on `messages` array, cached in `userMapRef`, parallel `Promise.all` |
| Scroll-to-bottom | Reanimated `scrollTo(flatListRef, 0, 0, true)` — offset 0 = newest on inverted list |
| Auto-scroll lock | `autoScrollRef` + `setAutoScrollBoth`; locks when `y > 120`, unlocks when `y < 60` |
| Read state | Written to `rides/{rideId}/readState/{userId}.lastReadAt` on focus + 4s throttle |
| Active chat tracking | `activeChat: true` heartbeat every 27s while screen focused (suppresses push notifications) |

### Message rendering
| Feature | Implementation |
|---|---|
| iMessage chain rounding | Corner radii computed per-message based on `isFirstInGroup` / `isLastInGroup` flags. R=18 (full), r=5 (tight) |
| Message grouping | 5-minute gap breaks a sender chain; `isFirstInGroup` / `isLastInGroup` on each `ProcessedMessage` |
| Time dividers | Shown when gap ≥ 1 hour OR date changes between adjacent messages |
| Inline timestamp | Inside bubble, bottom-right, only on `isLastInGroup`. Tap bubble to see full date+time |
| Deleted messages | `msg.deleted = true` → "Message deleted" italic placeholder |
| System messages | `msg.system = true` → centered pill (join/leave events from Cloud Functions) |
| Archive notice | `msg.archivedNotice = true` → yellow pill with archive icon |
| Typing indicator | 3-dot bounce animation (Reanimated `withRepeat`/`withSequence`), read from `rides/{rideId}/typing/{userId}` subcollection. Stale after 8s |

### Interactions
| Feature | Implementation |
|---|---|
| Long press → action sheet | Custom dark `Modal` with emoji strip + Reply / Share / Delete / Report |
| **Emoji reactions** | 6 emojis (👍 ❤️ 😂 😮 😢 👎). Stored as `reactions: [{ emoji, userIds }]` on message doc. Toggles with read-modify-write in Firestore |
| **Swipe-to-reply** | `ReanimatedSwipeable` (RNGH) — swipe right → reply icon springs in → sets `replyingTo` state |
| Reply preview strip | Appears above input bar when `replyingTo` is set. Blue left border, sender name + quoted text |
| Reply preview in bubble | Quoted block rendered inside bubble when `msg.replyMessage` exists |
| Profanity filter | `leo-profanity` on send; custom words: `berkeleyhate`, `ridebully` |
| Haptics | Long press → `Medium`, swipe-to-reply → `Light`, reaction toggle → `Light` |
| Avatar tap | Navigates to `viewProfile` for other users, own `profile` tab for self |
| Send animation | Reanimated spring scale on send button; Animated color interpolation on press |

### Input bar
| Feature | Implementation |
|---|---|
| Multi-line input | `multiline` TextInput, `maxHeight: 100` |
| Character limit | 500 chars; warning counter appears at 80%, red at limit |
| Typing status | Debounced (4s) `setDoc` to `rides/{rideId}/typing/{userId}` while typing |

### Scroll-to-bottom FAB
- Renders when `!autoScroll` (user has scrolled away from newest)
- Uses `GHTouchableOpacity` (from `react-native-gesture-handler`) — required on New Architecture to avoid touch being swallowed by RNGH's gesture system
- Lives **inside** the `KeyboardAvoidingView` so it translates up with the keyboard automatically (no manual keyboard height tracking)

---

## 2. Open Source Feature Inventory

**Library:** [`kesha-antonov/react-native-chat`](https://github.com/kesha-antonov/react-native-chat)  
**License:** MIT — fully commercial safe  
**Status:** Actively maintained (v4.1.0, June 2026), zero open issues

| Feature | Self-contained? | Notes |
|---|---|---|
| Emoji reactions | ✅ Yes | We integrated our own version |
| Swipe-to-reply | ✅ Yes | We integrated our own version |
| Floating day header (`DayAnimated`) | ⚠️ Moderate | Reanimated worklet; needs layout measurement per separator |
| Load-earlier / pagination | ✅ Yes | `LoadEarlierMessages` component + `isInfiniteScrollEnabled` |
| Message status ticks | ✅ Yes | `pending`, `sent`, `received` fields on message |
| Link/URL auto-detection | ✅ Yes | `linkParser.tsx` — ~250 lines, zero deps, pure regex |
| Streaming/AI messages | ✅ Yes | `useStreamingMessages` hook + `StreamingCursor` — zero deps |
| Typing indicator | ✅ Yes | Takes a plain `isTyping: boolean` — we supply it |
| Image messages + lightbox | ⚠️ Moderate | Requires `react-native-zoom-reanimated` dep |
| Audio messages | ❌ Stub | Placeholder only — you own the implementation |
| Video messages | ❌ Stub | Same |
| Quick replies (bot chips) | ✅ Yes | Not relevant for rideshare |
| Composer accessory bar | ✅ Yes | `renderAccessory` slot — could hold attachment button |
| Copy to clipboard | ✅ Yes | Via `@expo/react-native-action-sheet` |
| `renderChatFooter` slot | ✅ Yes | Useful for pinned ride info banner |
| `react-native-keyboard-controller` | ✅ Yes | We integrated this at the root level |
| Dark/light theming | N/A | Their `Color.ts` palette — we hardcode dark, irrelevant |

---

## 3. What We Integrated

### 3.1 `react-native-keyboard-controller`

**Why:** RN's built-in `KeyboardAvoidingView` has known issues on New Architecture / Fabric. Keyboard-controller runs on the UI thread and is the recommended replacement.

**Changes made:**
- `app/_layout.tsx` — added `<KeyboardProvider statusBarTranslucent>` wrapping the entire app
- `chat.tsx` — replaced `import { KeyboardAvoidingView } from "react-native"` with `import { KeyboardAvoidingView } from "react-native-keyboard-controller"`
- Changed `behavior={Platform.OS === "ios" ? "padding" : "height"}` → `behavior="translate-with-padding"`
- Removed manual `keyboardWillShow` / `keyboardWillHide` event listeners and `keyboardHeight` state
- Removed `inputPadBottom` computed value
- FAB moved **inside** the KAV — translates up with keyboard automatically, no height math needed

**Gotcha:** `keyboardWillShow` is iOS-only. The old code was broken on Android. Keyboard-controller handles both platforms uniformly.

---

### 3.2 Emoji Reactions

**Source:** `src/Reactions/` — `MessageReactions.tsx`, `ReactionPicker.tsx`, `types.ts`

**What we kept from source:** The `MessageReaction` type shape (`{ emoji: string, userIds: string[] }`), the reaction pill layout, and the active/inactive visual states.

**What we changed:**
- Dark theme colors (their source uses light `#ffffff` background pills)
- Integrated with Firestore instead of local state — reactions are stored on the message doc and persist across devices
- Built a combined action sheet (reactions + actions) instead of their separate `ReactionPicker` modal
- Added haptic feedback on reaction toggle

**New file:** [`components/MessageReactions.tsx`](../components/MessageReactions.tsx) — standalone display component

**Firestore writes:** Read-modify-write on `rides/{rideId}/messages/{messageId}.reactions`. Toggle logic: add emoji+uid if not present; remove uid if present; remove whole emoji entry if no uids remain.

**In chat.tsx:**
- `MessageReaction` type added to `Message`
- `toggleReaction(messageId, emoji)` function
- `actionTarget` state for the modal
- `handleLongPress` now sets `actionTarget` instead of calling `Alert.alert`
- `MessageReactions` component rendered below each bubble

---

### 3.3 Swipe-to-Reply

**Source:** `src/Message/index.tsx` — `ReanimatedSwipeable` usage pattern

**What we kept from source:** `ReanimatedSwipeable` from `react-native-gesture-handler/ReanimatedSwipeable`, the `renderLeftActions` + `onSwipeableWillOpen` + `onSwipeableOpen(snap back)` pattern, and the animated reply icon approach.

**What we changed:**
- Custom `SwipeReplyAction` component using our own icon style (`return-down-back-outline` in a `#2a2a2a` circle)
- Integrated with `replyingTo` state + input bar reply strip
- Reply written to Firestore as `replyMessage: { id, text, senderName }` on the message doc
- Rendered as a quoted block inside the bubble (with left border accent)

**In chat.tsx:**
- `ReplyMessage` type added to `Message`
- `replyingTo` state (`Message | null`)
- Every non-system message wrapped in `ReanimatedSwipeable`
- Reply preview strip above input bar when `replyingTo` is set
- `sendMessage` includes `replyMessage` in Firestore payload and clears `replyingTo` after send

---

### 3.4 Combined Action Sheet (replaces `Alert.alert`)

**Inspiration from source:** Their `onLongPressMessage` default handler + separate `ReactionPicker` modal.

**What we built:** A single dark `Modal` that appears on long press with:
1. Emoji reaction strip (6 emojis, highlighted if already reacted)
2. Reply button → sets `replyingTo`
3. Share button → `Share.share`
4. Delete (own messages) or Report User (others)

This replaces the native `Alert.alert` system modal, which broke immersion by popping outside the app's UI layer.

---

## 4. What's Left to Consider

These are features from the open source app we haven't integrated yet, roughly in order of value for BearPool:

### High value

**Link/URL auto-detection** (`src/linkParser.tsx`)
- Zero dependencies, ~250 lines of pure TypeScript regex
- Would auto-linkify Google Maps links, phone numbers, Lyft/Uber links that people share in ride chats
- Copy `linkParser.tsx` into `components/`, wrap `<Text>{msg.text}</Text>` in it inside the bubble
- Effort: ~2 hours

**Firestore pagination / load-earlier**
- Currently all messages for a ride load at once — fine for short chats but will get slow for long-running rides
- Pattern: initial load with `limit(50)` + `orderBy("timestamp", "desc")`, then `startAfter(oldestLoaded)` on "load earlier" tap
- The open source `LoadEarlierMessages` component is just a styled button — easy to copy
- Effort: ~1 day (requires changing the snapshot query structure)

**Message status ticks**
- Currently no per-message sent/read confirmation
- We already have per-user read state in `readState/{userId}.lastReadAt` — could derive "seen by all" status from it
- Add `sent: boolean` to the Firestore message doc (set it `true` in Cloud Function `onRideMessageCreated`)
- Render single `✓` in bubble timestamp area
- Effort: ~half a day

### Medium value

**Typing indicator replacement**
- Current implementation: custom 3-dot animation with Firestore polling
- Their `TypingIndicator` component is more polished (slides in/out with animated height)
- Direct drop-in since we already provide the `isTyping: boolean` signal
- Effort: ~1 hour

**Floating day header (`DayAnimated`)**
- Date label floats at the top of the viewport and updates as you scroll through history
- Requires Reanimated worklet + per-divider layout measurement callbacks
- Currently we show static inline date dividers — functional but less polished
- Effort: ~2 days

**Image messages**
- People share pickup spot photos, receipts, etc.
- Requires `react-native-zoom-reanimated` native dep + Expo Storage or Firebase Storage for uploads
- Their lightbox with pinch-to-zoom is the main value
- Effort: ~3 days (storage setup + UI)

### Lower value for BearPool

**Streaming/AI messages** (`useStreamingMessages`)
- Clean hook for token-by-token AI responses
- Not relevant unless BearPool adds an AI assistant feature
- Zero deps — easy to drop in later if needed

**Audio/Video messages** — stubs in the library, full implementation would be a project of its own

---

## 5. What We Skipped

| Feature | Reason |
|---|---|
| Full library adoption | Library is a general-purpose chat UI; our implementation has BearPool-specific features (Firestore read state, chain rounding, system messages, profanity filter, archive notices) that would all need to be rebuilt on top |
| Audio messages | Stub in library; requires native audio recording/playback — separate project |
| Quick reply chips | Bot-style feature, not relevant for human rideshare coordination |
| Dark/light theming | App is hardcoded dark; their theming system adds complexity for no gain |
| `@expo/react-native-action-sheet` | We built our own action modal that fits the dark theme better |
| Image lightbox (for now) | Requires a new native dep (`react-native-zoom-reanimated`) and storage infrastructure |

---

## 6. Firestore Data Model

### Message document (`rides/{rideId}/messages/{messageId}`)

```typescript
{
  text: string;                          // message content
  senderId: string;                      // Firebase uid
  senderName: string;                    // denormalized username
  timestamp: Timestamp;                  // Firestore server timestamp

  // Optional fields
  system?: boolean;                      // join/leave events from Cloud Function
  archivedNotice?: boolean;              // ride archived notice
  deleted?: boolean;                     // soft delete

  // Added in June 2026 refactor
  reactions?: {
    emoji: string;                       // e.g. "👍"
    userIds: string[];                   // Firebase uids who reacted
  }[];
  replyMessage?: {
    id: string;                          // message doc id being replied to
    text: string;                        // snapshot of reply text
    senderName: string;                  // snapshot of sender name
  };
}
```

### Read state (`rides/{rideId}/readState/{userId}`)

```typescript
{
  lastReadAt: Timestamp;                 // last time user read this chat
  activeChat: boolean;                   // true while user has chat screen focused
  activeAt: Timestamp;                   // heartbeat, refreshed every 27s
}
```

### Typing state (`rides/{rideId}/typing/{userId}`)

```typescript
{
  isTyping: boolean;
  name: string;                          // display name for "X is typing..."
  updatedAt: Timestamp;                  // stale after 8s
}
```

---

## Architecture Notes

**Why not Redux/Zustand?** All state is Firestore + local `useState`. Adding a global store would create a second source of truth for message data that could drift from Firestore's real-time updates.

**Why `useAnimatedRef` + Reanimated `scrollTo`?** React Native's `FlatList.scrollToOffset` runs on the JS thread and can be blocked by heavy renders. Reanimated's `scrollTo` runs on the UI thread — same reason gifted-chat uses it.

**Why `GHTouchableOpacity` for the FAB?** On New Architecture, RN's `TouchableOpacity` can lose the touch event race to RNGH's gesture system. Using RNGH's own `TouchableOpacity` puts it in the same gesture priority system as the `FlatList`.

**Why `GestureHandlerRootView` in `_layout.tsx`?** Required for any explicit RNGH component usage. Without it, RNGH's legacy components (`ReanimatedSwipeable`, `GHTouchableOpacity`) throw at runtime.
