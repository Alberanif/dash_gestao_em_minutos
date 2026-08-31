-- Migration 066: Rename Dash Ultimates to Relatório de Vendas (tables & RPCs)

-- 1. Rename Tables
alter table public.dash_gestao_ultimates_cycles rename to dash_gestao_vendas_cycles;
alter table public.dash_gestao_ultimates_buyers rename to dash_gestao_vendas_buyers;
alter table public.dash_gestao_ultimates_manual_links rename to dash_gestao_vendas_manual_links;
alter table public.dash_gestao_ultimates_cycle_products rename to dash_gestao_vendas_cycle_products;
alter table public.dash_gestao_ultimates_cycle_offers rename to dash_gestao_vendas_cycle_offers;
alter table public.dash_gestao_ultimates_excluded_buyers rename to dash_gestao_vendas_excluded_buyers;
alter table public.dash_gestao_ultimates_excluded_offers_archive rename to dash_gestao_vendas_excluded_offers_archive;

-- 2. Internal Helper RPCs
create function public.dash_gestao_vendas_selection_products(p_selection jsonb)
returns table (
  product_id        text,
  include_offerless boolean
)
language sql
immutable
set search_path = public
as $$
  select
    btrim(e.item->>'product_id')                       as product_id,
    bool_or((e.item->>'include_offerless')::boolean)   as include_offerless
  from jsonb_array_elements(
         case when jsonb_typeof(p_selection) = 'array'
              then p_selection else '[]'::jsonb end
       ) as e(item)
  where btrim(coalesce(e.item->>'product_id', '')) <> ''
  group by btrim(e.item->>'product_id');
$$;

create function public.dash_gestao_vendas_selection_offers(p_selection jsonb)
returns table (
  product_id text,
  offer_code text,
  included   boolean
)
language sql
immutable
set search_path = public
as $$
  with items as (
    select
      btrim(e.item->>'product_id') as pid,
      e.item                       as item
    from jsonb_array_elements(
           case when jsonb_typeof(p_selection) = 'array'
                then p_selection else '[]'::jsonb end
         ) as e(item)
    where btrim(coalesce(e.item->>'product_id', '')) <> ''
  ),
  raw as (
    select i.pid as pid, btrim(c.code) as code, true as inc
    from items i,
         lateral jsonb_array_elements_text(
           case when jsonb_typeof(i.item->'offer_codes') = 'array'
                then i.item->'offer_codes' else '[]'::jsonb end
         ) as c(code)
    where btrim(c.code) <> ''
    union all
    select i.pid as pid, btrim(c.code) as code, false as inc
    from items i,
         lateral jsonb_array_elements_text(
           case when jsonb_typeof(i.item->'rejected_offer_codes') = 'array'
                then i.item->'rejected_offer_codes' else '[]'::jsonb end
         ) as c(code)
    where btrim(c.code) <> ''
  )
  select
    min(r.pid)     as product_id,
    r.code         as offer_code,
    bool_or(r.inc) as included
  from raw r
  group by r.code;
$$;

