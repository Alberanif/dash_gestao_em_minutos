-- UP
create table dash_gestao_hotmart_products (
  id           uuid        not null default gen_random_uuid() primary key,
  account_id   uuid        not null references dash_gestao_accounts(id) on delete cascade,
  product_id   text        not null unique,
  product_name text        not null,
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_hotmart_products_account_active on dash_gestao_hotmart_products (account_id, is_active);

alter table dash_gestao_hotmart_products enable row level security;

create policy "Authenticated users can read hotmart products"
  on dash_gestao_hotmart_products
  for select
  to authenticated
  using (true);

create table dash_gestao_hotmart_offers (
  id            uuid        not null default gen_random_uuid() primary key,
  account_id    uuid        not null references dash_gestao_accounts(id) on delete cascade,
  product_id    text        not null references dash_gestao_hotmart_products(product_id),
  offer_code    text        not null unique,
  offer_name    text        not null,
  price         numeric,
  currency      text,
  is_main_offer boolean     not null default false,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_hotmart_offers_product_active on dash_gestao_hotmart_offers (product_id, is_active);

alter table dash_gestao_hotmart_offers enable row level security;

create policy "Authenticated users can read hotmart offers"
  on dash_gestao_hotmart_offers
  for select
  to authenticated
  using (true);

-- DOWN
-- drop table if exists dash_gestao_hotmart_offers;
-- drop table if exists dash_gestao_hotmart_products;
