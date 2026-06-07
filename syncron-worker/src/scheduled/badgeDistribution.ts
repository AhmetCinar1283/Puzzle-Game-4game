import { getCurrentPeriodIds } from '../services/leaderboard';
import type { Env } from '../types';

/**
 * Scheduled Cron Trigger - Badge Distribution (Phase 7)
 *
 * Distributes weekly and monthly badges to the top-3 players in each category
 * based on the previous period.
 *
 * Runs:
 *   - Weekly: Every Monday at 00:05 UTC (period calculated by subtracting 24h)
 *   - Monthly: Every 1st of the month at 00:05 UTC (period calculated by subtracting 24h)
 *
 * Idempotence is guaranteed by D1 UNIQUE constraint on (uid, badge_type, period_id)
 * using INSERT OR IGNORE.
 */
export async function runBadgeDistribution(
  env: Env,
  type: 'weekly' | 'monthly',
  date: Date = new Date(),
): Promise<void> {
  console.log(
    `[BadgeDistribution] Starting badge distribution. Type: ${type}, Date: ${date.toISOString()}`,
  );

  // Subtract 24 hours to step back into the previous period
  const prevDate = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  const prevPeriods = getCurrentPeriodIds(prevDate);
  const db = env.AUDIT_DB;

  if (type === 'weekly') {
    const periodId = prevPeriods.weekly;
    console.log(`[BadgeDistribution] Processing weekly badges for period: ${periodId}`);

    const categories = [
      {
        name: 'stars',
        query: `
          SELECT uid FROM user_period_scores
          WHERE period_type = 'weekly' AND period_id = ?1
          ORDER BY stars_gained DESC, updated_at ASC
          LIMIT 3
        `,
      },
      {
        name: 'levels',
        query: `
          SELECT uid FROM user_period_scores
          WHERE period_type = 'weekly' AND period_id = ?1
          ORDER BY levels_done DESC, updated_at ASC
          LIMIT 3
        `,
      },
      {
        name: 'records',
        query: `
          SELECT uid FROM user_world_records
          WHERE period_type = 'weekly' AND period_id = ?1
          ORDER BY records_count DESC, updated_at ASC
          LIMIT 3
        `,
      },
    ];

    for (const cat of categories) {
      try {
        const { results } = await db.prepare(cat.query).bind(periodId).all<{ uid: string }>();
        console.log(`[BadgeDistribution] Found ${results.length} winners for category: ${cat.name}`);

        const insertQuery = `
          INSERT OR IGNORE INTO badges (uid, badge_type, period_id, rank, awarded_at)
          VALUES (?1, ?2, ?3, ?4, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        `;
        const statements: D1PreparedStatement[] = [];

        results.forEach((row, index) => {
          const rank = index + 1;
          const badgeType = rank === 1 ? `weekly_${cat.name}_1st` : `weekly_${cat.name}_top3`;
          statements.push(db.prepare(insertQuery).bind(row.uid, badgeType, periodId, rank));
          console.log(
            `[BadgeDistribution] Awarding badge '${badgeType}' (Rank ${rank}) to user ${row.uid}`,
          );
        });

        if (statements.length > 0) {
          await db.batch(statements);
        }
      } catch (err) {
        console.error(
          `[BadgeDistribution] Failed to distribute weekly badges for category '${cat.name}':`,
          err,
        );
      }
    }
  } else if (type === 'monthly') {
    const periodId = prevPeriods.monthly;
    console.log(`[BadgeDistribution] Processing monthly badges for period: ${periodId}`);

    const creatorQuery = `
      SELECT uid FROM creator_scores
      WHERE period_type = 'monthly' AND period_id = ?1
      ORDER BY plays_gained DESC, stars_gained DESC, updated_at ASC
      LIMIT 3
    `;

    try {
      const { results } = await db.prepare(creatorQuery).bind(periodId).all<{ uid: string }>();
      console.log(`[BadgeDistribution] Found ${results.length} creators for monthly badges`);

      const insertQuery = `
        INSERT OR IGNORE INTO badges (uid, badge_type, period_id, rank, awarded_at)
        VALUES (?1, ?2, ?3, ?4, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      `;
      const statements: D1PreparedStatement[] = [];

      results.forEach((row, index) => {
        const rank = index + 1;
        const badgeType = rank === 1 ? 'monthly_creator_1st' : 'monthly_creator_top3';
        statements.push(db.prepare(insertQuery).bind(row.uid, badgeType, periodId, rank));
        console.log(
          `[BadgeDistribution] Awarding badge '${badgeType}' (Rank ${rank}) to creator user ${row.uid}`,
        );
      });

      if (statements.length > 0) {
        await db.batch(statements);
      }
    } catch (err) {
      console.error('[BadgeDistribution] Failed to distribute monthly creator badges:', err);
    }
  }

  console.log(`[BadgeDistribution] Completed badge distribution for type: ${type}`);
}
