/**
 * Audit Log Service — D1 Database Operations
 *
 * ALL queries use D1's parameterized binding (.bind()) to prevent SQL injection.
 * String interpolation in SQL is strictly forbidden in this file.
 *
 * KVKK/GDPR note: IP addresses and user-agents are intentionally not stored.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditCategory = 'game' | 'support' | 'account' | 'payment' | 'admin';

export type AuditAction =
  // Game actions
  | 'level.complete'
  // Support actions
  | 'ticket.create'
  | 'ticket.message'
  // Account actions
  | 'account.create'
  | 'account.upgrade'
  | 'account.tag_change'
  // Payment actions (future)
  | 'payment.success'
  | 'payment.failed'
  | 'payment.refund'
  // Admin actions (future)
  | 'admin.role_change'
  | 'admin.ticket_status_change';

export interface AuditLogRow {
  id: string;
  uid: string;
  action: string;
  category: string;
  metadata: string; // JSON string
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  uid: string;
  action: string;
  category: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogFilters {
  category?: AuditCategory;
  action?: AuditAction | string;
  after?: string;  // ISO timestamp
  before?: string; // ISO timestamp
}

export interface AuditLogStats {
  totalCount: number;
  levelsCompleted: number;
  ticketsCreated: number;
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Inserts a new audit log entry into D1.
 * All parameters are bound — never interpolated into the SQL string.
 */
export async function writeAuditLog(
  db: D1Database,
  uid: string,
  action: AuditAction | string,
  category: AuditCategory,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_logs (uid, action, category, metadata)
       VALUES (?1, ?2, ?3, ?4)`,
    )
    .bind(
      uid,
      action,
      category,
      JSON.stringify(metadata),
    )
    .run();
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Fetches paginated audit logs for a specific user.
 * Supports filtering by category, action, and date range.
 * All dynamic values are parameterized — never interpolated.
 */
export async function queryAuditLogs(
  db: D1Database,
  uid: string,
  filters: AuditLogFilters = {},
  limit = 50,
  offset = 0,
): Promise<AuditLogEntry[]> {
  const conditions: string[] = ['uid = ?1'];
  const params: unknown[] = [uid];
  let pIdx = 2; // next parameter placeholder index

  if (filters.category) {
    conditions.push(`category = ?${pIdx}`);
    params.push(filters.category);
    pIdx++;
  }

  if (filters.action) {
    conditions.push(`action = ?${pIdx}`);
    params.push(filters.action);
    pIdx++;
  }

  if (filters.after) {
    conditions.push(`created_at >= ?${pIdx}`);
    params.push(filters.after);
    pIdx++;
  }

  if (filters.before) {
    conditions.push(`created_at <= ?${pIdx}`);
    params.push(filters.before);
    pIdx++;
  }

  // LIMIT and OFFSET are also parameterized — D1 supports this
  const sql = `
    SELECT id, uid, action, category, metadata, created_at
    FROM audit_logs
    WHERE ${conditions.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT ?${pIdx} OFFSET ?${pIdx + 1}
  `;
  params.push(limit, offset);

  const result = await db.prepare(sql).bind(...params).all<AuditLogRow>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    uid: row.uid,
    action: row.action,
    category: row.category,
    metadata: safeParseJson(row.metadata),
    createdAt: row.created_at,
  }));
}

/**
 * Returns aggregate statistics for a specific user.
 */
export async function getAuditLogStats(
  db: D1Database,
  uid: string,
): Promise<AuditLogStats> {
  const result = await db
    .prepare(
      `SELECT
         COUNT(*) AS total_count,
         SUM(CASE WHEN action = 'level.complete' THEN 1 ELSE 0 END) AS levels_completed,
         SUM(CASE WHEN action = 'ticket.create'  THEN 1 ELSE 0 END) AS tickets_created
       FROM audit_logs
       WHERE uid = ?1`,
    )
    .bind(uid)
    .first<{ total_count: number; levels_completed: number; tickets_created: number }>();

  return {
    totalCount: result?.total_count ?? 0,
    levelsCompleted: result?.levels_completed ?? 0,
    ticketsCreated: result?.tickets_created ?? 0,
  };
}

/**
 * Returns the most recent log entry for a user (used for "last seen" display).
 */
export async function getLastActivity(
  db: D1Database,
  uid: string,
): Promise<string | null> {
  const result = await db
    .prepare(
      `SELECT created_at FROM audit_logs
       WHERE uid = ?1
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .bind(uid)
    .first<{ created_at: string }>();

  return result?.created_at ?? null;
}

// ─── Retention (used by scheduled cron) ──────────────────────────────────────

/**
 * Fetches a batch of logs older than the given ISO cutoff date.
 * Used by the retention cron to identify rows to archive.
 */
export async function fetchOldLogBatch(
  db: D1Database,
  cutoffIso: string,
  batchSize: number,
): Promise<AuditLogRow[]> {
  const result = await db
    .prepare(
      `SELECT * FROM audit_logs
       WHERE created_at < ?1
       ORDER BY created_at ASC
       LIMIT ?2`,
    )
    .bind(cutoffIso, batchSize)
    .all<AuditLogRow>();

  return result.results ?? [];
}

/**
 * Deletes a batch of log entries by their IDs.
 * IDs are passed as an array and bound with individual placeholders.
 * Max batch size: 999 (SQLite IN clause limit).
 */
export async function deleteLogBatch(
  db: D1Database,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  // Build parameterized IN clause: (?1, ?2, ?3, ...)
  const placeholders = ids.map((_, i) => `?${i + 1}`).join(', ');
  await db
    .prepare(`DELETE FROM audit_logs WHERE id IN (${placeholders})`)
    .bind(...ids)
    .run();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeParseJson(str: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}
