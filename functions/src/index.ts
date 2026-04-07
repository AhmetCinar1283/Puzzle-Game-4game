import * as functions from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

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

// ─── Callable: set a custom tag ───────────────────────────────────────────────
// Client sends { tag: "MYTAG" }. Validates chars/length, checks rate limits,
// checks uniqueness, then atomically assigns.

export const requestNewTag = functions.https.onCall(
    { region: 'europe-west3' },
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

        const userRef = db.collection('users').doc(uid);
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
        return { tag };
    },
);
