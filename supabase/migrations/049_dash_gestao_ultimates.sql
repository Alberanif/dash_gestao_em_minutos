-- Dash Ultimates: monitoramento de ciclo de renovação.
-- Ciclos definem o período/produto acompanhado; buyers são a base de
-- compradores importada (CSV) para aquele ciclo; manual_links registram
-- vínculos manuais comprador -> venda Hotmart quando o cruzamento
-- automático por email não resolve.
--
-- Nenhum dado existente é alterado — só o índice novo em
-- dash_gestao_hotmart_sales (critério 12 do PRD, issue #114).

-- UP
create table dash_gestao_ultimates_cycles (
  id                 uuid        not null default gen_random_uuid() primary key,
  name               text        not null,
  account_id         uuid        not null references dash_gestao_accounts(id),
  product_id         text        not null references dash_gestao_hotmart_products(product_id),
  goal_percent       numeric,
  status             text        not null default 'ativo'
    constraint chk_ultimates_cycle_status check (status in ('ativo', 'encerrado')),
  refresh_started_at timestamptz,
  last_refresh_at    timestamptz,
  created_by         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_ultimates_cycles_product_status on dash_gestao_ultimates_cycles (product_id, status);

alter table dash_gestao_ultimates_cycles enable row level security;

-- Reads via server client (user session); writes via service_role (bypasses RLS)
create policy "Authenticated users can read ultimates cycles"
  on dash_gestao_ultimates_cycles
  for select
  to authenticated
  using (true);

create table dash_gestao_ultimates_buyers (
  id         uuid        not null default gen_random_uuid() primary key,
  cycle_id   uuid        not null references dash_gestao_ultimates_cycles(id) on delete cascade,
  email      text        not null,
  name       text,
  phone      text,
  extra      jsonb       not null default '{}',
  created_at timestamptz not null default now(),
  constraint uq_ultimates_buyers_cycle_email unique (cycle_id, email)
);

create index idx_ultimates_buyers_cycle_id on dash_gestao_ultimates_buyers (cycle_id);

alter table dash_gestao_ultimates_buyers enable row level security;

create policy "Authenticated users can read ultimates buyers"
  on dash_gestao_ultimates_buyers
  for select
  to authenticated
  using (true);

create table dash_gestao_ultimates_manual_links (
  id               uuid        not null default gen_random_uuid() primary key,
  cycle_id         uuid        not null references dash_gestao_ultimates_cycles(id) on delete cascade,
  buyer_id         uuid        not null references dash_gestao_ultimates_buyers(id) on delete cascade,
  transaction_code text        not null unique,
  linked_by        uuid        not null,
  created_at       timestamptz not null default now()
);

create index idx_ultimates_manual_links_cycle_id on dash_gestao_ultimates_manual_links (cycle_id);

alter table dash_gestao_ultimates_manual_links enable row level security;

create policy "Authenticated users can read ultimates manual links"
  on dash_gestao_ultimates_manual_links
  for select
  to authenticated
  using (true);

-- Sustenta o cruzamento por email entre buyers do ciclo e vendas Hotmart
-- do mesmo produto (dash_gestao_hotmart_sales já existe, criada fora do
-- controle de migrations — ver seção 6 de conventions.md).
create index idx_hotmart_sales_product_buyer_email on dash_gestao_hotmart_sales (product_id, lower(buyer_email));

-- DOWN
-- drop index if exists idx_hotmart_sales_product_buyer_email;
-- drop table if exists dash_gestao_ultimates_manual_links;
-- drop table if exists dash_gestao_ultimates_buyers;
-- drop table if exists dash_gestao_ultimates_cycles;
