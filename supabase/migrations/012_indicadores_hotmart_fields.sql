ALTER TABLE dash_gestao_indicadores_projects
  ADD COLUMN IF NOT EXISTS hotmart_account_id text,
  ADD COLUMN IF NOT EXISTS hotmart_product_ids text[] NOT NULL DEFAULT '{}';
