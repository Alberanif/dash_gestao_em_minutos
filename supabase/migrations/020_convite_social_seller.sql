CREATE TABLE IF NOT EXISTS dash_gestao_convite_social_seller (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start           date        NOT NULL,
  week_end             date        NOT NULL,
  reunioes_realizadas  integer     NOT NULL,
  vendas_realizadas    integer     NOT NULL,
  created_at           timestamptz DEFAULT now() NOT NULL,
  updated_at           timestamptz DEFAULT now() NOT NULL
);
