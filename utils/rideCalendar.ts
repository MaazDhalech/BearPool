import * as Calendar from "expo-calendar";

import { toast } from "@/components/ui/Dialog";
import {
  clearCalendarLink,
  getCalendarLink,
  setCalendarLink,
  type SyncedRideFields,
} from "@/utils/calendarLink";

const REMINDER_MINUTES_BEFORE = 30;
const EVENT_DURATION_MS = 60 * 60 * 1000; // 1 hour, fixed — rides have no stored end time

export type RideForCalendar = {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  notes?: string;
};

async function requestCalendarAccess(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status === "granted") return true;
  toast("Calendar access is off. Enable it for BearPool in Settings to add rides.", { type: "error" });
  return false;
}

function syncedFieldsFromRide(ride: RideForCalendar): SyncedRideFields {
  return { from: ride.from, to: ride.to, date: ride.date, time: ride.time, notes: ride.notes ?? "" };
}

function rideFieldsChanged(synced: SyncedRideFields, ride: RideForCalendar): boolean {
  const current = syncedFieldsFromRide(ride);
  return (
    synced.from !== current.from ||
    synced.to !== current.to ||
    synced.date !== current.date ||
    synced.time !== current.time ||
    synced.notes !== current.notes
  );
}

function buildEventDetails(ride: RideForCalendar, startDate: Date) {
  return {
    title: `Ride: ${ride.from} → ${ride.to}`,
    startDate,
    endDate: new Date(startDate.getTime() + EVENT_DURATION_MS),
    location: `${ride.from} → ${ride.to}`,
    notes: ride.notes || undefined,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    alarms: [{ relativeOffset: -REMINDER_MINUTES_BEFORE }],
  };
}

export async function isRideLinkedToCalendar(userId: string, rideId: string): Promise<boolean> {
  return (await getCalendarLink(userId, rideId)) !== null;
}

// Presents the OS's own "New Event" sheet (EKEventEditViewController on iOS, a Calendar
// intent on Android) pre-filled with the ride details, rather than writing the event
// silently — matches the native "Add to Calendar" pattern other apps use.
export async function addRideToCalendar(
  userId: string,
  ride: RideForCalendar,
  startDate: Date,
): Promise<boolean> {
  const granted = await requestCalendarAccess();
  if (!granted) return false;

  try {
    const result = await Calendar.createEventInCalendarAsync(buildEventDetails(ride, startDate), {
      startNewActivityTask: false,
    });

    if (result.action === "canceled" || result.action === "deleted") return false;

    // `id` is only ever populated on iOS; Android's calendar intent never returns one.
    // Without it we can't manage the event later (sync-on-edit, remove-on-leave/cancel),
    // so only the devices that get an id participate in that lifecycle tracking.
    if (result.id) {
      await setCalendarLink(userId, ride.id, { eventId: result.id, syncedFields: syncedFieldsFromRide(ride) });
    }
    return true;
  } catch (error) {
    console.error("Failed to add ride to calendar", error);
    toast("Couldn't add this ride to your calendar.", { type: "error" });
    return false;
  }
}

export async function removeRideFromCalendar(userId: string, rideId: string): Promise<void> {
  const link = await getCalendarLink(userId, rideId);
  if (!link) return;

  try {
    await Calendar.deleteEventAsync(link.eventId);
  } catch (error) {
    // Event may already be gone (removed natively, or permission revoked since) — still clear the link.
    console.warn("Failed to delete calendar event", error);
  } finally {
    await clearCalendarLink(userId, rideId);
  }
}

// Reconciles a previously-linked calendar event against the current ride state.
// Called on ride fetch since there's no live listener for ride docs.
export async function syncRideCalendarEvent(
  userId: string,
  ride: RideForCalendar,
  startDate: Date,
): Promise<void> {
  const link = await getCalendarLink(userId, ride.id);
  if (!link || !rideFieldsChanged(link.syncedFields, ride)) return;

  try {
    await Calendar.updateEventAsync(link.eventId, buildEventDetails(ride, startDate));
    await setCalendarLink(userId, ride.id, { eventId: link.eventId, syncedFields: syncedFieldsFromRide(ride) });
    toast("Calendar event updated to match the new ride details.", { type: "info" });
  } catch (error) {
    console.warn("Failed to sync calendar event, clearing stale link", error);
    await clearCalendarLink(userId, ride.id);
  }
}
