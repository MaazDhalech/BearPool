import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

admin.initializeApp();
const db = admin.firestore();

type ExpoPushPayload = {
  sound?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};

type PushMessage = {
  userId: string;
  token: string;
  payload: ExpoPushPayload;
};

const TRUNCATE_BODY_AT = 120;
const ACTIVE_THRESHOLD_MS = 75 * 1000;
const EXPO_BATCH_SIZE = 100;
const RECEIPTS_COLLECTION = "pushReceipts";

const isRecent = (ts: admin.firestore.Timestamp | undefined | null) => {
  if (!ts) return false;
  return Date.now() - ts.toMillis() < ACTIVE_THRESHOLD_MS;
};

const formatBody = (text: string) =>
  text.length <= TRUNCATE_BODY_AT ? text : `${text.slice(0, TRUNCATE_BODY_AT)}…`;

const resolveTokens = (userData: admin.firestore.DocumentData | undefined): string[] => {
  if (!userData) return [];
  const tokens: string[] = [];
  if (userData.expoPushToken && typeof userData.expoPushToken === "string") {
    tokens.push(userData.expoPushToken);
  }
  if (userData.pushTokens && typeof userData.pushTokens === "object") {
    tokens.push(
      ...Object.values(userData.pushTokens).filter(
        (val): val is string => typeof val === "string"
      )
    );
  }
  return Array.from(new Set(tokens));
};

const removeInvalidToken = async (userId: string, token: string): Promise<void> => {
  const userRef = db.collection("users").doc(userId);
  await db.runTransaction(async (txn) => {
    const snap = await txn.get(userRef);
    if (!snap.exists) return;
    const data = snap.data() || {};
    let changed = false;

    if (data.expoPushToken === token) {
      txn.update(userRef, { expoPushToken: admin.firestore.FieldValue.delete() });
      changed = true;
    }

    if (data.pushTokens && typeof data.pushTokens === "object") {
      const newMap: Record<string, string> = {};
      for (const [key, val] of Object.entries(data.pushTokens)) {
        if (typeof val === "string" && val !== token) {
          newMap[key] = val;
        } else {
          changed = true;
        }
      }
      txn.update(userRef, { pushTokens: newMap });
    }

    if (!changed) {
      logger.info(`Token ${token} not found on user ${userId}, no cleanup needed.`);
    }
  });
};

/**
 * Send a single batch (≤100 messages) to the Expo push API.
 * Handles immediate ticket errors and stores receipt IDs for deferred checking.
 */
const sendPushBatch = async (messages: PushMessage[]): Promise<void> => {
  let json: any;
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        messages.map(({ token, payload }) => ({ to: token, ...payload }))
      ),
    });
    json = await res.json();
  } catch (err) {
    logger.error("Expo push request failed (network error)", { error: String(err) });
    return;
  }

  const tickets: any[] = Array.isArray(json?.data) ? json.data : [];
  const receiptBatch = db.batch();
  let hasReceipts = false;

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    const { userId, token } = messages[i];

    if (ticket?.status === "ok" && ticket?.id) {
      // Store receipt ID so the scheduled function can verify delivery later
      receiptBatch.set(db.collection(RECEIPTS_COLLECTION).doc(ticket.id), {
        userId,
        token,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      hasReceipts = true;
      logger.info(`📨 Ticket OK for ${userId}`, { token, receiptId: ticket.id });
    } else if (ticket?.details?.error === "DeviceNotRegistered") {
      logger.warn(`🧹 Removing invalid token (ticket) for ${userId}`, { token });
      await removeInvalidToken(userId, token);
    } else {
      logger.error(`❌ Ticket error for ${userId}`, { token, ticket });
    }
  }

  if (hasReceipts) {
    try {
      await receiptBatch.commit();
    } catch (err) {
      logger.error("Failed to store receipt IDs", { error: String(err) });
    }
  }
};

