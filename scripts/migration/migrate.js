require("dotenv").config();
const { createClerkClient } = require("@clerk/backend");
const admin = require("firebase-admin");
const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT);

// ── Init ──────────────────────────────────────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID,
});

const auth = admin.auth();
const db = admin.firestore();
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

// ── Helpers ───────────────────────────────────────────────────────────────────
function replaceId(value, map) {
  if (typeof value === "string") return map[value] ?? value;
  if (Array.isArray(value)) return value.map((v) => map[v] ?? v);
  return value;
}

// ── Step 1: Export Clerk users → create Firebase Auth users ──────────────────
async function migrateUsers() {
  console.log("\n[1/5] Fetching users from Clerk...");
  const { data: clerkUsers } = await clerk.users.getUserList({ limit: 500 });
  console.log(`  Found ${clerkUsers.length} users`);

  const idMap = {}; // clerkId → firebaseUid

  for (const user of clerkUsers) {
    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) {
      console.warn(`  Skipping user ${user.id} — no email`);
      continue;
    }

    try {
      const fbUser = await auth.createUser({
        email,
        displayName: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim(),
        emailVerified: user.emailAddresses[0]?.verification?.status === "verified",
      });
      idMap[user.id] = fbUser.uid;
      console.log(`  ✓ ${email} → ${fbUser.uid}`);
    } catch (err) {
      if (err.code === "auth/email-already-exists") {
        const existing = await auth.getUserByEmail(email);
        idMap[user.id] = existing.uid;
        console.log(`  ~ ${email} already exists → ${existing.uid}`);
      } else {
        console.error(`  ✗ Failed to create ${email}:`, err.message);
      }
    }
  }

  console.log(`\n  ID map built: ${Object.keys(idMap).length} entries`);
  return idMap;
}

// ── Step 2: Re-key users collection ──────────────────────────────────────────
async function migrateUsersCollection(idMap) {
  console.log("\n[2/5] Migrating users collection...");
  const snapshot = await db.collection("users").get();
  const batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    const clerkId = doc.id;
    const firebaseUid = idMap[clerkId];
    if (!firebaseUid) {
      console.warn(`  No mapping for user ${clerkId} — skipping`);
      continue;
    }

    const data = doc.data();
    const updated = {
      ...data,
      clerkId: undefined, // remove old field
      blockedUsers: (data.blockedUsers ?? []).map((id) => idMap[id] ?? id),
    };
    delete updated.clerkId;

    batch.set(db.collection("users").doc(firebaseUid), updated);
    batch.delete(doc.ref);
    count++;
  }

  await batch.commit();
  console.log(`  ✓ Migrated ${count} user documents`);
}

// ── Step 3: Migrate rides + subcollections ────────────────────────────────────
async function migrateRides(idMap) {
  console.log("\n[3/5] Migrating rides collection...");
  const ridesSnapshot = await db.collection("rides").get();
  let rideCount = 0;

  for (const rideDoc of ridesSnapshot.docs) {
    const data = rideDoc.data();
    const ref = rideDoc.ref;

    // Update top-level ride fields
    const updates = {};
    if (data.hostId) updates.hostId = idMap[data.hostId] ?? data.hostId;
    if (data.memberIds) updates.memberIds = data.memberIds.map((id) => idMap[id] ?? id);

    // kickedBy: { kickedUserId: kickerUserId } — remap both keys and values
    if (data.kickedBy) {
      const newKickedBy = {};
      for (const [kicked, kicker] of Object.entries(data.kickedBy)) {
        newKickedBy[idMap[kicked] ?? kicked] = idMap[kicker] ?? kicker;
      }
      updates.kickedBy = newKickedBy;
    }

    await ref.update(updates);
    rideCount++;

    // messages subcollection
    const messagesSnap = await ref.collection("messages").get();
    const msgBatch = db.batch();
    for (const msgDoc of messagesSnap.docs) {
      const msg = msgDoc.data();
      if (msg.senderId) {
        msgBatch.update(msgDoc.ref, { senderId: idMap[msg.senderId] ?? msg.senderId });
      }
    }
    await msgBatch.commit();

    // readState subcollection — document IDs are user IDs
    const readStateSnap = await ref.collection("readState").get();
    for (const rsDoc of readStateSnap.docs) {
      const clerkId = rsDoc.id;
      const firebaseUid = idMap[clerkId];
      if (firebaseUid && firebaseUid !== clerkId) {
        await ref.collection("readState").doc(firebaseUid).set(rsDoc.data());
        await rsDoc.ref.delete();
      }
    }

    // kickLogs subcollection
    const kickLogsSnap = await ref.collection("kickLogs").get();
    const kickBatch = db.batch();
    for (const klDoc of kickLogsSnap.docs) {
      const kl = klDoc.data();
      const klUpdates = {};
      if (kl.kickedUserId) klUpdates.kickedUserId = idMap[kl.kickedUserId] ?? kl.kickedUserId;
      if (kl.kickedBy) klUpdates.kickedBy = idMap[kl.kickedBy] ?? kl.kickedBy;
      if (Object.keys(klUpdates).length) kickBatch.update(klDoc.ref, klUpdates);
    }
    await kickBatch.commit();
  }

  console.log(`  ✓ Migrated ${rideCount} rides`);
}

