CREATE TABLE IF NOT EXISTS dash_gestao_entrega_nivel_a_mcc_fcc_projeto (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto     text        NOT NULL,
  nps         numeric     NOT NULL,
  no_show_geral numeric   NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS dash_gestao_entrega_nivel_a_fcc_mcc_mensal (
  id                                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  month_year                            text        NOT NULL,
  banco_formacoes_nao_realizadas_pago   integer     NOT NULL,
  created_at                            timestamptz DEFAULT now() NOT NULL,
  updated_at                            timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS dash_gestao_entrega_nivel_a_ultimate_mensal (
  id                            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  month_year                    text        NOT NULL,
  nps_medio_entregas            numeric     NOT NULL,
  perc_presenca_sessao_feedback numeric     NOT NULL,
  mau_usuarios_ativos_mensal    integer     NOT NULL,
  created_at                    timestamptz DEFAULT now() NOT NULL,
  updated_at                    timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS dash_gestao_entrega_nivel_a_ultimate_projeto (
  id                                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto                               text        NOT NULL,
  perc_presenca_encontros_online_dia1   numeric     NOT NULL,
  perc_presenca_encontro_presencial     numeric     NOT NULL,
  created_at                            timestamptz DEFAULT now() NOT NULL,
  updated_at                            timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS dash_gestao_entrega_nivel_a_destrave_projeto (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto     text        NOT NULL,
  nps         numeric     NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);
