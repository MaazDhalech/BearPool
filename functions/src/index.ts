import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

admin.initializeApp();
const db = admin.firestore();

type PushTarget = {
  userId: string;
  tokens: string[];
};

const TRUNCATE_BODY_AT = 120;
const ACTIVE_THRESHOLD_MS = 75 * 1000;

const isRecent = (ts: admin.firestore.Timestamp | undefined | null) => {
  if (!ts) return false;
  const now = Date.now();
  return now - ts.toMillis() < ACTIVE_THRESHOLD_MS;
};

const formatBody = (text: string) => {
  if (text.length <= TRUNCATE_BODY_AT) return text;
  return `${text.slice(0, TRUNCATE_BODY_AT)}…`;
};

const resolveTokens = (userData: admin.firestore.DocumentData | undefined) => {
  if (!userData) return [] as string[];

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

  // Deduplicate
  return Array.from(new Set(tokens));
};

const removeInvalidToken = async (
  userId: string,
  token: string
): Promise<void> => {
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

const sendPush = async (target: PushTarget, payload: any) => {
  for (const token of target.tokens) {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: token, ...payload }),
    });

    const json: any = await res.json();
    const details = Array.isArray(json?.data) ? json.data[0] : json?.data;
    const status = details?.status ?? (json as any)?.status;

    if (status === "ok") {
      logger.info(`📨 Push sent to ${target.userId}`, { token, status });
    } else if (details?.details?.error === "DeviceNotRegistered") {
      logger.warn(`🧹 Removing invalid token for ${target.userId}`, {
        token,
        response: json,
      });
      await removeInvalidToken(target.userId, token);
    } else {
      logger.error(`❌ Push failed for ${target.userId}`, { token, response: json });
    }
  }
};

export const onRideMessageCreated = onDocumentCreated(
  "rides/{rideId}/messages/{messageId}",
  async (event) => {
    const message = event.data?.data();
    const { rideId, messageId } = event.params;

    if (!message || !rideId) {
      logger.warn("Skipping notification: missing message or rideId", { rideId, messageId });
      return;
    }

    if (!message.senderId || message.system === true) {
      logger.info("Skipping system message push", { rideId, messageId });
      return;
    }

    let messageTimestamp: admin.firestore.Timestamp;
    if (message.timestamp instanceof admin.firestore.Timestamp) {
      messageTimestamp = message.timestamp;
    } else if (
      event.data?.createTime instanceof admin.firestore.Timestamp
    ) {
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
    } else if (typeof (event as any)?.timestamp === "string") {
      messageTimestamp = admin.firestore.Timestamp.fromDate(
        new Date((event as any).timestamp)
      );
    } else {
      messageTimestamp = admin.firestore.Timestamp.now();
    }

    const rideSnap = await db.collection("rides").doc(rideId).get();
    const rideData = rideSnap.data();
    const memberIds: string[] = Array.isArray(rideData?.memberIds) ? rideData.memberIds : [];

    if (memberIds.length === 0) {
      logger.warn("No members found for ride, skipping notifications", { rideId });
      return;
    }

    for (const memberId of memberIds) {
      if (!memberId || memberId === message.senderId) continue;

      const readStateSnap = await db
        .collection("rides")
        .doc(rideId)
        .collection("readState")
        .doc(memberId)
        .get();

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

      const userSnap = await db.collection("users").doc(memberId).get();
      const tokens = resolveTokens(userSnap.data());

      if (tokens.length === 0) {
        logger.info("No tokens for user, skipping push", { memberId });
        continue;
      }

      const rideLabel =
        rideData?.from && rideData?.to
          ? `${rideData.from} → ${rideData.to}`
          : "Ride chat";
      const senderLabel =
        typeof message.senderName === "string" && message.senderName.length > 0
          ? message.senderName
          : "New message";

      const payload = {
        sound: "default",
        title: `${rideLabel} — ${senderLabel}`,
        body: formatBody(String(message.text || "")),
        data: {
          type: "chat_message",
          rideId,
        },
      };

      await sendPush({ userId: memberId, tokens }, payload);
    }
  }
);
