import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { sendSupportReplyEmail } from './email';
import { sendLogToWorker } from './logClient';

admin.initializeApp();
const db = admin.firestore();

// ─── Secrets ──────────────────────────────────────────────────────────────────
// Provision each once with:
//   firebase functions:secrets:set RESEND_API_KEY
//   firebase functions:secrets:set WORKER_URL
//   firebase functions:secrets:set LOG_SECRET
//
// For local dev, add to functions/.secret.local:
//   RESEND_API_KEY=re_xxxxxxxx
//   WORKER_URL=https://syncron-worker.xxx.workers.dev
//   LOG_SECRET=your-shared-hmac-secret

const resendApiKey = defineSecret('RESEND_API_KEY');
const workerUrl    = defineSecret('WORKER_URL');
const logSecret    = defineSecret('LOG_SECRET');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 0, O, 1, I çıkarıldı
const MIN_TAG_LEN = 3;
const MAX_TAG_LEN = 10;
const MAX_TAG_CHANGES = 5;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

function randomTag(): string {
    let result = '';
    for (let i = 0; i <= 5; i++) {
        result += VALID_CHARS.charAt(Math.floor(Math.random() * VALID_CHARS.length));
    }
    return result;
}

/**
 * Atomically picks a unique 5-digit tag and writes it to:
 *   - tags/{tag}  → { uid, assignedAt }  (registry for uniqueness checks)
 *   - users/{uid} → { tag }
 *
 * Retries up to 20 times on collision (extremely rare at 32^5 slots).
 */
