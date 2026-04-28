-- supabase/migrations/027_instagram_media_daily_schema_update.sql

-- Note: Column type remains DATE (not TIMESTAMP) to preserve original schema.
-- last_collected_at stores the collection date with day granularity only.

-- Rename column date → last_collected_at
ALTER TABLE dash_gestao_instagram_media_daily
RENAME COLUMN date TO last_collected_at;

-- Drop the old unique constraint
ALTER TABLE dash_gestao_instagram_media_daily
DROP CONSTRAINT dash_gestao_instagram_media_daily_account_id_media_id_date_key;

-- Add new unique constraint on (account_id, media_id)
ALTER TABLE dash_gestao_instagram_media_daily
ADD CONSTRAINT dash_gestao_instagram_media_daily_account_id_media_id_key
UNIQUE (account_id, media_id);

-- Truncate the table (existing rows violate the new constraint)
TRUNCATE TABLE dash_gestao_instagram_media_daily;

-- Drop the old index
DROP INDEX IF EXISTS idx_media_daily_account_date;

-- Create new index on (account_id, last_collected_at DESC)
CREATE INDEX idx_media_daily_account
ON dash_gestao_instagram_media_daily (account_id, last_collected_at DESC);
