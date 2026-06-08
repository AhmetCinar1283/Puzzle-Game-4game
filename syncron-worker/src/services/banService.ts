
export interface BanRecord {
  id: string;
  uid: string;
  banType: 'platform' | 'tag' | 'social' | 'coop';
  reason: string;
  issuedBy: string;
  issuedAt: string;
  expiresAt: string | null;
  liftedAt: string | null;
  liftedBy: string | null;
}

export interface ActiveBan {
  id: string;
  uid: string;
  banType: 'platform' | 'tag' | 'social' | 'coop';
  reason: string;
  issuedBy: string;
  issuedAt: string;
  expiresAt: string | null;
}

/**
 * Checks if a user has an active ban of the specified type.
 */
export async function checkActiveBan(
  db: D1Database,
  uid: string,
  banType: 'platform' | 'tag' | 'social' | 'coop'
): Promise<boolean> {
  const result = await db
    .prepare(
      `SELECT 1 FROM user_bans
       WHERE uid = ?1 AND ban_type = ?2 AND lifted_at IS NULL
         AND (expires_at IS NULL OR expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       LIMIT 1`
    )
    .bind(uid, banType)
    .first();
  return result !== null;
}

/**
 * Gets all active bans for a user.
 */
export async function getActiveBans(
  db: D1Database,
  uid: string
): Promise<ActiveBan[]> {
  const result = await db
    .prepare(
      `SELECT id, uid, ban_type as banType, reason, issued_by as issuedBy, issued_at as issuedAt, expires_at as expiresAt
       FROM user_bans
       WHERE uid = ?1 AND lifted_at IS NULL
         AND (expires_at IS NULL OR expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ORDER BY issued_at DESC`
    )
    .bind(uid)
    .all<ActiveBan>();
  return result.results ?? [];
}

/**
 * Gets the entire ban history for a user (active, expired, and lifted).
 */
export async function getBanHistory(
  db: D1Database,
  uid: string
): Promise<BanRecord[]> {
  const result = await db
    .prepare(
      `SELECT id, uid, ban_type as banType, reason, issued_by as issuedBy, issued_at as issuedAt, expires_at as expiresAt, lifted_at as liftedAt, lifted_by as liftedBy
       FROM user_bans
       WHERE uid = ?1
       ORDER BY issued_at DESC`
    )
    .bind(uid)
    .all<BanRecord>();
  return result.results ?? [];
}