async function assignUniqueTag(uid: string): Promise<string> {
    const MAX_ATTEMPTS = 20;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const tag = randomTag();
        const tagRef = db.collection('tags').doc(tag);

        try {
            await db.runTransaction(async (tx) => {
                const snap = await tx.get(tagRef);
                if (snap.exists) throw new Error('TAG_TAKEN');
                tx.set(tagRef, {
                    uid,
                    assignedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                tx.update(db.collection('users').doc(uid), { tag });
            });
            return tag;
        } catch (err: unknown) {
            if ((err as Error).message !== 'TAG_TAKEN') throw err;
            // Collision — try another tag
        }
    }

    throw new Error(
        `[assignUniqueTag] Could not find a free tag after ${MAX_ATTEMPTS} attempts.`,
    );
}

// ─── Trigger: new users/{uid} document created ────────────────────────────────
// Fires when any user doc is first created. Anonymous users are skipped.

export const onUserCreated = functions.firestore.onDocumentCreated(
    {
        document: 'users/{uid}',
        secrets: [workerUrl, logSecret],
    },
    async (event) => {
        const uid = event.params.uid;
        const data = event.data?.data();

        if (!data) return;
        if (data.authProvider === 'anonymous') return; // no tag for anonymous users
        if (data.tag) return; // guard against re-trigger

        // 1. Assign tag (primary logic — must succeed)
        try {
            await assignUniqueTag(uid);
            functions.logger.info(`[onUserCreated] Tag assigned to ${uid}`);
        } catch (err) {
            functions.logger.error(`[onUserCreated] Failed to assign tag to ${uid}:`, err);
            // Do not return here — still attempt to log the account creation event
        }

        // 2. Audit log — fire-and-forget, non-fatal
        await sendLogToWorker(
            'account.create',
            'account',
            uid,
            {
                authProvider: data.authProvider ?? 'unknown',
                hasEmail:     !!data.email,
            },
            workerUrl.value(),
            logSecret.value(),
        );
    },
);

// ─── Trigger: anonymous user upgrades to google/email ────────────────────────
// The onUserCreated trigger won't fire on upgrade (same UID, doc already exists).

export const onUserUpgraded = functions.firestore.onDocumentUpdated(
    {
        document: 'users/{uid}',
        secrets: [workerUrl, logSecret],
    },
    async (event) => {
        const uid = event.params.uid;
        const before = event.data?.before.data();
        const after  = event.data?.after.data();

        if (!before || !after) return;
        if (before.authProvider !== 'anonymous') return; // only care about upgrades
        if (after.authProvider === 'anonymous') return;  // not actually upgraded
        if (after.tag) return;                           // tag already present

        // 1. Assign tag (primary logic — must succeed)
        try {
            await assignUniqueTag(uid);
            functions.logger.info(`[onUserUpgraded] Tag assigned to upgraded user ${uid}`);
        } catch (err) {
            functions.logger.error(`[onUserUpgraded] Failed to assign tag to ${uid}:`, err);
        }

        // 2. Audit log — fire-and-forget, non-fatal
        await sendLogToWorker(
            'account.upgrade',
            'account',
            uid,
            {
                from: 'anonymous',
                to:   after.authProvider ?? 'unknown',
            },
            workerUrl.value(),
            logSecret.value(),
        );
    },
);

// ─── Callable: set a custom tag ───────────────────────────────────────────────
// Client sends { tag: "MYTAG" }. Validates chars/length, checks rate limits,
// checks uniqueness, then atomically assigns.

export const requestNewTag = functions.https.onCall(
    {
        region: 'europe-west3',
        secrets: [workerUrl, logSecret],
    },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
        }

        const raw: string | undefined = request.data?.tag;
        if (!raw) {
            throw new functions.https.HttpsError('invalid-argument', 'TAG_REQUIRED');
        }

        const tag = raw.trim().toUpperCase();

        // Length check
        if (tag.length < MIN_TAG_LEN || tag.length > MAX_TAG_LEN) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                `TAG_LENGTH:${MIN_TAG_LEN}:${MAX_TAG_LEN}`,
            );
        }

        // Character check
        for (const ch of tag) {
            if (!VALID_CHARS.includes(ch)) {
                throw new functions.https.HttpsError('invalid-argument', 'TAG_INVALID_CHARS');
            }
        }

        const userRef  = db.collection('users').doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'User document not found.');
        }

        const userData = userSnap.data()!;
        if (userData.authProvider === 'anonymous') {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Anonymous users cannot have tags.',
            );
        }

        // No-op: user already has this tag
        if (userData.tag === tag) return { tag };

        // Change count limit
        const changeCount: number = userData.tagChangeCount ?? 0;
        if (changeCount >= MAX_TAG_CHANGES) {
            throw new functions.https.HttpsError('resource-exhausted', 'TAG_MAX_CHANGES');
        }

        // Cooldown: only applies after at least one manual change
        const tagChangedAt = userData.tagChangedAt;
        if (tagChangedAt) {
            const msSinceLast = Date.now() - tagChangedAt.toMillis();
            if (msSinceLast < TWO_WEEKS_MS) {
                const daysRemaining = Math.ceil((TWO_WEEKS_MS - msSinceLast) / (24 * 60 * 60 * 1000));
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    `TAG_COOLDOWN:${daysRemaining}`,
                );
            }
        }

        const previousTag: string | undefined = userData.tag;
        const tagRef = db.collection('tags').doc(tag);

        // Atomically verify uniqueness + assign
        try {
            await db.runTransaction(async (tx) => {
                const snap = await tx.get(tagRef);
                if (snap.exists && snap.data()?.uid !== uid) throw new Error('TAG_TAKEN');

                const oldTag: string | undefined = userData.tag;
                if (oldTag && oldTag !== tag) {
                    tx.delete(db.collection('tags').doc(oldTag));
                }

                tx.set(tagRef, { uid, assignedAt: admin.firestore.FieldValue.serverTimestamp() });
                tx.update(userRef, {
                    tag,
                    tagChangeCount: admin.firestore.FieldValue.increment(1),
                    tagChangedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            });
        } catch (err: unknown) {
            if ((err as Error).message === 'TAG_TAKEN') {
                throw new functions.https.HttpsError('already-exists', 'TAG_TAKEN');
            }
            throw err;
        }

        functions.logger.info(`[requestNewTag] Tag ${tag} assigned to ${uid}`);

        // Audit log — fire-and-forget, non-fatal
        // Note: HttpsError has already been thrown above if anything failed,
        // so reaching here means the transaction succeeded.
        await sendLogToWorker(
            'account.tag_change',
            'account',
            uid,
            {
                newTag:      tag,
                previousTag: previousTag ?? null,
                changeCount: changeCount + 1,
            },
            workerUrl.value(),
            logSecret.value(),
        );

        return { tag };
    },
);

// ─── Trigger: new message in a support ticket ─────────────────────────────────────────────
//
// Fires whenever a document is created inside:
//   supportTickets/{ticketId}/messages/{messageId}
//
// If senderType == 'admin':
//   • Sets hasUnreadUser = true on the parent ticket (user sees unread badge)
//   • Updates updatedAt on the parent ticket
//   • Sends a Resend notification email to the ticket owner (non-fatal on failure)
//
// If senderType == 'user':
//   • Sets hasUnreadAdmin = true on the parent ticket (admin sees unread badge)
//   • Updates updatedAt on the parent ticket
//
// IDEMPOTENCY: setting boolean flags to true is safe if the trigger fires
// more than once for the same message (Firebase at-least-once delivery).

