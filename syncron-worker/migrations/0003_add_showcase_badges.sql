-- Migration: 0003_add_showcase_badges.sql
-- Description: Add showcase_badges column to user_profiles table.
--              Stores the JSON array of showcase badges for quick JOINs in leaderboards.

ALTER TABLE user_profiles ADD COLUMN showcase_badges TEXT DEFAULT NULL;
