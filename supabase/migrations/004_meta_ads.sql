-- Métricas diárias agregadas por conta de anúncios Meta
CREATE TABLE dash_gestao_meta_ads_daily (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id       uuid NOT NULL REFERENCES dash_gestao_accounts(id) ON DELETE CASCADE,
  date             date NOT NULL,
  spend            numeric(12,2) DEFAULT 0,
  impressions      bigint DEFAULT 0,
  reach            bigint DEFAULT 0,
  clicks           bigint DEFAULT 0,
  ctr              numeric(8,4) DEFAULT 0,    -- porcentagem (ex: 1.23 = 1.23%)
  cpc              numeric(10,4) DEFAULT 0,   -- custo por clique em R$
  cpm              numeric(10,4) DEFAULT 0,   -- custo por mil impressões em R$
  conversions      integer DEFAULT 0,         -- soma de actions purchase/lead
  conversion_value numeric(12,2) DEFAULT 0,  -- valor de conversão (para ROAS)
  collected_at     timestamptz DEFAULT now(),
  UNIQUE (account_id, date)
);

-- Snapshot de performance por campanha
CREATE TABLE dash_gestao_meta_ads_campaigns (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id       uuid NOT NULL REFERENCES dash_gestao_accounts(id) ON DELETE CASCADE,
  campaign_id      text NOT NULL,
  campaign_name    text NOT NULL,
  status           text,           -- ACTIVE, PAUSED, ARCHIVED, etc.
  objective        text,
  spend            numeric(12,2) DEFAULT 0,
  impressions      bigint DEFAULT 0,
  reach            bigint DEFAULT 0,
  clicks           bigint DEFAULT 0,
  ctr              numeric(8,4) DEFAULT 0,
  cpc              numeric(10,4) DEFAULT 0,
  conversions      integer DEFAULT 0,
  conversion_value numeric(12,2) DEFAULT 0,
  collected_date   date NOT NULL,  -- data em que este snapshot foi coletado
  UNIQUE (account_id, campaign_id, collected_date)
);

-- Row Level Security
ALTER TABLE dash_gestao_meta_ads_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE dash_gestao_meta_ads_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_meta_ads_daily"
  ON dash_gestao_meta_ads_daily FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_select_meta_ads_campaigns"
  ON dash_gestao_meta_ads_campaigns FOR SELECT TO authenticated USING (true);