// ── Step 4: Migrate feedback + reports + pushReceipts ────────────────────────
async function migrateOtherCollections(idMap) {
  console.log("\n[4/5] Migrating feedback, reports, pushReceipts...");

  // feedback
  const feedbackSnap = await db.collection("feedback").get();
  const fbBatch = db.batch();
  for (const doc of feedbackSnap.docs) {
    const d = doc.data();
    const updates = {};
    if (d.userId) updates.userId = idMap[d.userId] ?? d.userId;
    if (d.hostId) updates.hostId = idMap[d.hostId] ?? d.hostId;
    if (Object.keys(updates).length) fbBatch.update(doc.ref, updates);
  }
  await fbBatch.commit();
  console.log(`  ✓ feedback (${feedbackSnap.size} docs)`);

  // reports
  const reportsSnap = await db.collection("reports").get();
  const rBatch = db.batch();
  for (const doc of reportsSnap.docs) {
    const d = doc.data();
    const updates = {};
    if (d.reporterId) updates.reporterId = idMap[d.reporterId] ?? d.reporterId;
    if (d.reportedUserId) updates.reportedUserId = idMap[d.reportedUserId] ?? d.reportedUserId;
    if (Object.keys(updates).length) rBatch.update(doc.ref, updates);
  }
  await rBatch.commit();
  console.log(`  ✓ reports (${reportsSnap.size} docs)`);

  // pushReceipts
  const receiptsSnap = await db.collection("pushReceipts").get();
  const prBatch = db.batch();
  for (const doc of receiptsSnap.docs) {
    const d = doc.data();
    if (d.userId) prBatch.update(doc.ref, { userId: idMap[d.userId] ?? d.userId });
  }
  await prBatch.commit();
  console.log(`  ✓ pushReceipts (${receiptsSnap.size} docs)`);
}

// ── Step 5: Send password reset emails ───────────────────────────────────────
async function sendPasswordResets(idMap) {
  console.log("\n[5/5] Sending password reset emails...");
  let count = 0;
  for (const firebaseUid of Object.values(idMap)) {
    try {
      const user = await auth.getUser(firebaseUid);
      await auth.generatePasswordResetLink(user.email);
      // In production, send this link via your email provider.
      // For now, Firebase will send it automatically when you call:
      // auth.sendPasswordResetEmail(user.email) via client SDK.
      count++;
    } catch (err) {
      console.warn(`  Could not generate reset for ${firebaseUid}:`, err.message);
    }
  }
  console.log(`  ✓ Reset links generated for ${count} users`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== BearPool Clerk → Firebase Auth Migration ===");
  console.log(`Project: ${process.env.FIREBASE_PROJECT_ID}`);

  const idMap = await migrateUsers();
  await migrateUsersCollection(idMap);
  await migrateRides(idMap);
  await migrateOtherCollections(idMap);
  await sendPasswordResets(idMap);

  console.log("\n✅ Migration complete.");
  console.log("   ID map summary:");
  for (const [clerkId, fbUid] of Object.entries(idMap)) {
    console.log(`   ${clerkId} → ${fbUid}`);
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