export const onRideMessageCreated = onDocumentCreated(
  "rides/{rideId}/messages/{messageId}",
  async (event) => {
    const message = event.data?.data();
    const { rideId, messageId } = event.params;

    if (!message || !rideId) {
      logger.warn("Skipping: missing message or rideId", { rideId, messageId });
      return;
    }

    if (!message.senderId || message.system === true) {
      logger.info("Skipping system message", { rideId, messageId });
      return;
    }

    // Resolve message timestamp
    let messageTimestamp: admin.firestore.Timestamp;
    if (message.timestamp instanceof admin.firestore.Timestamp) {
      messageTimestamp = message.timestamp;
    } else if (event.data?.createTime instanceof admin.firestore.Timestamp) {
      messageTimestamp = event.data.createTime;
    } else if (
      event.data?.createTime &&
      typeof (event.data.createTime as any).toMillis === "function"
    ) {
      messageTimestamp = admin.firestore.Timestamp.fromMillis(
        (event.data.createTime as any).toMillis()
      );
    } else if (typeof event.time === "string") {
      messageTimestamp = admin.firestore.Timestamp.fromDate(new Date(event.time));
    } else {
      messageTimestamp = admin.firestore.Timestamp.now();
    }

    const rideSnap = await db.collection("rides").doc(rideId).get();
    const rideData = rideSnap.data();
    const memberIds: string[] = Array.isArray(rideData?.memberIds) ? rideData.memberIds : [];

    if (memberIds.length === 0) {
      logger.warn("No members found for ride", { rideId });
      return;
    }

    const recipients = memberIds.filter((id) => id && id !== message.senderId);
    if (recipients.length === 0) {
      logger.info("No recipients (sender is the only member)", { rideId });
      return;
    }

    const rideLabel =
      rideData?.from && rideData?.to
        ? `${rideData.from} → ${rideData.to}`
        : "Ride chat";
    const senderLabel =
      typeof message.senderName === "string" && message.senderName.length > 0
        ? message.senderName
        : "New message";

    const payload: ExpoPushPayload = {
      sound: "default",
      title: `${rideLabel} — ${senderLabel}`,
      body: formatBody(String(message.text || "")),
      data: { type: "chat_message", rideId },
    };

    // Fetch all member read states and user tokens in parallel
    const memberResults = await Promise.allSettled(
      recipients.map(async (memberId) => {
        const [readStateSnap, userSnap] = await Promise.all([
          db.collection("rides").doc(rideId).collection("readState").doc(memberId).get(),
          db.collection("users").doc(memberId).get(),
        ]);
        return { memberId, readStateSnap, userSnap };
      })
    );

    // Build the flat list of messages to send
    const messages: PushMessage[] = [];
    for (const result of memberResults) {
      if (result.status === "rejected") {
        logger.error("Failed to fetch member data", { error: String(result.reason) });
        continue;
      }

      const { memberId, readStateSnap, userSnap } = result.value;
      const readState = readStateSnap.data() || {};
      const activeChat = readState.activeChat === true;
      const activeAt: admin.firestore.Timestamp | undefined = readState.activeAt;
      const lastReadAt: admin.firestore.Timestamp | undefined = readState.lastReadAt;

      const suppressForActive = activeChat && isRecent(activeAt);
      const suppressForRead =
        !!lastReadAt && lastReadAt.toMillis() >= messageTimestamp.toMillis();

      if (suppressForActive || suppressForRead) {
        logger.info("Suppressing notification", {
          rideId,
          memberId,
          suppressForActive,
          suppressForRead,
        });
        continue;
      }

      const tokens = resolveTokens(userSnap.data());
      if (tokens.length === 0) {
        logger.info("No tokens for user", { memberId });
        continue;
      }

      for (const token of tokens) {
        messages.push({ userId: memberId, token, payload });
      }
    }

    if (messages.length === 0) {
      logger.info("No messages to send", { rideId });
      return;
    }

    // Split into batches of EXPO_BATCH_SIZE and send all batches in parallel
    const batches: PushMessage[][] = [];
    for (let i = 0; i < messages.length; i += EXPO_BATCH_SIZE) {
      batches.push(messages.slice(i, i + EXPO_BATCH_SIZE));
    }

    await Promise.all(batches.map(sendPushBatch));
    logger.info(
      `✅ Sent ${messages.length} push(es) for message ${messageId} across ${batches.length} batch(es)`
    );
  }
);

