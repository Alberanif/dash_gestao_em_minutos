-- Status de evento para os filtros salvos do dashboard Indicadores.
-- status: classificação do evento (pastas da tela Eventos).
-- status_changed_at: null = nunca mudou de status desde a criação.

alter table dash_gestao_filters
  add column status text not null default 'ativo'
    constraint chk_filter_status check (status in ('ativo', 'finalizado', 'cancelado'));

alter table dash_gestao_filters
  add column status_changed_at timestamptz;
