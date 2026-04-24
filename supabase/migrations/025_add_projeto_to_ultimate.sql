-- supabase/migrations/025_add_projeto_to_ultimate.sql
ALTER TABLE public.dash_gestao_convite_ultimate
  ADD COLUMN IF NOT EXISTS projeto text NOT NULL DEFAULT '';
