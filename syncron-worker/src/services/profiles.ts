
/**
 * Upsert a user profile in the user_profiles table.
 * Resolves potential uniqueness violations on the 'tag' column by setting the tag of any other owner to null beforehand.
 */
export async function upsertUserProfile(
  db: D1Database,
  uid: string,
  displayName: string,
  tag: string | null,
  showcaseBadges: any[] | string
): Promise<void> {
  const jsonBadges = typeof showcaseBadges === 'string' ? showcaseBadges : JSON.stringify(showcaseBadges);

  if (tag) {
    // Evict the tag from any other user to satisfy the UNIQUE constraint in SQLite.
    // In Firestore, tag registry ensures only one user owns a tag at any time.
    await db
      .prepare('UPDATE user_profiles SET tag = NULL WHERE tag = ?1 COLLATE NOCASE AND uid != ?2')
      .bind(tag, uid)
      .run();
  }

  await db
    .prepare(
      `INSERT INTO user_profiles (uid, display_name, tag, showcase_badges, updated_at)
       VALUES (?1, ?2, ?3, ?4, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
       ON CONFLICT(uid)
       DO UPDATE SET
         display_name = excluded.display_name,
         tag = excluded.tag,
         showcase_badges = excluded.showcase_badges,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
    )
    .bind(uid, displayName, tag, jsonBadges)
    .run();
}