/**
 * Writes system messages when members join or leave a ride.
 * Runs server-side so exactly one message is written per event,
 * regardless of how many clients are viewing the chat.
 */
export const onRideMembersChanged = onDocumentUpdated(
  "rides/{rideId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const { rideId } = event.params;

    if (!before || !after) return;

    const prevMembers: string[] = Array.isArray(before.memberIds) ? before.memberIds : [];
    const newMembers: string[] = Array.isArray(after.memberIds) ? after.memberIds : [];

    const joined = newMembers.filter((uid) => !prevMembers.includes(uid));
    const left = prevMembers.filter((uid) => !newMembers.includes(uid));
    const hostChanged = before.hostId !== after.hostId && !!after.hostId;

    if (joined.length === 0 && left.length === 0 && !hostChanged) return;

    const messagesRef = db.collection("rides").doc(rideId).collection("messages");
    const rideLabel =
      after.from && after.to ? `${after.from} → ${after.to}` : "Ride";

    const resolveUsername = async (uid: string): Promise<string> => {
      try {
        const snap = await db.collection("users").doc(uid).get();
        return snap.data()?.username || "Anonymous";
      } catch {
        return "Anonymous";
      }
    };

    // Fetch tokens for a list of user IDs, returns flat PushMessage array
    const buildPushMessages = async (
      recipientIds: string[],
      payload: ExpoPushPayload
    ): Promise<PushMessage[]> => {
      const results = await Promise.allSettled(
        recipientIds.map((uid) => db.collection("users").doc(uid).get())
      );
      const messages: PushMessage[] = [];
      for (const result of results) {
        if (result.status === "rejected") continue;
        const tokens = resolveTokens(result.value.data());
        const uid = result.value.id;
        for (const token of tokens) {
          messages.push({ userId: uid, token, payload });
        }
      }
      return messages;
    };

    // Filter out recipients who are actively viewing the chat right now
    const filterActiveChat = async (recipientIds: string[]): Promise<string[]> => {
      const results = await Promise.allSettled(
        recipientIds.map(async (uid) => {
          const snap = await db.collection("rides").doc(rideId).collection("readState").doc(uid).get();
          const readState = snap.data() || {};
          const suppress = readState.activeChat === true && isRecent(readState.activeAt);
          return { uid, suppress };
        })
      );
      return results
        .filter((r): r is PromiseFulfilledResult<{ uid: string; suppress: boolean }> =>
          r.status === "fulfilled" && !r.value.suppress
        )
        .map((r) => r.value.uid);
    };

    await Promise.all([
      // Notify all members when the host changes
      ...(hostChanged
        ? [
            (async () => {
              const newHostName = await resolveUsername(after.hostId);
              const text = `${newHostName} has been made the host`;

              // Notify all members including the new host
              const recipients = await filterActiveChat(newMembers);
              if (recipients.length > 0) {
                const messages = await buildPushMessages(recipients, {
                  sound: "default",
                  title: rideLabel,
                  body: text,
                  data: { type: "host_changed", rideId },
                });
                if (messages.length > 0) await sendPushBatch(messages);
              }
              logger.info(`Host changed to ${newHostName} in ride ${rideId}`);
            })(),
          ]
        : []),
      ...joined.map(async (uid) => {
        const name = await resolveUsername(uid);
        const text = `${name} has joined the ride`;

        // System message — deterministic ID makes retries idempotent
        await messagesRef.doc(`${event.id}-join-${uid}`).set({
          text,
          senderId: null,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          system: true,
        });
        logger.info(`System message: ${name} joined ride ${rideId}`);

        // Notify members already in the ride, excluding joiner and anyone actively viewing
        const candidateRecipients = prevMembers.filter((id) => id !== uid);
        const recipients = await filterActiveChat(candidateRecipients);
        if (recipients.length > 0) {
          const messages = await buildPushMessages(recipients, {
            sound: "default",
            title: rideLabel,
            body: text,
            data: { type: "member_joined", rideId },
          });
          if (messages.length > 0) await sendPushBatch(messages);
        }
      }),
      ...left.map(async (uid) => {
        const name = await resolveUsername(uid);
        const wasKicked = !!(after.kickedBy && after.kickedBy[uid]);
        const text = wasKicked ? `${name} was removed from the ride` : `${name} has left the ride`;

        // System message — deterministic ID makes retries idempotent
        await messagesRef.doc(`${event.id}-leave-${uid}`).set({
          text,
          senderId: null,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          system: true,
        });
        logger.info(`System message: ${name} left ride ${rideId}`);

        // Notify members still in the ride, excluding anyone actively viewing
        const candidateRecipients = newMembers.filter((id) => id !== uid);
        const recipients = await filterActiveChat(candidateRecipients);
        if (recipients.length > 0) {
          const messages = await buildPushMessages(recipients, {
            sound: "default",
            title: rideLabel,
            body: text,
            data: { type: wasKicked ? "member_kicked" : "member_left", rideId },
          });
          if (messages.length > 0) await sendPushBatch(messages);
        }
      }),
    ]);
  }
);

