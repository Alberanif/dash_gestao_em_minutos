CREATE TABLE IF NOT EXISTS dash_gestao_convite_ultimate (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  month_year       date        NOT NULL,
  numero_absoluto  integer     NOT NULL,
  created_at       timestamptz DEFAULT now() NOT NULL,
  updated_at       timestamptz DEFAULT now() NOT NULL
);