-- 3. Cycle Sales
create or replace function public.dash_gestao_vendas_cycle_sales(
  p_cycle_id uuid,
  p_start    date default null,
  p_end      date default null
)
returns table (
  transaction_code text,
  product_id       text,
  offer_code       text,
  status           text,
  currency         text,
  price            numeric,
  approved_date    timestamptz,
  approved_day     date,
  approved_hour    text,
  norm_email       text,
  buyer_name       text,
  buyer_phone      text,
  matched_buyer_id uuid,
  via_link         boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with prods as (
    select cp.product_id as pid, cp.include_offerless as offerless
    from public.dash_gestao_vendas_cycle_products cp
    where cp.cycle_id = p_cycle_id
  ),
  allowed as (
    select co.offer_code as code
    from public.dash_gestao_vendas_cycle_offers co
    where co.cycle_id = p_cycle_id
      and co.included is true
  ),
  excluded_emails as (
    select eb.email as email
    from public.dash_gestao_vendas_excluded_buyers eb
    where eb.cycle_id = p_cycle_id
  ),
  excluded_links as (
    select ml.transaction_code as tx
    from public.dash_gestao_vendas_manual_links ml
    join public.dash_gestao_vendas_buyers b on b.id = ml.buyer_id
    where ml.cycle_id = p_cycle_id
      and exists (
        select 1 from excluded_emails ee where ee.email = lower(btrim(b.email))
      )
  ),
  cycle_buyers as (
    select b.id as bid, lower(btrim(b.email)) as bemail
    from public.dash_gestao_vendas_buyers b
    where b.cycle_id = p_cycle_id
      and not exists (
        select 1 from excluded_emails ee where ee.email = lower(btrim(b.email))
      )
  ),
  links as (
    select ml.transaction_code as tx, ml.buyer_id as bid
    from public.dash_gestao_vendas_manual_links ml
    where ml.cycle_id = p_cycle_id
  )
  select
    s.transaction_code,
    s.product_id,
    s.offer_code,
    s.status,
    s.currency,
    s.price,
    s.approved_date,
    (s.approved_date at time zone 'America/Sao_Paulo')::date as approved_day,
    to_char(
      date_trunc('hour', s.approved_date at time zone 'America/Sao_Paulo'),
      'YYYY-MM-DD"T"HH24'
    ) as approved_hour,
    lower(btrim(s.buyer_email))      as norm_email,
    nullif(btrim(s.buyer_name), '')  as buyer_name,
    nullif(btrim(s.buyer_phone), '') as buyer_phone,
    coalesce(l.bid, cb.bid)          as matched_buyer_id,
    l.bid is not null                as via_link
  from public.dash_gestao_hotmart_sales s
  left join links l        on l.tx = s.transaction_code
  left join cycle_buyers cb on cb.bemail = lower(btrim(s.buyer_email))
  where s.product_id in (select prods.pid from prods)
    and (
      exists (select 1 from allowed al where al.code = s.offer_code)
      or (
        s.offer_code is null
        and exists (
          select 1 from prods po
          where po.pid = s.product_id and po.offerless is true
        )
      )
    )
    and not exists (
      select 1 from excluded_emails ee where ee.email = lower(btrim(s.buyer_email))
    )
    and not exists (
      select 1 from excluded_links el where el.tx = s.transaction_code
    )
    and (p_start is null
         or (s.approved_date at time zone 'America/Sao_Paulo')::date >= p_start)
    and (p_end is null
         or (s.approved_date at time zone 'America/Sao_Paulo')::date <= p_end);
$$;

-- 4. Sync Buyers from Sales
create or replace function public.dash_gestao_vendas_sync_buyers_from_sales(
  p_cycle_id uuid
)
returns integer
language sql
security definer
set search_path = public
as $$
  with prods as (
    select cp.product_id as pid, cp.include_offerless as offerless
    from public.dash_gestao_vendas_cycle_products cp
    where cp.cycle_id = p_cycle_id
  ),
  allowed as (
    select co.offer_code as code
    from public.dash_gestao_vendas_cycle_offers co
    where co.cycle_id = p_cycle_id
      and co.included is true
  ),
  sales as (
    select
      lower(btrim(s.buyer_email))      as norm_email,
      nullif(btrim(s.buyer_name), '')  as buyer_name,
      nullif(btrim(s.buyer_phone), '') as buyer_phone,
      s.status,
      s.approved_date,
      s.transaction_code
    from public.dash_gestao_hotmart_sales s
    where s.product_id in (select prods.pid from prods)
      and (
        exists (select 1 from allowed al where al.code = s.offer_code)
        or (
          s.offer_code is null
          and exists (
            select 1 from prods po
            where po.pid = s.product_id and po.offerless is true
          )
        )
      )
      and nullif(btrim(lower(s.buyer_email)), '') is not null
  ),
  agg as (
    select
      norm_email as email,
      (array_agg(buyer_name order by approved_date asc nulls last, transaction_code)
         filter (where buyer_name is not null))[1]  as name,
      (array_agg(buyer_phone order by approved_date asc nulls last, transaction_code)
         filter (where buyer_phone is not null))[1] as phone
    from sales
    group by norm_email
    having bool_or(
      status in ('APPROVED', 'COMPLETE', 'REFUNDED', 'CHARGEBACK', 'CANCELLED', 'EXPIRED')
    )
  ),
  inserted as (
    insert into public.dash_gestao_vendas_buyers (cycle_id, email, name, phone, from_sales)
    select p_cycle_id, a.email, a.name, a.phone, true
    from agg a
    on conflict (cycle_id, email) do nothing
    returning 1
  )
  select count(*)::int from inserted;
$$;

-- 5. Create Cycle
create function public.dash_gestao_vendas_create_cycle(
  p_name           text,
  p_selection      jsonb,
  p_goal_percent   numeric,
  p_purchases_only boolean,
  p_created_by     uuid
)
returns public.dash_gestao_vendas_cycles
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ids      text[];
  v_accounts uuid[];
  v_found    int;
  v_bad      text[];
  v_cycle    public.dash_gestao_vendas_cycles;
begin
  select array_agg(distinct sp.product_id)
    into v_ids
  from public.dash_gestao_vendas_selection_products(p_selection) sp;

  if v_ids is null or array_length(v_ids, 1) is null then
    raise exception 'Selecione ao menos um produto' using errcode = 'UL001';
  end if;

  select array_agg(distinct pr.account_id), count(*)
    into v_accounts, v_found
  from public.dash_gestao_hotmart_products pr
  where pr.product_id = any(v_ids);

  if coalesce(v_found, 0) <> array_length(v_ids, 1) then
    raise exception 'Produto não encontrado' using errcode = 'UL002';
  end if;

  if array_length(v_accounts, 1) <> 1 then
    raise exception 'Todos os produtos devem ser da mesma conta Hotmart' using errcode = 'UL003';
  end if;

  select array_agg(distinct so.offer_code)
    into v_bad
  from public.dash_gestao_vendas_selection_offers(p_selection) so
  where not exists (
    select 1
    from public.dash_gestao_hotmart_offers o
    where o.offer_code = so.offer_code
      and o.product_id = so.product_id
  );

  if v_bad is not null and array_length(v_bad, 1) is not null then
    raise exception 'Oferta inexistente ou de outro produto: %', array_to_string(v_bad, ', ')
      using errcode = 'UL002';
  end if;

  select array_agg(distinct sp.product_id)
    into v_bad
  from public.dash_gestao_vendas_selection_products(p_selection) sp
  where sp.include_offerless is not true
    and not exists (
      select 1
      from public.dash_gestao_vendas_selection_offers(p_selection) so
      where so.product_id = sp.product_id
        and so.included is true
    );

  if v_bad is not null and array_length(v_bad, 1) is not null then
    raise exception 'Selecione ao menos uma oferta para: %', array_to_string(v_bad, ', ')
      using errcode = 'UL006';
  end if;

  insert into public.dash_gestao_vendas_cycles
    (name, account_id, goal_percent, purchases_only, status, created_by)
  values
    (btrim(p_name), v_accounts[1], p_goal_percent, coalesce(p_purchases_only, false), 'ativo', p_created_by)
  returning * into v_cycle;

  insert into public.dash_gestao_vendas_cycle_products (cycle_id, product_id, include_offerless)
  select v_cycle.id, sp.product_id, sp.include_offerless
  from public.dash_gestao_vendas_selection_products(p_selection) sp;

  insert into public.dash_gestao_vendas_cycle_offers
    (cycle_id, product_id, offer_code, included, decided_by)
  select v_cycle.id, so.product_id, so.offer_code, so.included, p_created_by
  from public.dash_gestao_vendas_selection_offers(p_selection) so;

  return v_cycle;
end;
$fn$;

-- 6. Set Cycle Products
create function public.dash_gestao_vendas_set_cycle_products(
  p_cycle_id  uuid,
  p_selection jsonb
)
returns table (
  products_added      int,
  products_removed    int,
  buyers_removed      int,
  buyers_materialized int,
  offers_added        bigint,
  offers_removed      bigint
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ids        text[];
  v_accounts   uuid[];
  v_found      int;
  v_bad        text[];
  v_before     text[];
  v_cycle      public.dash_gestao_vendas_cycles;
  v_added      int    := 0;
  v_removed    int    := 0;
  v_buyers_del int    := 0;
  v_synced     int    := 0;
  v_off_add    bigint := 0;
  v_off_del    bigint := 0;
begin
  select * into v_cycle
  from public.dash_gestao_vendas_cycles c
  where c.id = p_cycle_id;

  if not found then
    raise exception 'Ciclo não encontrado' using errcode = 'UL004';
  end if;

  if v_cycle.status <> 'ativo' then
    raise exception 'Ciclo encerrado não pode ter os produtos alterados' using errcode = 'UL005';
  end if;

  select array_agg(distinct sp.product_id)
    into v_ids
  from public.dash_gestao_vendas_selection_products(p_selection) sp;

  if v_ids is null or array_length(v_ids, 1) is null then
    raise exception 'Selecione ao menos um produto' using errcode = 'UL001';
  end if;

  select array_agg(distinct pr.account_id), count(*)
    into v_accounts, v_found
  from public.dash_gestao_hotmart_products pr
  where pr.product_id = any(v_ids);

  if coalesce(v_found, 0) <> array_length(v_ids, 1) then
    raise exception 'Produto não encontrado' using errcode = 'UL002';
  end if;

  if array_length(v_accounts, 1) <> 1 or v_accounts[1] <> v_cycle.account_id then
    raise exception 'Todos os produtos devem ser da mesma conta Hotmart do ciclo' using errcode = 'UL003';
  end if;

  select array_agg(distinct so.offer_code)
    into v_bad
  from public.dash_gestao_vendas_selection_offers(p_selection) so
  where not exists (
    select 1
    from public.dash_gestao_hotmart_offers o
    where o.offer_code = so.offer_code
      and o.product_id = so.product_id
  );

  if v_bad is not null and array_length(v_bad, 1) is not null then
    raise exception 'Oferta inexistente ou de outro produto: %', array_to_string(v_bad, ', ')
      using errcode = 'UL002';
  end if;

  select array_agg(distinct sp.product_id)
    into v_bad
  from public.dash_gestao_vendas_selection_products(p_selection) sp
  where sp.include_offerless is not true
    and not exists (
      select 1
      from public.dash_gestao_vendas_selection_offers(p_selection) so
      where so.product_id = sp.product_id
        and so.included is true
    );

  if v_bad is not null and array_length(v_bad, 1) is not null then
    raise exception 'Selecione ao menos uma oferta para: %', array_to_string(v_bad, ', ')
      using errcode = 'UL006';
  end if;

  select coalesce(array_agg(co.offer_code), '{}'::text[])
    into v_before
  from public.dash_gestao_vendas_cycle_offers co
  where co.cycle_id = p_cycle_id
    and co.included is true;

  with removed as (
    delete from public.dash_gestao_vendas_cycle_products cp
    where cp.cycle_id = p_cycle_id
      and cp.product_id <> all(v_ids)
    returning 1
  )
  select count(*)::int into v_removed from removed;

  with added as (
    insert into public.dash_gestao_vendas_cycle_products (cycle_id, product_id, include_offerless)
    select p_cycle_id, sp.product_id, sp.include_offerless
    from public.dash_gestao_vendas_selection_products(p_selection) sp
    on conflict (cycle_id, product_id) do nothing
    returning 1
  )
  select count(*)::int into v_added from added;

  update public.dash_gestao_vendas_cycle_products cp
  set include_offerless = sp.include_offerless
  from public.dash_gestao_vendas_selection_products(p_selection) sp
  where cp.cycle_id = p_cycle_id
    and cp.product_id = sp.product_id
    and cp.include_offerless is distinct from sp.include_offerless;

  delete from public.dash_gestao_vendas_cycle_offers co
  where co.cycle_id = p_cycle_id
    and not exists (
      select 1
      from public.dash_gestao_vendas_selection_offers(p_selection) so
      where so.offer_code = co.offer_code
    );

  insert into public.dash_gestao_vendas_cycle_offers
    (cycle_id, product_id, offer_code, included)
  select p_cycle_id, so.product_id, so.offer_code, so.included
  from public.dash_gestao_vendas_selection_offers(p_selection) so
  on conflict (cycle_id, offer_code) do update
    set included   = excluded.included,
        product_id = excluded.product_id;

  with orphans as (
    delete from public.dash_gestao_vendas_buyers b
    where b.cycle_id = p_cycle_id
      and b.from_sales
      and not exists (
        select 1
        from public.dash_gestao_hotmart_sales s
        join public.dash_gestao_vendas_cycle_products cp
          on cp.cycle_id = p_cycle_id
         and cp.product_id = s.product_id
        where lower(btrim(s.buyer_email)) = lower(btrim(b.email))
          and s.status in ('APPROVED', 'COMPLETE', 'REFUNDED', 'CHARGEBACK', 'CANCELLED', 'EXPIRED')
          and (
            exists (
              select 1
              from public.dash_gestao_vendas_cycle_offers co
              where co.cycle_id = p_cycle_id
                and co.offer_code = s.offer_code
                and co.included is true
            )
            or (s.offer_code is null and cp.include_offerless is true)
          )
      )
    returning 1
  )
  select count(*)::int into v_buyers_del from orphans;

  if v_cycle.purchases_only then
    select public.dash_gestao_vendas_sync_buyers_from_sales(p_cycle_id) into v_synced;
  end if;

  update public.dash_gestao_vendas_cycles c
  set updated_at = now()
  where c.id = p_cycle_id;

  select count(*)
    into v_off_add
  from public.dash_gestao_vendas_cycle_offers co
  where co.cycle_id = p_cycle_id
    and co.included is true
    and co.offer_code <> all(v_before);

  select count(*)
    into v_off_del
  from unnest(v_before) as antes(code)
  where not exists (
    select 1
    from public.dash_gestao_vendas_cycle_offers co
    where co.cycle_id = p_cycle_id
      and co.included is true
      and co.offer_code = antes.code
  );

  return query select v_added, v_removed, v_buyers_del, coalesce(v_synced, 0),
                      v_off_add, v_off_del;
end;
$fn$;

-- 7. Offer Options & Offerless Counts
create function public.dash_gestao_vendas_offer_options(p_product_ids text[])
returns table (
  offer_code   text,
  offer_name   text,
  product_id   text,
  product_name text,
  sales_count  bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with prods as (
    select distinct btrim(x) as pid
    from unnest(coalesce(p_product_ids, '{}'::text[])) as x
    where btrim(x) <> ''
  ),
  sales_agg as (
    select s.offer_code as code, count(*)::bigint as total
    from public.dash_gestao_hotmart_sales s
    where s.product_id in (select prods.pid from prods)
      and s.offer_code is not null
    group by s.offer_code
  )
  select
    o.offer_code,
    o.offer_name,
    o.product_id,
    p.product_name,
    coalesce(sa.total, 0) as sales_count
  from public.dash_gestao_hotmart_offers o
  join public.dash_gestao_hotmart_products p on p.product_id = o.product_id
  left join sales_agg sa on sa.code = o.offer_code
  where o.product_id in (select prods.pid from prods)
  order by coalesce(sa.total, 0) desc, p.product_name, o.offer_name;
$$;

create function public.dash_gestao_vendas_offerless_counts(p_product_ids text[])
returns table (
  product_id  text,
  sales_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with prods as (
    select distinct btrim(x) as pid
    from unnest(coalesce(p_product_ids, '{}'::text[])) as x
    where btrim(x) <> ''
  )
  select
    s.product_id,
    count(*)::bigint as sales_count
  from public.dash_gestao_hotmart_sales s
  where s.product_id in (select prods.pid from prods)
    and s.offer_code is null
  group by s.product_id
  order by s.product_id;
$$;

-- 8. Purchases, Roster, Daily, Hourly
create or replace function public.dash_gestao_vendas_purchases(
  p_cycle_id uuid,
  p_start    date default null,
  p_end      date default null
)
returns table (
  buyer_id         uuid,
  name             text,
  email            text,
  phone            text,
  extra            jsonb,
  category         text,
  renewed_at       timestamptz,
  total_value      numeric,
  transaction_code text,
  from_manual_link boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cs.matched_buyer_id                        as buyer_id,
    coalesce(b.name, cs.buyer_name)            as name,
    coalesce(b.email, cs.norm_email)           as email,
    coalesce(b.phone, cs.buyer_phone)          as phone,
    coalesce(b.extra, '{}'::jsonb)             as extra,
    case
      when cs.status in ('APPROVED', 'COMPLETE') then 'renovado'
      else 'renovacao_reembolsada'
    end                                        as category,
    cs.approved_date                           as renewed_at,
    case
      when cs.status in ('APPROVED', 'COMPLETE') then cs.price
      else null
    end                                        as total_value,
    cs.transaction_code                        as transaction_code,
    cs.via_link                                as from_manual_link
  from public.dash_gestao_vendas_cycle_sales(p_cycle_id, p_start, p_end) cs
  left join public.dash_gestao_vendas_buyers b on b.id = cs.matched_buyer_id
  where cs.status in (
    'APPROVED', 'COMPLETE', 'REFUNDED', 'CHARGEBACK', 'CANCELLED', 'EXPIRED'
  );
$$;

create or replace function public.dash_gestao_vendas_roster(
  p_cycle_id uuid,
  p_start    date default null,
  p_end      date default null
)
returns table (
  buyer_id         uuid,
  name             text,
  email            text,
  phone            text,
  extra            jsonb,
  category         text,
  renewed_at       timestamptz,
  total_value      numeric,
  transaction_code text,
  from_manual_link boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with buyers as (
    select
      b.id,
      b.email,
      lower(btrim(b.email)) as norm_email,
      b.name,
      b.phone,
      b.extra
    from public.dash_gestao_vendas_buyers b
    where b.cycle_id = p_cycle_id
      and not exists (
        select 1
        from public.dash_gestao_vendas_excluded_buyers eb
        where eb.cycle_id = p_cycle_id
          and eb.email = lower(btrim(b.email))
      )
  ),
  attributed as (
    select
      cs.transaction_code,
      cs.norm_email,
      cs.buyer_name,
      cs.buyer_phone,
      cs.status,
      cs.approved_date,
      cs.price,
      cs.matched_buyer_id,
      cs.via_link
    from public.dash_gestao_vendas_cycle_sales(p_cycle_id, p_start, p_end) cs
  ),
  base_sales_agg as (
    select
      a.matched_buyer_id as buyer_id,
      bool_or(a.status in ('APPROVED', 'COMPLETE'))                     as has_approved,
      bool_or(a.status in ('REFUNDED', 'CHARGEBACK', 'CANCELLED', 'EXPIRED')) as has_refund,
      min(a.approved_date) filter (where a.status in ('APPROVED', 'COMPLETE')) as renewed_at,
      sum(a.price)         filter (where a.status in ('APPROVED', 'COMPLETE')) as total_value,
      (array_agg(a.transaction_code order by a.approved_date asc nulls last)
         filter (where a.status in ('APPROVED', 'COMPLETE')))[1]        as transaction_code,
      (array_agg(a.via_link order by a.approved_date asc nulls last)
         filter (where a.status in ('APPROVED', 'COMPLETE')))[1]        as from_manual_link
    from attributed a
    where a.matched_buyer_id is not null
    group by a.matched_buyer_id
  ),
  base_roster as (
    select
      b.id       as buyer_id,
      b.name     as name,
      b.email    as email,
      b.phone    as phone,
      b.extra    as extra,
      case
        when coalesce(agg.has_approved, false) then 'renovado'
        when coalesce(agg.has_refund, false)   then 'renovacao_reembolsada'
        else 'nao_renovado'
      end        as category,
      agg.renewed_at,
      agg.total_value,
      agg.transaction_code,
      coalesce(agg.from_manual_link, false) as from_manual_link
    from buyers b
    left join base_sales_agg agg on agg.buyer_id = b.id
  ),
  new_sales_agg as (
    select
      a.norm_email as email,
      bool_or(a.status in ('APPROVED', 'COMPLETE'))                     as has_approved,
      bool_or(a.status in ('REFUNDED', 'CHARGEBACK', 'CANCELLED', 'EXPIRED')) as has_refund,
      min(a.approved_date) filter (where a.status in ('APPROVED', 'COMPLETE')) as renewed_at,
      sum(a.price)         filter (where a.status in ('APPROVED', 'COMPLETE')) as total_value,
      (array_agg(a.transaction_code order by a.approved_date asc nulls last)
         filter (where a.status in ('APPROVED', 'COMPLETE')))[1]        as transaction_code,
      (array_agg(a.buyer_name order by a.approved_date asc nulls last, a.transaction_code)
         filter (where a.buyer_name is not null))[1]                    as name,
      (array_agg(a.buyer_phone order by a.approved_date asc nulls last, a.transaction_code)
         filter (where a.buyer_phone is not null))[1]                   as phone
    from attributed a
    where a.matched_buyer_id is null
      and a.norm_email is not null
      and a.norm_email <> ''
    group by a.norm_email
  ),
  new_roster as (
    select
      null::uuid   as buyer_id,
      nsa.name     as name,
      nsa.email    as email,
      nsa.phone    as phone,
      '{}'::jsonb  as extra,
      case
        when nsa.has_approved then 'novo_comprador'
        else 'novo_reembolsado'
      end          as category,
      nsa.renewed_at,
      nsa.total_value,
      nsa.transaction_code,
      false        as from_manual_link
    from new_sales_agg nsa
    where nsa.has_approved or nsa.has_refund
  )
  select buyer_id, name, email, phone, extra, category, renewed_at, total_value,
         transaction_code, from_manual_link
  from base_roster
  union all
  select buyer_id, name, email, phone, extra, category, renewed_at, total_value,
         transaction_code, from_manual_link
  from new_roster;
$$;

create or replace function public.dash_gestao_vendas_daily(p_cycle_id uuid)
returns table (
  day        date,
  renewals   bigint,
  new_buyers bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cs.approved_day                                        as day,
    count(*) filter (where cs.matched_buyer_id is not null) as renewals,
    count(*) filter (where cs.matched_buyer_id is null)     as new_buyers
  from public.dash_gestao_vendas_cycle_sales(p_cycle_id) cs
  where cs.status in ('APPROVED', 'COMPLETE')
    and cs.approved_date is not null
    and (cs.matched_buyer_id is not null or nullif(cs.norm_email, '') is not null)
  group by cs.approved_day
  order by cs.approved_day;
$$;

create or replace function public.dash_gestao_vendas_hourly(p_cycle_id uuid)
returns table (
  hour       text,
  renewals   bigint,
  new_buyers bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cs.approved_hour                                       as hour,
    count(*) filter (where cs.matched_buyer_id is not null) as renewals,
    count(*) filter (where cs.matched_buyer_id is null)     as new_buyers
  from public.dash_gestao_vendas_cycle_sales(p_cycle_id) cs
  where cs.status in ('APPROVED', 'COMPLETE')
    and cs.approved_date is not null
    and (cs.matched_buyer_id is not null or nullif(cs.norm_email, '') is not null)
  group by cs.approved_hour
  order by cs.approved_hour;
$$;

-- 9. Replace Buyers
create or replace function public.dash_gestao_vendas_replace_buyers(
  p_cycle_id uuid,
  p_rows     jsonb
)
returns table (
  removed  int,
  updated  int,
  inserted int
)
language sql
as $$
  with parsed as (
    select
      lower(btrim(r.value->>'email'))                        as email,
      nullif(btrim(coalesce(r.value->>'name', '')), '')      as name,
      nullif(btrim(coalesce(r.value->>'phone', '')), '')     as phone,
      coalesce(r.value->'extra', '{}'::jsonb)                as extra,
      r.ordinality
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
      with ordinality as r(value, ordinality)
  ),
  new_rows as (
    select distinct on (email) email, name, phone, extra
    from parsed
    where email is not null and email <> ''
    order by email, ordinality desc
  ),
  deleted as (
    delete from public.dash_gestao_vendas_buyers b
    where b.cycle_id = p_cycle_id
      and not exists (
        select 1 from new_rows nr where nr.email = lower(btrim(b.email))
      )
    returning 1
  ),
  updated as (
    update public.dash_gestao_vendas_buyers b
    set name = nr.name, phone = nr.phone, extra = nr.extra
    from new_rows nr
    where b.cycle_id = p_cycle_id
      and lower(btrim(b.email)) = nr.email
    returning 1
  ),
  inserted as (
    insert into public.dash_gestao_vendas_buyers (cycle_id, email, name, phone, extra)
    select p_cycle_id, nr.email, nr.name, nr.phone, nr.extra
    from new_rows nr
    where not exists (
      select 1 from public.dash_gestao_vendas_buyers b
      where b.cycle_id = p_cycle_id
        and lower(btrim(b.email)) = nr.email
    )
    returning 1
  )
  select
    (select count(*)::int from deleted)  as removed,
    (select count(*)::int from updated)  as updated,
    (select count(*)::int from inserted) as inserted;
$$;

-- 10. Grants
revoke execute on function public.dash_gestao_vendas_selection_products(jsonb) from public, anon, authenticated;
revoke execute on function public.dash_gestao_vendas_selection_offers(jsonb) from public, anon, authenticated;

revoke execute on function public.dash_gestao_vendas_create_cycle(text, jsonb, numeric, boolean, uuid) from public, anon, authenticated;
grant  execute on function public.dash_gestao_vendas_create_cycle(text, jsonb, numeric, boolean, uuid) to service_role;

revoke execute on function public.dash_gestao_vendas_set_cycle_products(uuid, jsonb) from public, anon, authenticated;
grant  execute on function public.dash_gestao_vendas_set_cycle_products(uuid, jsonb) to service_role;

revoke execute on function public.dash_gestao_vendas_offer_options(text[]) from public, anon, authenticated;
grant  execute on function public.dash_gestao_vendas_offer_options(text[]) to service_role;

revoke execute on function public.dash_gestao_vendas_offerless_counts(text[]) from public, anon, authenticated;
grant  execute on function public.dash_gestao_vendas_offerless_counts(text[]) to service_role;

revoke execute on function public.dash_gestao_vendas_replace_buyers(uuid, jsonb) from public, anon, authenticated;
grant  execute on function public.dash_gestao_vendas_replace_buyers(uuid, jsonb) to service_role;

revoke execute on function public.dash_gestao_vendas_sync_buyers_from_sales(uuid) from public, anon, authenticated;
grant  execute on function public.dash_gestao_vendas_sync_buyers_from_sales(uuid) to service_role;
