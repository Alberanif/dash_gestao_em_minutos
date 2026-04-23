CREATE TABLE IF NOT EXISTS dash_gestao_eqa (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start            date        NOT NULL,
  week_end              date        NOT NULL,
  seguidores_conectados integer     NOT NULL,
  total_ctas            integer     NOT NULL,
  total_agendamentos    integer     NOT NULL,
  created_at            timestamptz DEFAULT now() NOT NULL,
  updated_at            timestamptz DEFAULT now() NOT NULL
);