export const onTicketMessageCreated = functions.firestore.onDocumentCreated(
    {
        document: 'supportTickets/{ticketId}/messages/{messageId}',
        region: 'europe-west3',
        secrets: [resendApiKey, workerUrl, logSecret],
    },
    async (event) => {
        const messageData = event.data?.data();
        if (!messageData) {
            functions.logger.warn(
                '[onTicketMessage] Event fired with no message data — skipping.',
                { ticketId: event.params.ticketId, messageId: event.params.messageId },
            );
            return;
        }

        const { ticketId, messageId } = event.params;
        const senderType = messageData.senderType as string | undefined;
        const senderUid  = messageData.senderUid  as string | undefined;

        // Fetch the parent ticket document
        const ticketRef = db.collection('supportTickets').doc(ticketId);
        let ticketSnap: FirebaseFirestore.DocumentSnapshot;
        try {
            ticketSnap = await ticketRef.get();
        } catch (err) {
            functions.logger.error(
                `[onTicketMessage] Failed to fetch parent ticket ${ticketId}:`, err,
            );
            return;
        }

        if (!ticketSnap.exists) {
            // This should not happen if the Worker creates both atomically,
            // but guard defensively.
            functions.logger.error(
                `[onTicketMessage] Parent ticket ${ticketId} not found for message ${messageId}. ` +
                'Ticket may not have been created yet or was deleted.',
            );
            return;
        }

        const ticketData = ticketSnap.data()!;

        if (senderType === 'admin') {
            // ── Admin sent a reply ────────────────────────────────────────────
            // Update parent ticket: mark as unread for user + refresh timestamp
            try {
                await ticketRef.update({
                    hasUnreadUser: true,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                functions.logger.info(
                    `[onTicketMessage] hasUnreadUser set for ticket ${ticketId} (admin reply ${messageId})`,
                );
            } catch (err) {
                // Log but continue — attempt email delivery even if Firestore update fails
                functions.logger.error(
                    `[onTicketMessage] Failed to update ticket ${ticketId} after admin reply:`, err,
                );
            }

            // Extract required fields for email
            const recipientEmail = ticketData.email as string | undefined;
            const displayName = typeof ticketData.displayName === 'string' && ticketData.displayName.length > 0
                ? ticketData.displayName
                : 'User';
            const subject = typeof ticketData.subject === 'string' && ticketData.subject.length > 0
                ? ticketData.subject
                : '(no subject)';
            const messageBody = typeof messageData.body === 'string'
                ? messageData.body
                : '';

            if (!recipientEmail || recipientEmail.trim().length === 0) {
                functions.logger.error(
                    `[onTicketMessage] Ticket ${ticketId} has no email address — cannot send notification.`,
                );
                // Fall through to audit log even if email cannot be sent
            } else {
                try {
                    await sendSupportReplyEmail(
                        { to: recipientEmail, displayName, ticketId, subject, messageBody },
                        resendApiKey.value(),
                    );
                    functions.logger.info(
                        `[onTicketMessage] Notification email sent to ${recipientEmail} for ticket ${ticketId}`,
                    );
                } catch (err) {
                    // Email failure is NON-FATAL — the message is already saved in Firestore.
                    functions.logger.error(
                        `[onTicketMessage] Failed to send notification email for ticket ${ticketId}:`, err,
                    );
                }
            }

        } else if (senderType === 'user') {
            // ── User sent a message (reply or initial ticket) ──────────────────────
            // Flag the ticket so admin sees the unread indicator in the panel
            try {
                await ticketRef.update({
                    hasUnreadAdmin: true,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                functions.logger.info(
                    `[onTicketMessage] hasUnreadAdmin set for ticket ${ticketId} (user message ${messageId})`,
                );
            } catch (err) {
                functions.logger.error(
                    `[onTicketMessage] Failed to update ticket ${ticketId} after user message:`, err,
                );
            }

        } else {
            // Unknown senderType — log for investigation but do not throw
            functions.logger.warn(
                `[onTicketMessage] Unknown senderType "${senderType}" on message ${messageId} ` +
                `in ticket ${ticketId}. No action taken.`,
            );
        }

        // ── Audit log (runs for both admin and user messages) ─────────────────
        // We only log user-sent messages (admin actions are tracked elsewhere).
        // senderUid is present only on user messages — skip if missing.
        if (senderType === 'user' && senderUid) {
            await sendLogToWorker(
                'ticket.message',
                'support',
                senderUid,
                {
                    ticketId,
                    messageId,
                    // ticketCategory and ticketSubject from parent ticket for context
                    ticketCategory: ticketData.category ?? null,
                    ticketSubject:  ticketData.subject  ?? null,
                },
                workerUrl.value(),
                logSecret.value(),
            );
        }
    },
);
