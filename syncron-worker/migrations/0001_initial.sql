-- ─── Audit Logs Table ────────────────────────────────────────────────────────
-- Stores all user activity events for admin review and legal compliance.
-- Note: IP and user_agent fields are intentionally omitted (KVKK/GDPR compliance).

CREATE TABLE IF NOT EXISTS audit_logs (
  id         TEXT    NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  uid        TEXT    NOT NULL,
  action     TEXT    NOT NULL,   -- e.g. 'level.complete', 'ticket.create', 'account.create'
  category   TEXT    NOT NULL,   -- 'game' | 'support' | 'account' | 'payment' | 'admin'
  metadata   TEXT    NOT NULL DEFAULT '{}',  -- JSON string, action-specific details
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Primary query pattern: all logs for a user, newest first
CREATE INDEX IF NOT EXISTS idx_logs_uid_created
  ON audit_logs(uid, created_at DESC);

-- Category-filtered queries for a user
CREATE INDEX IF NOT EXISTS idx_logs_uid_category_created
  ON audit_logs(uid, category, created_at DESC);

-- Action-filtered queries for a user
CREATE INDEX IF NOT EXISTS idx_logs_uid_action_created
  ON audit_logs(uid, action, created_at DESC);

-- Retention cron: find logs older than N days
CREATE INDEX IF NOT EXISTS idx_logs_created
  ON audit_logs(created_at ASC);
