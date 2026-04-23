CREATE TABLE IF NOT EXISTS dash_gestao_convite_fcc (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto          text        NOT NULL,
  perc_assessment  numeric     NOT NULL,
  perc_mcc         numeric     NOT NULL,
  perc_pc_ao_vivo  numeric     NOT NULL,
  created_at       timestamptz DEFAULT now() NOT NULL,
  updated_at       timestamptz DEFAULT now() NOT NULL
);
