-- Tabela polimórfica de funis EQA
-- Suporta múltiplos tipos via campo "type" + config JSONB
-- Tipo "destrave": config = { product_ids: string[], ad_account_ids: uuid[] }

CREATE TABLE dash_gestao_funnels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  type        text NOT NULL CHECK (type IN ('destrave')),
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  goal_sales  integer NOT NULL,
  config      jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dash_gestao_funnels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_read" ON dash_gestao_funnels
  FOR SELECT USING (true);

CREATE POLICY "allow_write" ON dash_gestao_funnels
  FOR ALL USING (true) WITH CHECK (true);
