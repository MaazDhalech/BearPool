import AsyncStorage from "@react-native-async-storage/async-storage";

// Snapshot of the ride fields that were baked into the device calendar event,
// so we can detect drift (host edited the ride) without re-fetching on every check.
export type SyncedRideFields = {
  from: string;
  to: string;
  date: string;
  time: string;
  notes: string;
};

export type CalendarLink = {
  eventId: string;
  syncedFields: SyncedRideFields;
};

const storageKey = (userId: string, rideId: string) => `calendarEvent:${userId}:${rideId}`;

export async function getCalendarLink(userId: string, rideId: string): Promise<CalendarLink | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId, rideId));
    if (!raw) return null;
    return JSON.parse(raw) as CalendarLink;
  } catch (error) {
    console.warn("Failed to read calendar link", error);
    return null;
  }
}

export async function setCalendarLink(userId: string, rideId: string, link: CalendarLink): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(userId, rideId), JSON.stringify(link));
  } catch (error) {
    console.warn("Failed to store calendar link", error);
  }
}

export async function clearCalendarLink(userId: string, rideId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(userId, rideId));
  } catch (error) {
    console.warn("Failed to clear calendar link", error);
  }
}

const promptDismissedKey = (userId: string, rideId: string) => `calendarPromptDismissed:${userId}:${rideId}`;

export async function getCalendarPromptDismissed(userId: string, rideId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(promptDismissedKey(userId, rideId))) !== null;
  } catch (error) {
    console.warn("Failed to read calendar prompt dismissal", error);
    return false;
  }
}

export async function setCalendarPromptDismissed(userId: string, rideId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(promptDismissedKey(userId, rideId), String(Date.now()));
  } catch (error) {
    console.warn("Failed to store calendar prompt dismissal", error);
  }
}