/**
 * Checks Expo push receipts every hour to catch delivery errors that weren't
 * reported in the initial ticket response (e.g. DeviceNotRegistered).
 * Processes up to 300 receipts per run (Expo's per-request limit).
 */
export const checkPushReceipts = onSchedule("every 60 minutes", async () => {
  const snapshot = await db
    .collection(RECEIPTS_COLLECTION)
    .orderBy("createdAt")
    .limit(300)
    .get();

  if (snapshot.empty) {
    logger.info("No receipts to check");
    return;
  }

  const ids = snapshot.docs.map((d) => d.id);
  const metaMap: Record<string, { userId: string; token: string }> = {};
  for (const d of snapshot.docs) {
    metaMap[d.id] = { userId: d.data().userId, token: d.data().token };
  }

  let json: any;
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids }),
    });
    json = await res.json();
  } catch (err) {
    logger.error("Failed to fetch push receipts (network error)", { error: String(err) });
    return;
  }

  const receipts: Record<string, any> = json?.data || {};
  const deleteBatch = db.batch();
  const tokenCleanupTasks: Array<() => Promise<void>> = [];

  for (const [receiptId, receipt] of Object.entries(receipts)) {
    const meta = metaMap[receiptId];

    if (receipt.status === "ok") {
      logger.info("✅ Receipt OK", { receiptId });
    } else if (receipt.details?.error === "DeviceNotRegistered") {
      logger.warn(`🧹 Removing invalid token (receipt) for ${meta?.userId}`, {
        receiptId,
        token: meta?.token,
      });
      if (meta) {
        tokenCleanupTasks.push(() => removeInvalidToken(meta.userId, meta.token));
      }
    } else {
      logger.error("❌ Receipt error", { receiptId, receipt });
    }

    // Always delete the receipt doc once processed (success or failure)
    deleteBatch.delete(db.collection(RECEIPTS_COLLECTION).doc(receiptId));
  }

  await deleteBatch.commit();
  await Promise.allSettled(tokenCleanupTasks.map((fn) => fn()));

  logger.info(`✅ Processed ${Object.keys(receipts).length} receipt(s)`);
});
