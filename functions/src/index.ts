import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomTag(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Karışıklık olmasın diye 0, O, 1, I harflerini çıkardım
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Atomically picks a unique 4-digit tag and writes it to:
 *   - tags/{tag}  → { uid, assignedAt }  (registry for uniqueness checks)
 *   - users/{uid} → { tag }
 *
 * Retries up to 20 times on collision (extremely rare at 10 000 slots).
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
    'users/{uid}',
    async (event) => {
        const uid = event.params.uid;
        const data = event.data?.data();

        if (!data) return;
        if (data.authProvider === 'anonymous') return; // no tag for anonymous users
        if (data.tag) return; // guard against re-trigger

        try {
            await assignUniqueTag(uid);
            functions.logger.info(`[onUserCreated] Tag assigned to ${uid}`);
        } catch (err) {
            functions.logger.error(`[onUserCreated] Failed to assign tag to ${uid}:`, err);
        }
    },
);

// ─── Trigger: anonymous user upgrades to google/email ────────────────────────
// The onUserCreated trigger won't fire on upgrade (same UID, doc already exists).

export const onUserUpgraded = functions.firestore.onDocumentUpdated(
    'users/{uid}',
    async (event) => {
        const uid = event.params.uid;
        const before = event.data?.before.data();
        const after = event.data?.after.data();

        if (!before || !after) return;
        if (before.authProvider !== 'anonymous') return; // only care about upgrades
        if (after.authProvider === 'anonymous') return;  // not actually upgraded
        if (after.tag) return;                           // tag already present

        try {
            await assignUniqueTag(uid);
            functions.logger.info(`[onUserUpgraded] Tag assigned to upgraded user ${uid}`);
        } catch (err) {
            functions.logger.error(`[onUserUpgraded] Failed to assign tag to ${uid}:`, err);
        }
    },
);

// ─── Callable: request a new tag (reassignment) ───────────────────────────────

export const requestNewTag = functions.https.onCall(
    { region: 'europe-west3' },
    async (request) => {
        const uid = request.auth?.uid;
        if (!uid) {
            throw new functions.https.HttpsError('unauthenticated', 'Must be signed in.');
        }

        const userSnap = await db.collection('users').doc(uid).get();
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

        // Release old tag slot so it can be reused
        const oldTag: string | undefined = userData.tag;
        if (oldTag) {
            await db.collection('tags').doc(oldTag).delete();
        }

        const newTag = await assignUniqueTag(uid);
        return { tag: newTag };
    },
);
