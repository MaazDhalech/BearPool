import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

admin.initializeApp();
const db = admin.firestore();

// When a new message is sent, buffer it for batched notifications
export const bufferMessageNotification = onDocumentCreated(
  "rides/{rideId}/messages/{messageId}",
  async (event) => {
    const message = event.data?.data();
    const { rideId } = event.params;
    if (!message || !rideId || !message.senderId) return;

    const rideDoc = await db.collection("rides").doc(rideId).get();
    const rideData = rideDoc.data();
    if (!rideData?.memberIds) return;

    for (const memberId of rideData.memberIds) {
      if (memberId === message.senderId) continue;

      const notifDocRef = db
        .collection("rides")
        .doc(rideId)
        .collection("pendingNotifications")
        .doc(memberId);

      await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(notifDocRef);
        if (!doc.exists) {
          transaction.set(notifDocRef, {
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            count: 1,
          });
        } else {
          transaction.update(notifDocRef, {
            count: admin.firestore.FieldValue.increment(1),
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      });
    }
  }
);

// Run every minute to send batched notifications
export const sendBatchedNotifications = onSchedule("every 1 minutes", async () => {
  const ridesSnap = await db.collection("rides").get();

  for (const rideDoc of ridesSnap.docs) {
    const rideId = rideDoc.id;
    const notifSnap = await db
      .collection("rides")
      .doc(rideId)
      .collection("pendingNotifications")
      .get();

    for (const doc of notifSnap.docs) {
      const userId = doc.id;
      const data = doc.data();
      const count = data.count;

      const userDoc = await db.collection("users").doc(userId).get();
      const token = userDoc.data()?.expoPushToken;
      if (!token) continue;

      const payload = {
        to: token,
        sound: "default",
        title: "New Messages",
        body: `You have ${count} new message${count > 1 ? "s" : ""} in your ride chat.`,
      };

      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      logger.info(`✅ Batched notification sent to ${userId}`, result);

      await doc.ref.delete(); // Clear after sending
    }
  }
});
