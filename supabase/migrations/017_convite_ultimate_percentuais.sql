CREATE TABLE IF NOT EXISTS dash_gestao_convite_ultimate_percentuais (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto          text        NOT NULL,
  perc_renovacao   numeric     NOT NULL,
  perc_conv_pitch  numeric     NOT NULL,
  created_at       timestamptz DEFAULT now() NOT NULL,
  updated_at       timestamptz DEFAULT now() NOT NULL
);
