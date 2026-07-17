-- Relatório de IA (Six Dados) por Evento ativo — um relatório vigente por filtro (upsert por filter_id).
-- kpi_snapshot guarda o bloco vitalício + bloco 7d usados no prompt (fonte dos KPIs exibidos na UI).
-- generating_at é o lock de concorrência: setado no início da geração, limpo no fim; lock expirado (~2 min) pode ser roubado.

-- UP
create table dash_gestao_ai_reports (
  id            uuid        not null default gen_random_uuid() primary key,
  filter_id     uuid        not null unique references dash_gestao_filters(id) on delete cascade,
  report_text   text,
  kpi_snapshot  jsonb,
  generated_at  timestamptz,
  generating_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table dash_gestao_ai_reports enable row level security;

-- Reads via server client (user session); writes via service_role (bypasses RLS)
create policy "Authenticated users can read ai reports"
  on dash_gestao_ai_reports
  for select
  to authenticated
  using (true);

-- DOWN
-- drop table if exists dash_gestao_ai_reports;
