-- UP
create table dash_gestao_filters (
  id               uuid        not null default gen_random_uuid() primary key,
  account_id       uuid        not null references dash_gestao_accounts(id) on delete cascade,
  name             text        not null,
  hotmart_products jsonb       not null default '[]'::jsonb,
  meta_ads_terms   text[]      not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint chk_filter_not_empty
    check (hotmart_products != '[]'::jsonb or meta_ads_terms != '{}')
);

create index idx_filters_account_id on dash_gestao_filters (account_id);

alter table dash_gestao_filters enable row level security;

-- Reads via server client (user session); writes via service_role (bypasses RLS)
create policy "Authenticated users can read filters"
  on dash_gestao_filters
  for select
  to authenticated
  using (true);

-- DOWN
-- drop table if exists dash_gestao_filters;
