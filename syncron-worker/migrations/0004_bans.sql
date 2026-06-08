-- Migration: 0004_bans.sql
-- Description: Granular, time-limited ban records issued by admins.
--              ban_type : 'platform' | 'tag' | 'social' | 'coop'
--              expires_at: NULL = permanent ban
--              lifted_at : NULL = still active

CREATE TABLE IF NOT EXISTS user_bans (
  id          TEXT NOT NULL PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  uid         TEXT NOT NULL CHECK (length(uid) BETWEEN 1 AND 128),
  ban_type    TEXT NOT NULL CHECK (ban_type IN ('platform', 'tag', 'social', 'coop')),
  reason      TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  issued_by   TEXT NOT NULL CHECK (length(issued_by) BETWEEN 1 AND 128),
  issued_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at  TEXT,     -- ISO 8601 UTC, NULL = permanent
  lifted_at   TEXT,     -- set when lifted by admin
  lifted_by   TEXT,     -- admin uid who lifted the ban
  CHECK (expires_at IS NULL OR length(expires_at) BETWEEN 10 AND 30),
  CHECK (lifted_at IS NULL OR length(lifted_at) BETWEEN 10 AND 30)
);

-- Fast "is this user banned?" lookup
CREATE INDEX IF NOT EXISTS idx_bans_uid_type
  ON user_bans(uid, ban_type, lifted_at, expires_at);
