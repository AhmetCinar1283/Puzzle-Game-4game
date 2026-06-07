import { Hono } from 'hono';
import type { AppContext } from '../types';
import { optionalFirebaseAuth } from '../middleware/auth';
import { leaderboardQuerySchema } from '../schemas/leaderboard';
import { getCurrentPeriodIds } from '../services/leaderboard';

export const leaderboardRouter = new Hono<AppContext>();

const VALID_COMBINATIONS: Record<string, string[]> = {
  stars: ['daily', 'weekly', 'all_time'],
  levels: ['daily', 'weekly', 'all_time'],
  records: ['daily', 'weekly', 'all_time'],
  creators: ['monthly', 'all_time'],
};

interface DbEntryRow {
  uid: string;
  displayName: string | null;
  tag: string | null;
  showcaseBadges?: string | null;
  value: number;
  rank?: number;
}

interface UserScoreRow {
  score_val: number;
  secondary_val?: number;
  updated_at: string;
}

leaderboardRouter.get('/leaderboard/:category/:period', optionalFirebaseAuth, async (c) => {
  const category = c.req.param('category');
  const period = c.req.param('period');

  // 1. Validate category and period combinations
  if (!VALID_COMBINATIONS[category]) {
    return c.json({ success: false, error: 'Invalid category' }, 400);
  }
  if (!VALID_COMBINATIONS[category].includes(period)) {
    return c.json({ success: false, error: 'Invalid period for this category' }, 400);
  }

  // 2. Validate query parameters
  const queryParams = {
    limit: c.req.query('limit'),
    around_me: c.req.query('around_me'),
    friends_only: c.req.query('friends_only'),
  };
  const validation = leaderboardQuerySchema.safeParse(queryParams);
  if (!validation.success) {
    const error = validation.error.errors[0]?.message || 'Invalid query parameters';
    return c.json({ success: false, error }, 400);
  }

  const { limit, around_me, friends_only } = validation.data;
  const uid = c.get('uid');

  // 3. Authorization check for around_me / friends_only
  if (around_me && !uid) {
    return c.json({ success: false, error: 'Authentication required for around_me' }, 401);
  }
  if (friends_only && !uid) {
    return c.json({ success: false, error: 'Authentication required for friends_only' }, 401);
  }

  // 4. Determine periodId
  const nowPeriods = getCurrentPeriodIds();
  let periodId = '';
  if (period === 'all_time') {
    periodId = 'all_time';
  } else if (period === 'daily') {
    periodId = nowPeriods.daily;
  } else if (period === 'weekly') {
    periodId = nowPeriods.weekly;
  } else if (period === 'monthly') {
    periodId = nowPeriods.monthly;
  }

  // Allow custom periodId via query parameter if validated
  const periodIdQuery = c.req.query('periodId');
  if (periodIdQuery) {
    let isValidFormat = false;
    if (period === 'daily' && /^\d{4}-\d{2}-\d{2}$/.test(periodIdQuery)) {
      isValidFormat = true;
    } else if (period === 'weekly' && /^\d{4}-W\d{2}$/.test(periodIdQuery)) {
      isValidFormat = true;
    } else if (period === 'monthly' && /^\d{4}-\d{2}$/.test(periodIdQuery)) {
      isValidFormat = true;
    } else if (period === 'all_time' && periodIdQuery === 'all_time') {
      isValidFormat = true;
    }

    if (!isValidFormat) {
      return c.json({ success: false, error: 'Invalid periodId format for this period type' }, 400);
    }
    periodId = periodIdQuery;
  }

  // 5. Determine D1 table and columns
  let tableName = '';
  let valueCol = '';
  if (category === 'stars') {
    tableName = 'user_period_scores';
    valueCol = 'stars_gained';
  } else if (category === 'levels') {
    tableName = 'user_period_scores';
    valueCol = 'levels_done';
  } else if (category === 'records') {
    tableName = 'user_world_records';
    valueCol = 'records_count';
  } else if (category === 'creators') {
    tableName = 'creator_scores';
    valueCol = 'plays_gained';
  }

  const db = c.env.AUDIT_DB;

  try {
    // Fetch friends list if friends_only=true
    let allowedUids: string[] = [];
    if (friends_only && uid) {
      try {
        const { results } = await db.prepare(`
          SELECT CASE WHEN user_a = ?1 THEN user_b ELSE user_a END AS friendUid
          FROM friendships
          WHERE (user_a = ?1 OR user_b = ?1) AND status = 'accepted'
        `).bind(uid).all<{ friendUid: string }>();
        const friendUids = results?.map(r => r.friendUid) ?? [];
        allowedUids = [uid, ...friendUids];
      } catch (err) {
        console.error('[LeaderboardAPI] Failed to fetch friends list:', err);
        return c.json({ success: false, error: 'Database error' }, 500);
      }
    }

    // 6. Query Total Players
    let countResult;
    if (friends_only) {
      const placeholders = allowedUids.map((_, i) => `?${i + 3}`).join(', ');
      countResult = await db.prepare(
        `SELECT COUNT(*) as total FROM ${tableName} WHERE period_type = ?1 AND period_id = ?2 AND uid IN (${placeholders})`
      ).bind(period, periodId, ...allowedUids).first<{ total: number }>();
    } else {
      countResult = await db.prepare(
        `SELECT COUNT(*) as total FROM ${tableName} WHERE period_type = ?1 AND period_id = ?2`
      ).bind(period, periodId).first<{ total: number }>();
    }
    const totalPlayers = countResult?.total ?? 0;

    let myRank: number | null = null;
    let myValue = uid ? 0 : null;

    let userScoreRow: UserScoreRow | null = null;

    // 7. Get logged-in user's stats
    if (uid) {
      let scoreQuery = '';
      if (category === 'creators') {
        scoreQuery = `SELECT plays_gained AS score_val, stars_gained AS secondary_val, updated_at FROM creator_scores WHERE uid = ?1 AND period_type = ?2 AND period_id = ?3`;
      } else {
        scoreQuery = `SELECT ${valueCol} AS score_val, updated_at FROM ${tableName} WHERE uid = ?1 AND period_type = ?2 AND period_id = ?3`;
      }

      const userRow = await db.prepare(scoreQuery).bind(uid, period, periodId).first<UserScoreRow>();
      if (userRow) {
        userScoreRow = userRow;
        myValue = userRow.score_val;

        // Calculate rank
        let rankQuery = '';
        let rankStmt: D1PreparedStatement;
        if (category === 'creators') {
          if (friends_only) {
            const placeholders = allowedUids.map((_, i) => `?${i + 6}`).join(', ');
            rankQuery = `
              SELECT COUNT(*) + 1 AS rank
              FROM creator_scores
              WHERE period_type = ?1 AND period_id = ?2
                AND (
                  plays_gained > ?3
                  OR (plays_gained = ?3 AND stars_gained > ?4)
                  OR (plays_gained = ?3 AND stars_gained = ?4 AND updated_at < ?5)
                )
                AND uid IN (${placeholders})
            `;
            rankStmt = db.prepare(rankQuery).bind(period, periodId, userRow.score_val, userRow.secondary_val ?? 0, userRow.updated_at, ...allowedUids);
          } else {
            rankQuery = `
              SELECT COUNT(*) + 1 AS rank
              FROM creator_scores
              WHERE period_type = ?1 AND period_id = ?2
                AND (
                  plays_gained > ?3
                  OR (plays_gained = ?3 AND stars_gained > ?4)
                  OR (plays_gained = ?3 AND stars_gained = ?4 AND updated_at < ?5)
                )
            `;
            rankStmt = db.prepare(rankQuery).bind(period, periodId, userRow.score_val, userRow.secondary_val ?? 0, userRow.updated_at);
          }
        } else {
          if (friends_only) {
            const placeholders = allowedUids.map((_, i) => `?${i + 5}`).join(', ');
            rankQuery = `
              SELECT COUNT(*) + 1 AS rank
              FROM ${tableName}
              WHERE period_type = ?1 AND period_id = ?2
                AND (${valueCol} > ?3 OR (${valueCol} = ?3 AND updated_at < ?4))
                AND uid IN (${placeholders})
            `;
            rankStmt = db.prepare(rankQuery).bind(period, periodId, userRow.score_val, userRow.updated_at, ...allowedUids);
          } else {
            rankQuery = `
              SELECT COUNT(*) + 1 AS rank
              FROM ${tableName}
              WHERE period_type = ?1 AND period_id = ?2
                AND (${valueCol} > ?3 OR (${valueCol} = ?3 AND updated_at < ?4))
            `;
            rankStmt = db.prepare(rankQuery).bind(period, periodId, userRow.score_val, userRow.updated_at);
          }
        }

        const rankResult = await rankStmt.first<{ rank: number }>();
        myRank = rankResult?.rank ?? null;
      }
    }

    let entries: Array<{ rank: number; uid: string; displayName: string; tag: string | null; value: number }> = [];

    // 8. Fetch Entries
    if (around_me && uid && myRank !== null && userScoreRow) {
      // Fetch ±5 around user using window function CTE
      let cteQuery = '';
      let cteStmt: D1PreparedStatement;
      const minRank = Math.max(1, myRank - 5);
      const maxRank = myRank + 5;

      if (category === 'creators') {
        if (friends_only) {
          const placeholders = allowedUids.map((_, i) => `?${i + 5}`).join(', ');
          cteQuery = `
            WITH Ranked AS (
              SELECT
                c.uid,
                p.display_name AS displayName,
                p.tag,
                p.showcase_badges AS showcaseBadges,
                c.plays_gained AS value,
                ROW_NUMBER() OVER (
                  ORDER BY c.plays_gained DESC, c.stars_gained DESC, c.updated_at ASC
                ) as rank
              FROM creator_scores c
              LEFT JOIN user_profiles p ON c.uid = p.uid
              WHERE c.period_type = ?1 AND c.period_id = ?2 AND c.uid IN (${placeholders})
            )
            SELECT uid, displayName, tag, showcaseBadges, value, rank
            FROM Ranked
            WHERE rank BETWEEN ?3 AND ?4
          `;
          cteStmt = db.prepare(cteQuery).bind(period, periodId, minRank, maxRank, ...allowedUids);
        } else {
          cteQuery = `
            WITH Ranked AS (
              SELECT
                c.uid,
                p.display_name AS displayName,
                p.tag,
                p.showcase_badges AS showcaseBadges,
                c.plays_gained AS value,
                ROW_NUMBER() OVER (
                  ORDER BY c.plays_gained DESC, c.stars_gained DESC, c.updated_at ASC
                ) as rank
              FROM creator_scores c
              LEFT JOIN user_profiles p ON c.uid = p.uid
              WHERE c.period_type = ?1 AND c.period_id = ?2
            )
            SELECT uid, displayName, tag, showcaseBadges, value, rank
            FROM Ranked
            WHERE rank BETWEEN ?3 AND ?4
          `;
          cteStmt = db.prepare(cteQuery).bind(period, periodId, minRank, maxRank);
        }
      } else {
        if (friends_only) {
          const placeholders = allowedUids.map((_, i) => `?${i + 5}`).join(', ');
          cteQuery = `
            WITH Ranked AS (
              SELECT
                s.uid,
                p.display_name AS displayName,
                p.tag,
                p.showcase_badges AS showcaseBadges,
                s.${valueCol} AS value,
                ROW_NUMBER() OVER (
                  ORDER BY s.${valueCol} DESC, s.updated_at ASC
                ) as rank
              FROM ${tableName} s
              LEFT JOIN user_profiles p ON s.uid = p.uid
              WHERE s.period_type = ?1 AND s.period_id = ?2 AND s.uid IN (${placeholders})
            )
            SELECT uid, displayName, tag, showcaseBadges, value, rank
            FROM Ranked
            WHERE rank BETWEEN ?3 AND ?4
          `;
          cteStmt = db.prepare(cteQuery).bind(period, periodId, minRank, maxRank, ...allowedUids);
        } else {
          cteQuery = `
            WITH Ranked AS (
              SELECT
                s.uid,
                p.display_name AS displayName,
                p.tag,
                p.showcase_badges AS showcaseBadges,
                s.${valueCol} AS value,
                ROW_NUMBER() OVER (
                  ORDER BY s.${valueCol} DESC, s.updated_at ASC
                ) as rank
              FROM ${tableName} s
              LEFT JOIN user_profiles p ON s.uid = p.uid
              WHERE s.period_type = ?1 AND s.period_id = ?2
            )
            SELECT uid, displayName, tag, showcaseBadges, value, rank
            FROM Ranked
            WHERE rank BETWEEN ?3 AND ?4
          `;
          cteStmt = db.prepare(cteQuery).bind(period, periodId, minRank, maxRank);
        }
      }

      const { results } = await cteStmt.all<DbEntryRow>();

      entries = results.map((row) => {
        let showcaseBadges = [];
        if (typeof row.showcaseBadges === 'string') {
          try {
            showcaseBadges = JSON.parse(row.showcaseBadges);
          } catch (e) {
            console.error('Failed to parse showcaseBadges JSON:', e);
          }
        }
        return {
          rank: row.rank ?? 0,
          uid: row.uid,
          displayName: row.displayName ?? 'Player',
          tag: row.tag,
          showcaseBadges,
          value: row.value,
        };
      });
    } else {
      // Standard top list query
      let selectQuery = '';
      let selectStmt: D1PreparedStatement;
      if (category === 'creators') {
        if (friends_only) {
          const placeholders = allowedUids.map((_, i) => `?${i + 4}`).join(', ');
          selectQuery = `
            SELECT c.uid, p.display_name AS displayName, p.tag, p.showcase_badges AS showcaseBadges, c.plays_gained AS value
            FROM creator_scores c
            LEFT JOIN user_profiles p ON c.uid = p.uid
            WHERE c.period_type = ?1 AND c.period_id = ?2 AND c.uid IN (${placeholders})
            ORDER BY c.plays_gained DESC, c.stars_gained DESC, c.updated_at ASC
            LIMIT ?3
          `;
          selectStmt = db.prepare(selectQuery).bind(period, periodId, limit, ...allowedUids);
        } else {
          selectQuery = `
            SELECT c.uid, p.display_name AS displayName, p.tag, p.showcase_badges AS showcaseBadges, c.plays_gained AS value
            FROM creator_scores c
            LEFT JOIN user_profiles p ON c.uid = p.uid
            WHERE c.period_type = ?1 AND c.period_id = ?2
            ORDER BY c.plays_gained DESC, c.stars_gained DESC, c.updated_at ASC
            LIMIT ?3
          `;
          selectStmt = db.prepare(selectQuery).bind(period, periodId, limit);
        }
      } else {
        if (friends_only) {
          const placeholders = allowedUids.map((_, i) => `?${i + 4}`).join(', ');
          selectQuery = `
            SELECT s.uid, p.display_name AS displayName, p.tag, p.showcase_badges AS showcaseBadges, s.${valueCol} AS value
            FROM ${tableName} s
            LEFT JOIN user_profiles p ON s.uid = p.uid
            WHERE s.period_type = ?1 AND s.period_id = ?2 AND s.uid IN (${placeholders})
            ORDER BY s.${valueCol} DESC, s.updated_at ASC
            LIMIT ?3
          `;
          selectStmt = db.prepare(selectQuery).bind(period, periodId, limit, ...allowedUids);
        } else {
          selectQuery = `
            SELECT s.uid, p.display_name AS displayName, p.tag, p.showcase_badges AS showcaseBadges, s.${valueCol} AS value
            FROM ${tableName} s
            LEFT JOIN user_profiles p ON s.uid = p.uid
            WHERE s.period_type = ?1 AND s.period_id = ?2
            ORDER BY s.${valueCol} DESC, s.updated_at ASC
            LIMIT ?3
          `;
          selectStmt = db.prepare(selectQuery).bind(period, periodId, limit);
        }
      }

      const { results } = await selectStmt.all<DbEntryRow>();

      entries = results.map((row, idx) => {
        let showcaseBadges = [];
        if (typeof row.showcaseBadges === 'string') {
          try {
            showcaseBadges = JSON.parse(row.showcaseBadges);
          } catch (e) {
            console.error('Failed to parse showcaseBadges JSON:', e);
          }
        }
        return {
          rank: idx + 1,
          uid: row.uid,
          displayName: row.displayName ?? 'Player',
          tag: row.tag,
          showcaseBadges,
          value: row.value,
        };
      });
    }

    return c.json({
      success: true,
      category,
      period,
      periodId,
      entries,
      myRank,
      myValue,
      totalPlayers,
    });
  } catch (err) {
    console.error(`[LeaderboardAPI] Failed to fetch leaderboard:`, err);
    return c.json({ success: false, error: 'Internal error' }, 500);
  }
});
