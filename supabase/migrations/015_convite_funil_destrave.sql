CREATE TABLE IF NOT EXISTS dash_gestao_convite_funil_destrave (
  id                     uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto                text        NOT NULL,
  comparecimento         integer     NOT NULL,
  conv_produto_principal numeric     NOT NULL,
  conv_downsell          numeric     NOT NULL,
  conv_upsell            numeric     NOT NULL,
  cac_geral              numeric     NOT NULL,
  created_at             timestamptz DEFAULT now() NOT NULL,
  updated_at             timestamptz DEFAULT now() NOT NULL
);
