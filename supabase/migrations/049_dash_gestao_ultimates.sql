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

-- Sem policy de select para authenticated: a tabela contém dados pessoais
-- (email/telefone/extra) e toda leitura do app passa pelo service_role nas
-- rotas /api/ultimates (com gate de papel). Uma policy `using (true)` deixaria
-- qualquer usuário autenticado (inclusive comum) ler a base via PostgREST
-- direto — mesmo risco que motivou o revoke de execute nas RPCs (migration 050).

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

-- Sem policy de select para authenticated — mesma razão da tabela buyers.

-- Sustenta o cruzamento por email entre buyers do ciclo e vendas Hotmart
-- do mesmo produto (dash_gestao_hotmart_sales já existe, criada fora do
-- controle de migrations — ver seção 6 de conventions.md). A expressão
-- precisa ser idêntica à usada no join das RPCs (migration 050):
-- lower(btrim(buyer_email)) — o coletor grava o email cru da Hotmart.
create index idx_hotmart_sales_product_buyer_email on dash_gestao_hotmart_sales (product_id, lower(btrim(buyer_email)));

-- DOWN
-- drop index if exists idx_hotmart_sales_product_buyer_email;
-- drop table if exists dash_gestao_ultimates_manual_links;
-- drop table if exists dash_gestao_ultimates_buyers;
-- drop table if exists dash_gestao_ultimates_cycles;
