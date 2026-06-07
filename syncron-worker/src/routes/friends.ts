import { Hono } from 'hono';
import type { AppContext } from '../types';
import { firebaseAuth } from '../middleware/auth';
import {
  friendRequestSchema,
  friendActionSchema,
  tagSearchSchema,
} from '../schemas/friends';
import { getAdminAccessToken, isValidServiceAccount } from '../services/serviceAccount';
import { fsGet, fromDoc } from '../services/firestore';
import { upsertUserProfile } from '../services/profiles';

export const friendsRouter = new Hono<AppContext>();

// Helper for canonical ordering user_a < user_b
function getCanonicalKeys(uid1: string, uid2: string) {
  return uid1 < uid2 ? { user_a: uid1, user_b: uid2 } : { user_a: uid2, user_b: uid1 };
}

// ─── POST /friends/request ───────────────────────────────────────────────────
friendsRouter.post('/friends/request', firebaseAuth, async (c) => {
  const uid = c.get('uid');

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }

  const validation = friendRequestSchema.safeParse(body);
  if (!validation.success) {
    const error = validation.error.errors[0]?.message || 'Invalid request';
    return c.json({ success: false, error }, 400);
  }

  const { targetUid: bodyTargetUid, targetTag } = validation.data;
  const db = c.env.AUDIT_DB;

  let targetUid = bodyTargetUid;

  // Resolve target UID if tag is provided, or verify existence if UID is provided
  if (targetTag) {
    try {
      let profile = await db
        .prepare('SELECT uid FROM user_profiles WHERE tag = ?1 COLLATE NOCASE')
        .bind(targetTag)
        .first<{ uid: string }>();

      // Fallback: If not found in cache, resolve from Firestore
      if (!profile && isValidServiceAccount(c.env.GOOGLE_SERVICE_ACCOUNT)) {
        try {
          const adminToken = await getAdminAccessToken(c.env.GOOGLE_SERVICE_ACCOUNT);
          const projectId = c.env.FIREBASE_PROJECT_ID;
          const tagDoc = await fsGet(projectId, `tags/${targetTag.toUpperCase()}`, adminToken);
          if (tagDoc) {
            const tagData = fromDoc(tagDoc);
            const resolvedUid = tagData.uid as string | undefined;
            if (resolvedUid) {
              const userDoc = await fsGet(projectId, `users/${resolvedUid}`, adminToken);
              if (userDoc) {
                const userData = fromDoc(userDoc);
                const displayName = typeof userData.displayName === 'string' ? userData.displayName : 'Player';
                const userTag = typeof userData.tag === 'string' ? userData.tag : null;
                let showcaseBadges: any[] = [];
                if (Array.isArray(userData.showcaseBadges)) {
                  showcaseBadges = userData.showcaseBadges;
                }
                const jsonBadges = JSON.stringify(showcaseBadges);

                await upsertUserProfile(db, resolvedUid, displayName, userTag, showcaseBadges);

                profile = { uid: resolvedUid };
              }
            }
          }
        } catch (fallbackErr) {
          console.error('[FriendsAPI] Firestore tag resolution fallback failed:', fallbackErr);
        }
      }

      if (!profile) {
        return c.json({ success: false, error: 'User profile with this tag not found' }, 404);
      }
      targetUid = profile.uid;
    } catch (err) {
      console.error('[FriendsAPI] Tag resolution database error:', err);
      return c.json({ success: false, error: 'Database error' }, 500);
    }
  } else if (targetUid) {
    try {
      let profile = await db
        .prepare('SELECT uid FROM user_profiles WHERE uid = ?1')
        .bind(targetUid)
        .first<{ uid: string }>();

      // Fallback: If not found in cache, verify in Firestore
      if (!profile && isValidServiceAccount(c.env.GOOGLE_SERVICE_ACCOUNT)) {
        try {
          const adminToken = await getAdminAccessToken(c.env.GOOGLE_SERVICE_ACCOUNT);
          const projectId = c.env.FIREBASE_PROJECT_ID;
          const userDoc = await fsGet(projectId, `users/${targetUid}`, adminToken);
          if (userDoc) {
            const userData = fromDoc(userDoc);
            const displayName = typeof userData.displayName === 'string' ? userData.displayName : 'Player';
            const userTag = typeof userData.tag === 'string' ? userData.tag : null;
            let showcaseBadges: any[] = [];
            if (Array.isArray(userData.showcaseBadges)) {
              showcaseBadges = userData.showcaseBadges;
            }
            const jsonBadges = JSON.stringify(showcaseBadges);

            await upsertUserProfile(db, targetUid, displayName, userTag, showcaseBadges);

            profile = { uid: targetUid };
          }
        } catch (fallbackErr) {
          console.error('[FriendsAPI] Firestore UID verification fallback failed:', fallbackErr);
        }
      }

      if (!profile) {
        return c.json({ success: false, error: 'User profile not found' }, 404);
      }
    } catch (err) {
      console.error('[FriendsAPI] Profile verification database error:', err);
      return c.json({ success: false, error: 'Database error' }, 500);
    }
  }

  if (!targetUid) {
    return c.json({ success: false, error: 'Could not resolve target user UID' }, 400);
  }

  if (targetUid === uid) {
    return c.json({ success: false, error: 'Cannot send friend request to yourself' }, 400);
  }

  const { user_a, user_b } = getCanonicalKeys(uid, targetUid);

  try {
    // Check existing relationship
    const existing = await db
      .prepare('SELECT status, requested_by FROM friendships WHERE user_a = ?1 AND user_b = ?2')
      .bind(user_a, user_b)
      .first<{ status: string; requested_by: string }>();

    if (existing) {
      if (existing.status === 'accepted') {
        return c.json({ success: false, error: 'Already friends' }, 400);
      }
      if (existing.status === 'blocked') {
        return c.json({ success: false, error: 'Action not allowed' }, 400);
      }
      if (existing.status === 'pending') {
        if (existing.requested_by === uid) {
          return c.json({ success: false, error: 'Friend request already pending' }, 400);
        } else {
          return c.json(
            {
              success: false,
              error: 'You have a pending request from this user. Accept it instead.',
            },
            400,
          );
        }
      }
    }

    // Friend Limit Check (100 friends maximum)
    const friendsCount = await db
      .prepare(
        "SELECT COUNT(*) as count FROM friendships WHERE (user_a = ?1 OR user_b = ?1) AND status = 'accepted'",
      )
      .bind(uid)
      .first<{ count: number }>();

    if (friendsCount && friendsCount.count >= 100) {
      return c.json({ success: false, error: 'You have reached the maximum limit of 100 friends' }, 400);
    }

    // Pending Outgoing Request Limit Check (20 pending outgoing requests maximum)
    const pendingOutgoing = await db
      .prepare(
        "SELECT COUNT(*) as count FROM friendships WHERE requested_by = ?1 AND status = 'pending'",
      )
      .bind(uid)
      .first<{ count: number }>();

    if (pendingOutgoing && pendingOutgoing.count >= 20) {
      return c.json(
        { success: false, error: 'You have reached the limit of 20 pending outgoing requests' },
        400,
      );
    }

    // Create the pending friendship
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO friendships (user_a, user_b, status, requested_by, created_at, updated_at)
         VALUES (?1, ?2, 'pending', ?3, ?4, ?4)`,
      )
      .bind(user_a, user_b, uid, now)
      .run();

    return c.json({ success: true });
  } catch (err) {
    console.error('[FriendsAPI] Friend request insertion failed:', err);
    return c.json({ success: false, error: 'Database error' }, 500);
  }
});

// ─── POST /friends/accept ────────────────────────────────────────────────────
friendsRouter.post('/friends/accept', firebaseAuth, async (c) => {
  const uid = c.get('uid');

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }

  const validation = friendActionSchema.safeParse(body);
  if (!validation.success) {
    const error = validation.error.errors[0]?.message || 'Invalid request';
    return c.json({ success: false, error }, 400);
  }

  const targetUid = validation.data.uid;
  const db = c.env.AUDIT_DB;

  const { user_a, user_b } = getCanonicalKeys(uid, targetUid);

  try {
    const existing = await db
      .prepare('SELECT status, requested_by FROM friendships WHERE user_a = ?1 AND user_b = ?2')
      .bind(user_a, user_b)
      .first<{ status: string; requested_by: string }>();

    if (!existing || existing.status !== 'pending') {
      return c.json({ success: false, error: 'Friend request not found' }, 404);
    }

    if (existing.requested_by === uid) {
      return c.json({ success: false, error: 'Cannot accept your own request' }, 400);
    }

    // Friend Limit Checks (100 friends maximum)
    const callerFriends = await db
      .prepare(
        "SELECT COUNT(*) as count FROM friendships WHERE (user_a = ?1 OR user_b = ?1) AND status = 'accepted'",
      )
      .bind(uid)
      .first<{ count: number }>();

    if (callerFriends && callerFriends.count >= 100) {
      return c.json({ success: false, error: 'You have reached the maximum limit of 100 friends' }, 400);
    }

    const targetFriends = await db
      .prepare(
        "SELECT COUNT(*) as count FROM friendships WHERE (user_a = ?1 OR user_b = ?1) AND status = 'accepted'",
      )
      .bind(targetUid)
      .first<{ count: number }>();

    if (targetFriends && targetFriends.count >= 100) {
      return c.json({ success: false, error: 'The other user has reached their friend limit' }, 400);
    }

    const now = new Date().toISOString();
    await db
      .prepare(
        `UPDATE friendships
         SET status = 'accepted', updated_at = ?3
         WHERE user_a = ?1 AND user_b = ?2`,
      )
      .bind(user_a, user_b, now)
      .run();

    return c.json({ success: true });
  } catch (err) {
    console.error('[FriendsAPI] Friend request accept failed:', err);
    return c.json({ success: false, error: 'Database error' }, 500);
  }
});

// ─── POST /friends/reject ────────────────────────────────────────────────────
friendsRouter.post('/friends/reject', firebaseAuth, async (c) => {
  const uid = c.get('uid');

  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }

  const validation = friendActionSchema.safeParse(body);
  if (!validation.success) {
    const error = validation.error.errors[0]?.message || 'Invalid request';
    return c.json({ success: false, error }, 400);
  }

  const targetUid = validation.data.uid;
  const db = c.env.AUDIT_DB;

  const { user_a, user_b } = getCanonicalKeys(uid, targetUid);

  try {
    const existing = await db
      .prepare('SELECT status, requested_by FROM friendships WHERE user_a = ?1 AND user_b = ?2')
      .bind(user_a, user_b)
      .first<{ status: string; requested_by: string }>();

    if (!existing || existing.status !== 'pending') {
      return c.json({ success: false, error: 'Friend request not found' }, 404);
    }

    if (existing.requested_by === uid) {
      return c.json({ success: false, error: 'Cannot reject your own request' }, 400);
    }

    await db
      .prepare('DELETE FROM friendships WHERE user_a = ?1 AND user_b = ?2')
      .bind(user_a, user_b)
      .run();

    return c.json({ success: true });
  } catch (err) {
    console.error('[FriendsAPI] Friend request rejection failed:', err);
    return c.json({ success: false, error: 'Database error' }, 500);
  }
});

// ─── DELETE /friends/:uid ────────────────────────────────────────────────────
friendsRouter.delete('/friends/:uid', firebaseAuth, async (c) => {
  const uid = c.get('uid');
  const targetUid = c.req.param('uid');

  if (!targetUid || targetUid.length > 128) {
    return c.json({ success: false, error: 'Invalid UID' }, 400);
  }

  const db = c.env.AUDIT_DB;
  const { user_a, user_b } = getCanonicalKeys(uid, targetUid);

  try {
    const existing = await db
      .prepare('SELECT status FROM friendships WHERE user_a = ?1 AND user_b = ?2')
      .bind(user_a, user_b)
      .first<{ status: string }>();

    if (!existing || existing.status !== 'accepted') {
      return c.json({ success: false, error: 'Friendship not found' }, 404);
    }

    await db
      .prepare('DELETE FROM friendships WHERE user_a = ?1 AND user_b = ?2')
      .bind(user_a, user_b)
      .run();

    return c.json({ success: true });
  } catch (err) {
    console.error('[FriendsAPI] Friendship deletion failed:', err);
    return c.json({ success: false, error: 'Database error' }, 500);
  }
});

// ─── GET /friends ────────────────────────────────────────────────────────────
friendsRouter.get('/friends', firebaseAuth, async (c) => {
  const uid = c.get('uid');
  const db = c.env.AUDIT_DB;

  try {
    let { results } = await db
      .prepare(
        `SELECT
           CASE WHEN f.user_a = ?1 THEN f.user_b ELSE f.user_a END AS friendUid,
           p.display_name AS displayName,
           p.tag,
           p.showcase_badges AS showcaseBadges,
           f.created_at AS friendsSince
         FROM friendships f
         LEFT JOIN user_profiles p ON p.uid = CASE WHEN f.user_a = ?1 THEN f.user_b ELSE f.user_a END
         WHERE (f.user_a = ?1 OR f.user_b = ?1) AND f.status = 'accepted'`,
      )
      .bind(uid)
      .all<any>();

    results = results ?? [];

    // Sync missing profiles from Firestore (limited to 10 to prevent "Too many subrequests" limit)
    const missingUids = results
      .filter((row) => !row.displayName)
      .map((row) => row.friendUid)
      .slice(0, 10);

    if (missingUids.length > 0 && isValidServiceAccount(c.env.GOOGLE_SERVICE_ACCOUNT)) {
      try {
        const adminToken = await getAdminAccessToken(c.env.GOOGLE_SERVICE_ACCOUNT);
        const projectId = c.env.FIREBASE_PROJECT_ID;

        const syncPromises = missingUids.map(async (missingUid) => {
          const userDoc = await fsGet(projectId, `users/${missingUid}`, adminToken);
          if (userDoc) {
            const userData = fromDoc(userDoc);
            const displayName = typeof userData.displayName === 'string' ? userData.displayName : 'Player';
            const userTag = typeof userData.tag === 'string' ? userData.tag : null;
            let showcaseBadges: any[] = [];
            if (Array.isArray(userData.showcaseBadges)) {
              showcaseBadges = userData.showcaseBadges;
            }
            const jsonBadges = JSON.stringify(showcaseBadges);

            await upsertUserProfile(db, missingUid, displayName, userTag, showcaseBadges);

            return {
              uid: missingUid,
              displayName,
              tag: userTag,
              showcaseBadges: jsonBadges,
            };
          }
          return null;
        });

        const syncedProfiles = await Promise.all(syncPromises);
        const profileMap = new Map(
          syncedProfiles.filter(Boolean).map((p) => [p!.uid, p])
        );

        results = results.map((row) => {
          if (!row.displayName) {
            const profile = profileMap.get(row.friendUid);
            if (profile) {
              return {
                ...row,
                displayName: profile.displayName,
                tag: profile.tag,
                showcaseBadges: profile.showcaseBadges,
              };
            }
          }
          return row;
        });
      } catch (fallbackErr) {
        console.error('[FriendsAPI] Friends list cache sync failed:', fallbackErr);
      }
    }

    // Sort friends by displayName COLLATE NOCASE ASC
    results.sort((a, b) => {
      const nameA = (a.displayName ?? 'Player').toLowerCase();
      const nameB = (b.displayName ?? 'Player').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    const friends = results.map((row) => {
      let showcaseBadges = [];
      if (typeof row.showcaseBadges === 'string') {
        try {
          showcaseBadges = JSON.parse(row.showcaseBadges);
        } catch (e) {
          console.error('Failed to parse showcaseBadges JSON:', e);
        }
      } else if (Array.isArray(row.showcaseBadges)) {
        showcaseBadges = row.showcaseBadges;
      }
      return {
        uid: row.friendUid,
        displayName: row.displayName ?? 'Player',
        tag: row.tag,
        showcaseBadges,
        friendsSince: row.friendsSince,
      };
    });

    return c.json({ success: true, friends });
  } catch (err) {
    console.error('[FriendsAPI] Fetching friends list failed:', err);
    return c.json({ success: false, error: 'Database error' }, 500);
  }
});

// ─── GET /friends/requests ───────────────────────────────────────────────────
friendsRouter.get('/friends/requests', firebaseAuth, async (c) => {
  const uid = c.get('uid');
  const db = c.env.AUDIT_DB;

  try {
    let { results } = await db
      .prepare(
        `SELECT
           CASE WHEN f.user_a = ?1 THEN f.user_b ELSE f.user_a END AS requesterUid,
           p.display_name AS displayName,
           p.tag,
           p.showcase_badges AS showcaseBadges,
           f.created_at AS requestedAt
         FROM friendships f
         LEFT JOIN user_profiles p ON p.uid = CASE WHEN f.user_a = ?1 THEN f.user_b ELSE f.user_a END
         WHERE (f.user_a = ?1 OR f.user_b = ?1)
           AND f.status = 'pending'
           AND f.requested_by != ?1`,
      )
      .bind(uid)
      .all<any>();

    results = results ?? [];

    // Sync missing profiles from Firestore (limited to 10 to prevent "Too many subrequests" limit)
    const missingUids = results
      .filter((row) => !row.displayName)
      .map((row) => row.requesterUid)
      .slice(0, 10);

    if (missingUids.length > 0 && isValidServiceAccount(c.env.GOOGLE_SERVICE_ACCOUNT)) {
      try {
        const adminToken = await getAdminAccessToken(c.env.GOOGLE_SERVICE_ACCOUNT);
        const projectId = c.env.FIREBASE_PROJECT_ID;

        const syncPromises = missingUids.map(async (missingUid) => {
          const userDoc = await fsGet(projectId, `users/${missingUid}`, adminToken);
          if (userDoc) {
            const userData = fromDoc(userDoc);
            const displayName = typeof userData.displayName === 'string' ? userData.displayName : 'Player';
            const userTag = typeof userData.tag === 'string' ? userData.tag : null;
            let showcaseBadges: any[] = [];
            if (Array.isArray(userData.showcaseBadges)) {
              showcaseBadges = userData.showcaseBadges;
            }
            const jsonBadges = JSON.stringify(showcaseBadges);

            await upsertUserProfile(db, missingUid, displayName, userTag, showcaseBadges);

            return {
              uid: missingUid,
              displayName,
              tag: userTag,
              showcaseBadges: jsonBadges,
            };
          }
          return null;
        });

        const syncedProfiles = await Promise.all(syncPromises);
        const profileMap = new Map(
          syncedProfiles.filter(Boolean).map((p) => [p!.uid, p])
        );

        results = results.map((row) => {
          if (!row.displayName) {
            const profile = profileMap.get(row.requesterUid);
            if (profile) {
              return {
                ...row,
                displayName: profile.displayName,
                tag: profile.tag,
                showcaseBadges: profile.showcaseBadges,
              };
            }
          }
          return row;
        });
      } catch (fallbackErr) {
        console.error('[FriendsAPI] Friend requests cache sync failed:', fallbackErr);
      }
    }

    // Sort requests by requestedAt DESC
    results.sort((a, b) => {
      const dateA = new Date(a.requestedAt ?? 0).getTime();
      const dateB = new Date(b.requestedAt ?? 0).getTime();
      return dateB - dateA;
    });

    const requests = results.map((row) => {
      let showcaseBadges = [];
      if (typeof row.showcaseBadges === 'string') {
        try {
          showcaseBadges = JSON.parse(row.showcaseBadges);
        } catch (e) {
          console.error('Failed to parse showcaseBadges JSON:', e);
        }
      } else if (Array.isArray(row.showcaseBadges)) {
        showcaseBadges = row.showcaseBadges;
      }
      return {
        uid: row.requesterUid,
        displayName: row.displayName ?? 'Player',
        tag: row.tag,
        showcaseBadges,
        requestedAt: row.requestedAt,
      };
    });

    return c.json({ success: true, requests });
  } catch (err) {
    console.error('[FriendsAPI] Fetching pending requests failed:', err);
    return c.json({ success: false, error: 'Database error' }, 500);
  }
});

// ─── GET /users/search ────────────────────────────────────────────────────────
friendsRouter.get('/users/search', firebaseAuth, async (c) => {
  const uid = c.get('uid');
  const tagParam = c.req.query('tag');

  const validation = tagSearchSchema.safeParse({ tag: tagParam });
  if (!validation.success) {
    const error = validation.error.errors[0]?.message || 'Invalid search parameters';
    return c.json({ success: false, error }, 400);
  }

  const { tag } = validation.data;
  const db = c.env.AUDIT_DB;

  try {
    let { results } = await db
      .prepare(
        `SELECT
           p.uid,
           p.display_name AS displayName,
           p.tag,
           p.showcase_badges AS showcaseBadges,
           f.status AS friendshipStatus,
           f.requested_by AS friendshipRequestedBy
         FROM user_profiles p
         LEFT JOIN friendships f ON
           ((f.user_a = ?2 AND f.user_b = p.uid) OR (f.user_a = p.uid AND f.user_b = ?2))
         WHERE p.tag = ?1 COLLATE NOCASE
           AND p.uid != ?2
           AND (f.status IS NULL OR f.status != 'blocked')`,
      )
      .bind(tag, uid)
      .all<any>();

    // Fallback: If not found in cache, search Firestore tags registry
    if ((!results || results.length === 0) && tag.toUpperCase() !== '' && isValidServiceAccount(c.env.GOOGLE_SERVICE_ACCOUNT)) {
      try {
        const adminToken = await getAdminAccessToken(c.env.GOOGLE_SERVICE_ACCOUNT);
        const projectId = c.env.FIREBASE_PROJECT_ID;
        const tagDoc = await fsGet(projectId, `tags/${tag.toUpperCase()}`, adminToken);

        if (tagDoc) {
          const tagData = fromDoc(tagDoc);
          const targetUid = tagData.uid as string | undefined;

          if (targetUid && targetUid !== uid) {
            // Fetch user profile from Firestore
            const userDoc = await fsGet(projectId, `users/${targetUid}`, adminToken);
            if (userDoc) {
              const userData = fromDoc(userDoc);
              const displayName = typeof userData.displayName === 'string' ? userData.displayName : 'Player';
              const userTag = typeof userData.tag === 'string' ? userData.tag : null;

              let showcaseBadges: any[] = [];
              if (Array.isArray(userData.showcaseBadges)) {
                showcaseBadges = userData.showcaseBadges;
              }
              const jsonBadges = JSON.stringify(showcaseBadges);

              // Cache user profile in D1 user_profiles table
              await upsertUserProfile(db, targetUid, displayName, userTag, showcaseBadges);

              // Get relationship status from friendships
              const friendship = await db
                .prepare(
                  `SELECT status, requested_by FROM friendships
                   WHERE (user_a = ?1 AND user_b = ?2) OR (user_a = ?2 AND user_b = ?1)`
                )
                .bind(uid, targetUid)
                .first<{ status: string; requested_by: string }>();

              if (!friendship || friendship.status !== 'blocked') {
                results = [
                  {
                    uid: targetUid,
                    displayName,
                    tag: userTag,
                    showcaseBadges: jsonBadges,
                    friendshipStatus: friendship ? friendship.status : null,
                    friendshipRequestedBy: friendship ? friendship.requested_by : null,
                  },
                ];
              }
            }
          }
        }
      } catch (fallbackErr) {
        console.error('[FriendsAPI] Firestore search fallback failed:', fallbackErr);
      }
    }

    const users = (results ?? []).map((row) => {
      let showcaseBadges = [];
      if (typeof row.showcaseBadges === 'string') {
        try {
          showcaseBadges = JSON.parse(row.showcaseBadges);
        } catch (e) {
          console.error('Failed to parse showcaseBadges JSON:', e);
        }
      } else if (Array.isArray(row.showcaseBadges)) {
        showcaseBadges = row.showcaseBadges;
      }
      return {
        uid: row.uid,
        displayName: row.displayName ?? 'Player',
        tag: row.tag,
        showcaseBadges,
        friendshipStatus: row.friendshipStatus ?? 'none',
        friendshipRequestedBy: row.friendshipRequestedBy ?? null,
      };
    });

    return c.json({ success: true, users });
  } catch (err) {
    console.error('[FriendsAPI] Tag search failed:', err);
    return c.json({ success: false, error: 'Database error' }, 500);
  }
});
