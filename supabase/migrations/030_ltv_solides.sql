CREATE TABLE IF NOT EXISTS dash_gestao_ltv_solides (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start           DATE NOT NULL,
  period_end             DATE NOT NULL,
  assinaturas_ativas     INTEGER NOT NULL DEFAULT 0,
  assinaturas_canceladas INTEGER NOT NULL DEFAULT 0,
  novas_assinaturas      INTEGER NOT NULL DEFAULT 0,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
