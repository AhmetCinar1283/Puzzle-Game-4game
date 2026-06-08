import type { PeriodIds } from '../types';

export interface LeaderboardUpdateParams {
  scoreDelta: number;
  isFirstCompletion: boolean;
  displayName: string;
  tag: string | null;
  isNewBestSolution: boolean;
  oldBestHolderUid: string | null;
  createdBy: string | null;
  starsGained: number; // The stars won in this completion
}

/**
 * Calculates current period IDs for daily, weekly, monthly and all_time based on UTC.
 */
export function getCurrentPeriodIds(date: Date = new Date()): {
  daily: string;
  weekly: string;
  monthly: string;
  allTime: string;
} {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');

  const daily = `${yyyy}-${mm}-${dd}`;
  const monthly = `${yyyy}-${mm}`;
  const allTime = 'all_time';

  // ISO 8601 week calculation in UTC
  const utcDate = new Date(Date.UTC(yyyy, date.getUTCMonth(), date.getUTCDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);

  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const weekYear = utcDate.getUTCFullYear();
  const weekly = `${weekYear}-W${String(weekNum).padStart(2, '0')}`;

  return { daily, weekly, monthly, allTime };
}

/**
 * Clean display name and tag to conform to database length and formatting restrictions.
 */
function cleanProfileData(displayName: string, tag: string | null): { cleanName: string; cleanTag: string | null } {
  let cleanName = displayName.trim();
  if (cleanName.length === 0) {
    cleanName = 'Player';
  } else if (cleanName.length > 100) {
    cleanName = cleanName.substring(0, 100);
  }

  let cleanTag: string | null = null;
  if (tag !== null) {
    const trimmedTag = tag.trim();
    if (trimmedTag.length >= 2 && trimmedTag.length <= 20) {
      cleanTag = trimmedTag;
    }
  }

  return { cleanName, cleanTag };
}

/**
 * Upsert period scores for daily, weekly, monthly and all_time periods.
 */
export async function upsertPeriodScores(
  db: D1Database,
  uid: string,
  scoreDelta: number,
  isFirstCompletion: boolean,
): Promise<void> {
  // If there's nothing to update, skip database call to optimize resources
  if (scoreDelta === 0 && !isFirstCompletion) {
    return;
  }

  const { daily, weekly, monthly, allTime } = getCurrentPeriodIds();
  const levelsDelta = isFirstCompletion ? 1 : 0;

  const query = `
    INSERT INTO user_period_scores (uid, period_type, period_id, stars_gained, levels_done, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (uid, period_type, period_id)
    DO UPDATE SET
      stars_gained = stars_gained + ?4,
      levels_done = levels_done + ?5,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `;

  // Run all four per-period scores in a single batch transaction
  await db.batch([
    db.prepare(query).bind(uid, 'daily', daily, scoreDelta, levelsDelta),
    db.prepare(query).bind(uid, 'weekly', weekly, scoreDelta, levelsDelta),
    db.prepare(query).bind(uid, 'monthly', monthly, scoreDelta, levelsDelta),
    db.prepare(query).bind(uid, 'all_time', allTime, scoreDelta, levelsDelta),
  ]);
}

/**
 * Denormalize and upsert user profile into user_profiles cache table.
 */
export async function upsertUserProfile(
  db: D1Database,
  uid: string,
  displayName: string,
  tag: string | null,
): Promise<void> {
  const { cleanName, cleanTag } = cleanProfileData(displayName, tag);

  const query = `
    INSERT INTO user_profiles (uid, display_name, tag, updated_at)
    VALUES (?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(uid)
    DO UPDATE SET
      display_name = excluded.display_name,
      -- COALESCE: only advance tag from NULL → real value, never real value → NULL.
      -- This prevents a race where an upgrading user completes a level before
      -- Cloud Functions assigns their tag, causing the tag to be wiped in D1
      -- and the cleanup cron incorrectly targeting them.
      tag = COALESCE(excluded.tag, user_profiles.tag),
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `;

  await db.prepare(query).bind(uid, cleanName, cleanTag).run();
}

/**
 * Update user's profile with their showcase badges.
 */
export async function updateUserShowcaseBadges(
  db: D1Database,
  uid: string,
  displayName: string,
  tag: string | null,
  showcaseBadges: any[],
): Promise<void> {
  const { cleanName, cleanTag } = cleanProfileData(displayName, tag);
  const jsonBadges = JSON.stringify(showcaseBadges);

  const query = `
    INSERT INTO user_profiles (uid, display_name, tag, showcase_badges, updated_at)
    VALUES (?1, ?2, ?3, ?4, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT(uid)
    DO UPDATE SET
      display_name = excluded.display_name,
      tag = excluded.tag,
      showcase_badges = excluded.showcase_badges,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `;

  await db.prepare(query).bind(uid, cleanName, cleanTag, jsonBadges).run();
}

/**
 * Handle new world record breaks. Increments count for daily/weekly/all_time for the new holder
 * and decrements all_time count for the old holder (if any).
 */
export async function upsertWorldRecords(
  db: D1Database,
  newHolderUid: string,
  oldHolderUid: string | null,
): Promise<void> {
  const { daily, weekly, allTime } = getCurrentPeriodIds();
  const statements: D1PreparedStatement[] = [];

  const upsertQuery = `
    INSERT INTO user_world_records (uid, period_type, period_id, records_count, updated_at)
    VALUES (?1, ?2, ?3, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (uid, period_type, period_id)
    DO UPDATE SET
      records_count = records_count + 1,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `;

  // Increment statements for new holder
  statements.push(
    db.prepare(upsertQuery).bind(newHolderUid, 'daily', daily),
    db.prepare(upsertQuery).bind(newHolderUid, 'weekly', weekly),
    db.prepare(upsertQuery).bind(newHolderUid, 'all_time', allTime),
  );

  // Decrement statement for old holder (only all_time gets decremented)
  if (oldHolderUid !== null && oldHolderUid !== newHolderUid) {
    const decrementQuery = `
      UPDATE user_world_records
      SET records_count = MAX(0, records_count - 1),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE uid = ?1 AND period_type = 'all_time' AND period_id = 'all_time'
    `;
    statements.push(db.prepare(decrementQuery).bind(oldHolderUid));
  }

  await db.batch(statements);
}

/**
 * Update community level creator scores when a level gets completed.
 */
export async function upsertCreatorScores(
  db: D1Database,
  creatorUid: string,
  starsGained: number,
): Promise<void> {
  const { monthly, allTime } = getCurrentPeriodIds();

  const query = `
    INSERT INTO creator_scores (uid, period_type, period_id, plays_gained, stars_gained, updated_at)
    VALUES (?1, ?2, ?3, 1, ?4, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ON CONFLICT (uid, period_type, period_id)
    DO UPDATE SET
      plays_gained = plays_gained + 1,
      stars_gained = stars_gained + ?4,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `;

  await db.batch([
    db.prepare(query).bind(creatorUid, 'monthly', monthly, starsGained),
    db.prepare(query).bind(creatorUid, 'all_time', allTime, starsGained),
  ]);
}

/**
 * Main wrapper execution to handle all leaderboard updates inside complete-level.
 * Designed to safely run asynchronously via waitUntil.
 */
export async function updateLeaderboardData(
  db: D1Database,
  uid: string,
  params: LeaderboardUpdateParams,
): Promise<void> {
  const tasks: Promise<void>[] = [];

  // Faz 2: Period Scores
  tasks.push(
    upsertPeriodScores(db, uid, params.scoreDelta, params.isFirstCompletion)
      .catch((err) => console.error('[Leaderboard] upsertPeriodScores failed:', err))
  );

  // Faz 3: User Profile Cache
  tasks.push(
    upsertUserProfile(db, uid, params.displayName, params.tag)
      .catch((err) => console.error('[Leaderboard] upsertUserProfile failed:', err))
  );

  // Faz 4: World Records (Only on new best solution breaks)
  if (params.isNewBestSolution) {
    tasks.push(
      upsertWorldRecords(db, uid, params.oldBestHolderUid)
        .catch((err) => console.error('[Leaderboard] upsertWorldRecords failed:', err))
    );
  }

  // Faz 5: Creator Scores (Self plays excluded)
  if (params.createdBy && params.createdBy !== uid) {
    tasks.push(
      upsertCreatorScores(db, params.createdBy, params.starsGained)
        .catch((err) => console.error('[Leaderboard] upsertCreatorScores failed:', err))
    );
  }

  await Promise.all(tasks);
}
