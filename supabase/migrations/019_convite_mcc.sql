CREATE TABLE IF NOT EXISTS dash_gestao_convite_mcc (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto          text        NOT NULL,
  perc_ultimate    numeric     NOT NULL,
  perc_pc_ao_vivo  numeric     NOT NULL,
  created_at       timestamptz DEFAULT now() NOT NULL,
  updated_at       timestamptz DEFAULT now() NOT NULL
);
