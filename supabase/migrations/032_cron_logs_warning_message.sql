-- supabase/migrations/032_cron_logs_warning_message.sql
ALTER TABLE dash_gestao_cron_logs
  ADD COLUMN IF NOT EXISTS warning_message text;
