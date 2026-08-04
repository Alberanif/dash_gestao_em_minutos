-- Dash Ultimates: o ciclo passa a acompanhar OFERTAS, não produtos inteiros.
-- (PRD docs/PRD_2026-08-04_ultimates_ofertas_do_ciclo.md.)
--
-- PROBLEMA: até aqui o recorte por oferta era uma BLOCKLIST
-- (dash_gestao_ultimates_excluded_offers, migration 052): conta tudo, menos o
-- que alguém lembrou de tirar. O default é permissivo, e é aí que ele falha —
-- oferta de cortesia criada depois da montagem do ciclo entra sozinha nos KPIs,
-- sem que ninguém seja avisado. upsertPlaceholderOffers cria oferta a partir da
-- venda, então toda oferta nova nasce contando por construção.
--
-- SOLUÇÃO: inverter o default. O ciclo acompanha um conjunto EXPLÍCITO de
-- ofertas escolhidas por um gestor. Venda de oferta não escolhida não conta.
-- A classificação continua DERIVADA EM LEITURA — nada é apagado nem alterado em
-- dash_gestao_hotmart_sales, e marcar/desmarcar oferta vale já na leitura
-- seguinte, sem refresh nem reprocessamento.
--
-- TRÊS ESTADOS, NÃO DOIS. dash_gestao_ultimates_cycle_offers guarda `included`
-- em vez de guardar só as escolhidas, porque a diferença entre "recusei" e
-- "nunca vi" é a feature inteira:
--   included = true   → oferta escolhida, as vendas dela contam;
--   included = false  → oferta VISTA e recusada; não conta, mas está decidida;
--   ausência de linha → nunca decidida, e é SÓ ISSO que o aviso de "oferta fora
--                       da contabilidade" olha.
-- Sem o `false`, a cortesia recusada de propósito alertaria para sempre e o
-- aviso viraria ruído que ninguém lê — ou seja, a allowlist trocaria um erro
-- visível (número inflado) por um invisível (número subnotificado em silêncio).
--
-- include_offerless É NULLABLE, e o PRD (§5) escreveu `not null default false`.
-- A divergência é deliberada e segue o contrato TypeScript já escrito
-- (src/types/ultimates.ts: `include_offerless: boolean | null`, "`null` = nunca
-- decidido"): pelo mesmo motivo de `included`, "decidi que não" e "nunca
-- decidi" não podem colapsar num `false` só. Um ciclo anterior a esta migration
-- precisa ser distinguível de um ciclo cujo gestor olhou a linha "(sem oferta)"
-- e não a marcou. Consequência: toda comparação com essa coluna usa `is true` /
-- `is not true`, NUNCA `= true` — `null = true` é null, e a linha cairia por
-- acidente em vez de cair por decisão.
--
-- NENHUM BACKFILL DE OFERTAS (decisão 3 da entrevista). Todo ciclo existente
-- acorda com cycle_offers vazia e include_offerless null, isto é, NÃO
-- CONFIGURADO — e o dashboard não mostra número nenhum até um gestor escolher.
-- Este deploy escurece todos os dashboards ativos ao mesmo tempo; é o preço
-- aceito para garantir que nenhuma oferta conte sem alguém ter olhado para ela.
--
-- ORDEM DESTE ARQUIVO IMPORTA, por dois motivos independentes:
--   1. dash_gestao_ultimates_excluded_offers só pode ser dropada DEPOIS que as
--      funções pararem de referenciá-la. Postgres não rastreia dependência de
--      coluna/tabela dentro de corpo de função `language sql` em string — o
--      DROP passaria limpo e a quebra só apareceria em runtime (a armadilha
--      documentada na 061, §"POR QUE 061 E NÃO A 057").
--   2. O arquivo morto é copiado ANTES do drop, senão não há o que copiar.
-- Logo: tabelas → parsers → funções reescritas → drop da blocklist.
--
-- ORDEM DE APLICAÇÃO: exige 061→064 aplicadas.

-- UP

-- ── 1. As ofertas que o ciclo acompanha ─────────────────────────────────────
-- offer_code sozinho na PK, sem product_id, porque
-- dash_gestao_hotmart_offers.offer_code é UNIQUE GLOBAL (migration 037): a
-- mesma oferta não pertence a dois produtos, e uma PK com product_id permitiria
-- duas linhas contraditórias sobre a mesma oferta. É também o que deixa o
-- filtro de leitura casar por offer_code puro, sem precisar do produto.
--
-- FK de offer_code é segura: upsertPlaceholderOffers (src/lib/services/hotmart.ts)
-- grava as ofertas ANTES do upsert das vendas — a FK de
-- dash_gestao_hotmart_sales.offer_code já exige isso. Toda oferta com venda
-- coletada existe do outro lado.
--
-- FK COMPOSTA para cycle_products, e não para cycles: garante que a oferta
-- escolhida pertence a um produto QUE ESTÁ no ciclo, e o cascade tira a oferta
-- junto quando o produto sai. Sem isso, remover produto deixaria oferta órfã
-- apontando para um universo que não existe mais. Como cycle_products já tem
-- `on delete cascade` para cycles, apagar um ciclo continua limpando tudo em
-- dois saltos — o hard delete da feature "excluir ciclo" segue funcionando sem
-- FK direta daqui para cycles.
--
-- decided_by é NULLABLE (e não `not null`, como excluded_by era na 052): a
-- edição do ciclo passa por dash_gestao_ultimates_set_cycle_products, cuja
-- assinatura não carrega o ator. Preferimos registrar "não sei quem" a inventar
-- um autor ou a inflar a assinatura da RPC.
create table dash_gestao_ultimates_cycle_offers (
  cycle_id   uuid        not null,
  product_id text        not null,
  offer_code text        not null references dash_gestao_hotmart_offers(offer_code),
  included   boolean     not null,
  decided_by uuid,
  created_at timestamptz not null default now(),
  primary key (cycle_id, offer_code),
  foreign key (cycle_id, product_id)
    references dash_gestao_ultimates_cycle_products(cycle_id, product_id)
    on delete cascade
);

-- Sem índice extra: todo acesso é por cycle_id ou por (cycle_id, offer_code),
-- ambos cobertos pelo prefixo da PK. Busca reversa ("que ciclos acompanham a
-- oferta X") não existe em lugar nenhum do código. Mesmo raciocínio da 061.

alter table dash_gestao_ultimates_cycle_offers enable row level security;

-- SEM policy de select para authenticated, no mesmo idioma de
-- dash_gestao_ultimates_excluded_offers e _buyers: toda leitura do app passa
-- pelo service_role nas rotas /api/ultimates (com gate de papel). A lista
-- revela quais ofertas de uma conta existem — não é dado para ficar exposto via
-- PostgREST a qualquer usuário autenticado.

-- ── 2. A decisão sobre venda sem offer_code ─────────────────────────────────
-- Venda sem oferta existe: mapHotmartSaleItem grava
-- `item.purchase.offer?.code ?? null`. Sob a blocklist ela sempre contou (não
-- havia oferta a que associá-la, e a 052 diz isso em comentário). Sob allowlist
-- ela não casaria com nada e sumiria sem que nenhuma tela pudesse resgatá-la —
-- por isso vira uma escolha explícita, exibida como a linha fixa "(sem oferta)"
-- na sanfona.
--
-- NULLABLE e SEM DEFAULT de propósito: ver o cabeçalho. Ciclo existente fica
-- null = não decidido = não configurado.
alter table dash_gestao_ultimates_cycle_products
  add column include_offerless boolean;

-- ── 3. Arquivo morto da blocklist ───────────────────────────────────────────
-- Copiado ANTES do drop, e o único motivo de existir é responder "por que essa
-- oferta estava fora" depois que a tabela viva sumir — a reconfiguração é do
-- zero (decisão 3), então nenhuma tela traz selo de "estava excluída".
--
-- `like` sem INCLUDING nenhum: copia colunas e NOT NULL, e NÃO copia PK, FK,
-- índice nem default. É o que queremos — arquivo morto não deve segurar
-- dash_gestao_ultimates_cycles nem dash_gestao_hotmart_offers por FK, senão
-- apagar um ciclo antigo passaria a falhar por causa de uma tabela que ninguém
-- lê. Sem policy de select, pela mesma razão da tabela viva.
create table dash_gestao_ultimates_excluded_offers_archive
  (like dash_gestao_ultimates_excluded_offers);

alter table dash_gestao_ultimates_excluded_offers_archive enable row level security;

-- Colunas nomeadas, e não `select *`: se a forma das duas divergir por qualquer
-- motivo, o erro aparece aqui e não numa coluna deslocada em silêncio.
insert into dash_gestao_ultimates_excluded_offers_archive
  (id, cycle_id, offer_code, note, excluded_by, created_at)
select id, cycle_id, offer_code, note, excluded_by, created_at
from dash_gestao_ultimates_excluded_offers;

-- ── 4. Parsers da seleção ───────────────────────────────────────────────────
-- create_cycle e set_cycle_products recebem a MESMA estrutura
-- (UltimatesCycleProductSelection[] em src/types/ultimates.ts):
--
--   [{"product_id":"123","offer_codes":["A","B"],
--     "rejected_offer_codes":["C"],"include_offerless":true}]
--
-- Normalizar esse jsonb são ~20 linhas de expansão, trim, descarte de vazio e
-- dedup. Escrevê-las duas vezes é exatamente o erro que a migration 064
-- diagnosticou: "a causa é duplicação — alguém corrigiu numa cópia e não na
-- outra". Então existe UM lugar, em dois recortes (produtos e ofertas), e as
-- duas RPCs não podem divergir sobre o que o cliente mandou.
--
-- São funções INTERNAS: sem grant para service_role, porque só são chamadas de
-- dentro das RPCs security definer (que rodam como o owner e já têm execute por
-- propriedade). Sem grant, o PostgREST também não as expõe como endpoint.
--
-- jsonb_typeof guarda cada expansão: `jsonb_array_elements` levanta erro em
-- entrada que não é array, e um payload torto deve virar "Selecione ao menos um
-- produto" (UL001) no chamador, não um 22023 ilegível.

-- Um produto por linha. include_offerless agregado com bool_or, que ignora
-- nulls e só devolve null quando TODAS as ocorrências são null — exatamente a
-- semântica de três estados que a coluna precisa. (O agrupamento também
-- absorve, sem erro, um cliente que repetiu o mesmo produto no array.)
create function public.dash_gestao_ultimates_selection_products(p_selection jsonb)
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

-- Uma OFERTA por linha, já com a decisão. offer_codes vira included=true,
-- rejected_offer_codes vira included=false, e o group by por offer_code garante
-- uma linha só por oferta (a PK de cycle_offers exige isso).
--
-- bool_or no desempate = a marcação vence a recusa se o cliente mandar a mesma
-- oferta nas duas listas. É input incoerente de qualquer jeito; escolhemos
-- honrar o clique positivo em vez de derrubar o save com um 23505 que o gestor
-- não teria como interpretar.
--
-- min(pid) é seguro porque offer_code é unique global: a validação de coerência
-- nas RPCs recusa a seleção antes daqui se a mesma oferta aparecer sob dois
-- produtos, então o grupo nunca tem dois pid diferentes.
--
-- O `lateral` aqui NÃO é o cross join proibido pela 061: aquele multiplicava
-- VENDA por produto; este expande o array da PRÓPRIA linha, que é a forma
-- canônica de ler jsonb e não multiplica nada além dos elementos dela.
create function public.dash_gestao_ultimates_selection_offers(p_selection jsonb)
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

-- ── 5. A inversão, no único ponto de leitura ────────────────────────────────
-- A migration 064 centralizou o universo de vendas: roster, daily, hourly e
-- purchases CONSOMEM dash_gestao_ultimates_cycle_sales e não escrevem mais
-- filtro de venda nenhum. Por isso a inversão acontece aqui e em mais NENHUMA
-- das quatro — elas não são tocadas por este arquivo.
--
-- Assinatura e RETURNS TABLE inalterados, então CREATE OR REPLACE basta e os
-- grants sobrevivem (só o DROP os derrubaria — foi o que obrigou a 051 a
-- reaplicá-los). A ÚNICA diferença sobre o corpo da 064 é a troca do CTE
-- `excluded_offers` + `not exists` pelo CTE `allowed` + `exists`, e o
-- include_offerless carregado dentro de `prods`.
--
-- PRECEDÊNCIA preservada da 052/064: o filtro entra ANTES de qualquer
-- atribuição a comprador, então a allowlist vence o vínculo manual. Vínculo
-- apontando para venda de oferta não escolhida sobrevive na tabela sem efeito, e
-- volta a valer se a oferta for marcada.
--
-- CUIDADO: RETURNS TABLE põe os nomes de saída em escopo. Toda referência de
-- coluna aqui dentro é qualificada (s., cp., al., po., ...) porque um `status`,
-- um `offer_code` ou um `product_id` solto vira erro de ambiguidade — a
-- armadilha documentada na migration 061.
create or replace function public.dash_gestao_ultimates_cycle_sales(
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
    from public.dash_gestao_ultimates_cycle_products cp
    where cp.cycle_id = p_cycle_id
  ),
  allowed as (
    select co.offer_code as code
    from public.dash_gestao_ultimates_cycle_offers co
    where co.cycle_id = p_cycle_id
      and co.included is true
  ),
  excluded_emails as (
    select eb.email as email
    from public.dash_gestao_ultimates_excluded_buyers eb
    where eb.cycle_id = p_cycle_id
  ),
  excluded_links as (
    select ml.transaction_code as tx
    from public.dash_gestao_ultimates_manual_links ml
    join public.dash_gestao_ultimates_buyers b on b.id = ml.buyer_id
    where ml.cycle_id = p_cycle_id
      and exists (
        select 1 from excluded_emails ee where ee.email = lower(btrim(b.email))
      )
  ),
  cycle_buyers as (
    select b.id as bid, lower(btrim(b.email)) as bemail
    from public.dash_gestao_ultimates_buyers b
    where b.cycle_id = p_cycle_id
      and not exists (
        select 1 from excluded_emails ee where ee.email = lower(btrim(b.email))
      )
  ),
  links as (
    select ml.transaction_code as tx, ml.buyer_id as bid
    from public.dash_gestao_ultimates_manual_links ml
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
    -- A INVERSÃO. Antes: `not exists (excluded_offers)`. Uma venda entra no
    -- universo só quando a oferta dela foi ESCOLHIDA, ou quando ela não tem
    -- oferta e o produto declarou que vendas assim contam.
    --
    -- `po.offerless is true` e não `= true`: a coluna é nullable, `null = true`
    -- é null, e a venda sem oferta de um ciclo não configurado cairia por
    -- acidente em vez de cair por decisão. Aqui as duas leituras dão o mesmo
    -- resultado, mas a forma correta é a que continua correta quando alguém
    -- inverter a condição.
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

-- ── 6. A inversão na materialização do modo Apenas Compras ──────────────────
-- Esta é a única função de leitura de vendas que NÃO passa por cycle_sales: ela
-- tem CTE próprio porque roda numa transação de escrita e agrega por email, não
-- por venda. Por isso a inversão precisa ser repetida aqui — e por isso ela é
-- literalmente a mesma condição, palavra por palavra. Se as duas divergirem, o
-- roster materializado passa a ter gente que os KPIs não contam.
--
-- Corpo idêntico ao da 062 (mesmo ON CONFLICT DO NOTHING, mesmo from_sales); a
-- ÚNICA diferença é o CTE `excluded` virar `allowed` e a condição no WHERE.
-- Assinatura inalterada → CREATE OR REPLACE, grants preservados.
create or replace function public.dash_gestao_ultimates_sync_buyers_from_sales(
  p_cycle_id uuid
)
returns integer
language sql
security definer
set search_path = public
as $$
  with prods as (
    select cp.product_id as pid, cp.include_offerless as offerless
    from public.dash_gestao_ultimates_cycle_products cp
    where cp.cycle_id = p_cycle_id
  ),
  allowed as (
    select co.offer_code as code
    from public.dash_gestao_ultimates_cycle_offers co
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
    insert into public.dash_gestao_ultimates_buyers (cycle_id, email, name, phone, from_sales)
    select p_cycle_id, a.email, a.name, a.phone, true
    from agg a
    on conflict (cycle_id, email) do nothing
    returning 1
  )
  select count(*)::int from inserted;
$$;

-- ── 7. Criação do ciclo com as ofertas junto ────────────────────────────────
-- p_product_ids text[] vira p_selection jsonb. A ASSINATURA MUDA, então isto é
-- DROP + CREATE e não CREATE OR REPLACE — e o DROP DERRUBA OS GRANTS, que são
-- reaplicados no fim do arquivo. (Um `create or replace` com o tipo novo não
-- substituiria nada: criaria uma SEGUNDA sobrecarga, e toda chamada passaria a
-- ser ambígua. É o modo de falha que a 061 documenta sobre a 057.)
--
-- Produtos e ofertas entram na MESMA transação da criação do ciclo pela razão
-- de sempre: se a segunda escrita falhasse, sobraria um ciclo que carrega
-- normalmente com tudo zerado — sintoma silencioso, não erro.
--
-- INVARIANTE NOVA (UL006): todo produto precisa de ≥1 oferta escolhida OU
-- include_offerless = true. Validada aqui e não só no form, mesmo padrão da
-- checagem de conta única: a regra de negócio é do banco, não de uma tela que
-- uma rota futura poderia contornar. Marcar apenas "(sem oferta)" SATISFAZ a
-- regra — o que ela protege é a escolha humana explícita, e marcar "(sem
-- oferta)" é uma (PRD §3.2).
drop function if exists public.dash_gestao_ultimates_create_cycle(text, text[], numeric, boolean, uuid);

create function public.dash_gestao_ultimates_create_cycle(
  p_name           text,
  p_selection      jsonb,
  p_goal_percent   numeric,
  p_purchases_only boolean,
  p_created_by     uuid
)
returns public.dash_gestao_ultimates_cycles
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ids      text[];
  v_accounts uuid[];
  v_found    int;
  v_bad      text[];
  v_cycle    public.dash_gestao_ultimates_cycles;
begin
  -- O parser já deduplica, faz btrim e descarta vazio. O btrim importa pelo
  -- mesmo motivo da 061: um id com espaço de borda passaria pelo filtro e
  -- morreria depois na comparação exata do lookup, virando "Produto não
  -- encontrado" para um produto que existe.
  select array_agg(distinct sp.product_id)
    into v_ids
  from public.dash_gestao_ultimates_selection_products(p_selection) sp;

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

  -- COERÊNCIA OFERTA↔PRODUTO. A FK de offer_code garante que a oferta existe e
  -- a FK composta garante que o produto está no ciclo, mas NENHUMA das duas
  -- garante que a oferta é DAQUELE produto — e uma oferta arquivada sob o
  -- produto errado faz o cascade tirá-la junto com o produto errado.
  -- Reusa UL002 (400, "referência inválida no payload") de propósito, em vez de
  -- criar um código que o mapa de HTTP da rota não conhece e devolveria 500.
  select array_agg(distinct so.offer_code)
    into v_bad
  from public.dash_gestao_ultimates_selection_offers(p_selection) so
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

  -- `sp.include_offerless is not true` cobre false E null numa condição só:
  -- nenhum dos dois é uma escolha que configure o produto.
  select array_agg(distinct sp.product_id)
    into v_bad
  from public.dash_gestao_ultimates_selection_products(p_selection) sp
  where sp.include_offerless is not true
    and not exists (
      select 1
      from public.dash_gestao_ultimates_selection_offers(p_selection) so
      where so.product_id = sp.product_id
        and so.included is true
    );

  if v_bad is not null and array_length(v_bad, 1) is not null then
    raise exception 'Selecione ao menos uma oferta para: %', array_to_string(v_bad, ', ')
      using errcode = 'UL006';
  end if;

  insert into public.dash_gestao_ultimates_cycles
    (name, account_id, goal_percent, purchases_only, status, created_by)
  values
    (btrim(p_name), v_accounts[1], p_goal_percent, coalesce(p_purchases_only, false), 'ativo', p_created_by)
  returning * into v_cycle;

  insert into public.dash_gestao_ultimates_cycle_products (cycle_id, product_id, include_offerless)
  select v_cycle.id, sp.product_id, sp.include_offerless
  from public.dash_gestao_ultimates_selection_products(p_selection) sp;

  -- Depois dos produtos, sempre: a FK composta exige a linha de cycle_products
  -- já gravada.
  insert into public.dash_gestao_ultimates_cycle_offers
    (cycle_id, product_id, offer_code, included, decided_by)
  select v_cycle.id, so.product_id, so.offer_code, so.included, p_created_by
  from public.dash_gestao_ultimates_selection_offers(p_selection) so;

  return v_cycle;
end;
$fn$;

-- ── 8. Edição: produtos E ofertas, com a mesma recontagem ───────────────────
-- Também DROP + CREATE: p_product_ids text[] vira p_selection jsonb E o
-- RETURNS TABLE ganha offers_added/offers_removed. Grants reaplicados no fim.
--
-- Continua recebendo o conjunto FINAL, nunca um delta — agora de duas coisas ao
-- mesmo tempo. Delta exigiria que cliente e servidor concordassem sobre o
-- estado anterior, e uma edição concorrente aplicaria a diferença sobre um
-- conjunto que o gestor nunca viu.
--
-- POR QUE DESMARCAR OFERTA PASSA PELA RECONTAGEM DA 062: em ciclo Apenas
-- Compras o roster é MATERIALIZADO a partir das vendas, e a sync é aditiva por
-- contrato (ON CONFLICT DO NOTHING, nunca apaga) para que correção manual do
-- gestor sobreviva a todo refresh. Desmarcar uma oferta encolhe o universo de
-- vendas EXATAMENTE como remover um produto: quem só comprou por ela fica sem
-- venda contável e viraria linha fantasma contando nos KPIs. Por isso a limpeza
-- de órfãos passou a perguntar pelo universo novo (produto E oferta), e não só
-- pelos produtos que sobraram.
--
-- ORDEM DAS ESCRITAS IMPORTA, e agora por dois motivos: a junção de produtos
-- precisa refletir o conjunto novo antes das ofertas (FK composta), e as DUAS
-- precisam refletir o conjunto novo antes da limpeza de compradores — que
-- pergunta "ainda existe venda contável?" ao estado gravado.
drop function if exists public.dash_gestao_ultimates_set_cycle_products(uuid, text[]);

create function public.dash_gestao_ultimates_set_cycle_products(
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
  v_cycle      public.dash_gestao_ultimates_cycles;
  v_added      int    := 0;
  v_removed    int    := 0;
  v_buyers_del int    := 0;
  v_synced     int    := 0;
  v_off_add    bigint := 0;
  v_off_del    bigint := 0;
begin
  select * into v_cycle
  from public.dash_gestao_ultimates_cycles c
  where c.id = p_cycle_id;

  if not found then
    raise exception 'Ciclo não encontrado' using errcode = 'UL004';
  end if;

  -- Ciclo encerrado é histórico. Trocar produto OU oferta reescreve TODOS os
  -- números do ciclo de uma vez — na tela isso é a mensagem "reative o ciclo
  -- para alterar as ofertas".
  if v_cycle.status <> 'ativo' then
    raise exception 'Ciclo encerrado não pode ter os produtos alterados' using errcode = 'UL005';
  end if;

  select array_agg(distinct sp.product_id)
    into v_ids
  from public.dash_gestao_ultimates_selection_products(p_selection) sp;

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

  -- Conta única, travada na conta DO CICLO: o refresh busca credenciais uma vez
  -- só, pelo account_id do ciclo, e deixar o conjunto migrar faria toda busca de
  -- venda ir na conta errada e voltar vazia, sem erro nenhum.
  if array_length(v_accounts, 1) <> 1 or v_accounts[1] <> v_cycle.account_id then
    raise exception 'Todos os produtos devem ser da mesma conta Hotmart do ciclo' using errcode = 'UL003';
  end if;

  select array_agg(distinct so.offer_code)
    into v_bad
  from public.dash_gestao_ultimates_selection_offers(p_selection) so
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
  from public.dash_gestao_ultimates_selection_products(p_selection) sp
  where sp.include_offerless is not true
    and not exists (
      select 1
      from public.dash_gestao_ultimates_selection_offers(p_selection) so
      where so.product_id = sp.product_id
        and so.included is true
    );

  if v_bad is not null and array_length(v_bad, 1) is not null then
    raise exception 'Selecione ao menos uma oferta para: %', array_to_string(v_bad, ', ')
      using errcode = 'UL006';
  end if;

  -- ── Foto do universo ANTES de qualquer escrita ────────────────────────────
  -- offers_added/offers_removed são medidos contra o conjunto CONTÁVEL
  -- (included = true), não contra as linhas da tabela: marcar uma oferta como
  -- recusada não é "adicionar oferta" para quem lê o resultado na tela, é
  -- registrar uma decisão. Tirar a foto aqui também captura, sem código extra,
  -- as ofertas que o cascade vai levar junto com um produto removido — elas
  -- saíram da contabilidade tanto quanto as desmarcadas à mão.
  select coalesce(array_agg(co.offer_code), '{}'::text[])
    into v_before
  from public.dash_gestao_ultimates_cycle_offers co
  where co.cycle_id = p_cycle_id
    and co.included is true;

  -- ── Diff dos produtos ─────────────────────────────────────────────────────
  -- O delete leva junto, por cascade da FK composta, as ofertas do produto que
  -- saiu.
  with removed as (
    delete from public.dash_gestao_ultimates_cycle_products cp
    where cp.cycle_id = p_cycle_id
      and cp.product_id <> all(v_ids)
    returning 1
  )
  select count(*)::int into v_removed from removed;

  with added as (
    insert into public.dash_gestao_ultimates_cycle_products (cycle_id, product_id, include_offerless)
    select p_cycle_id, sp.product_id, sp.include_offerless
    from public.dash_gestao_ultimates_selection_products(p_selection) sp
    on conflict (cycle_id, product_id) do nothing
    returning 1
  )
  select count(*)::int into v_added from added;

  -- DO NOTHING acima não atualiza produto que já estava no ciclo, e é justamente
  -- nele que a decisão sobre "(sem oferta)" costuma mudar (é o caso da
  -- reconfiguração de todo ciclo anterior à 065, que chega com null). Daí o
  -- update separado — com `is distinct from` para não escrever linha à toa nem
  -- confundir null com false.
  update public.dash_gestao_ultimates_cycle_products cp
  set include_offerless = sp.include_offerless
  from public.dash_gestao_ultimates_selection_products(p_selection) sp
  where cp.cycle_id = p_cycle_id
    and cp.product_id = sp.product_id
    and cp.include_offerless is distinct from sp.include_offerless;

  -- ── Diff das ofertas ──────────────────────────────────────────────────────
  -- Some da tabela o que saiu da seleção INTEIRA (escolhidas + recusadas): uma
  -- oferta que o cliente não mandou em nenhuma das duas listas volta a ser "não
  -- decidida", e é isso que faz o aviso de oferta nova voltar a apontá-la.
  delete from public.dash_gestao_ultimates_cycle_offers co
  where co.cycle_id = p_cycle_id
    and not exists (
      select 1
      from public.dash_gestao_ultimates_selection_offers(p_selection) so
      where so.offer_code = co.offer_code
    );

  -- decided_by NÃO entra no update: quem decidiu primeiro continua registrado.
  -- Na inserção ele fica null porque esta RPC não recebe o ator (ver comentário
  -- da tabela).
  insert into public.dash_gestao_ultimates_cycle_offers
    (cycle_id, product_id, offer_code, included)
  select p_cycle_id, so.product_id, so.offer_code, so.included
  from public.dash_gestao_ultimates_selection_offers(p_selection) so
  on conflict (cycle_id, offer_code) do update
    set included   = excluded.included,
        product_id = excluded.product_id;

  -- ── Limpeza dos compradores que ficaram sem venda ─────────────────────────
  -- Só linhas materializadas (from_sales), e só as que não têm mais NENHUMA
  -- venda contável. As duas condições são necessárias: sem a primeira
  -- apagaríamos gente que o gestor cadastrou; sem a segunda apagaríamos quem
  -- comprou por outro produto ou por outra oferta ainda marcada.
  --
  -- O universo aqui é o MESMO de sync_buyers_from_sales (produto do ciclo,
  -- oferta escolhida ou "(sem oferta)" decidido, email não vazio, ao menos um
  -- status contável) de propósito: é o que faz marcar e desmarcar serem
  -- operações inversas. Se divergirem, um ciclo de desmarcar-e-remarcar não
  -- volta ao estado original.
  --
  -- manual_links tem ON DELETE CASCADE em buyer_id, então o vínculo manual de um
  -- comprador apagado vai junto — ele apontava para uma linha que não existe
  -- mais.
  with orphans as (
    delete from public.dash_gestao_ultimates_buyers b
    where b.cycle_id = p_cycle_id
      and b.from_sales
      and not exists (
        select 1
        from public.dash_gestao_hotmart_sales s
        join public.dash_gestao_ultimates_cycle_products cp
          on cp.cycle_id = p_cycle_id
         and cp.product_id = s.product_id
        where lower(btrim(s.buyer_email)) = lower(btrim(b.email))
          and s.status in ('APPROVED', 'COMPLETE', 'REFUNDED', 'CHARGEBACK', 'CANCELLED', 'EXPIRED')
          and (
            exists (
              select 1
              from public.dash_gestao_ultimates_cycle_offers co
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

  -- ── Materialização do que entrou ─────────────────────────────────────────
  -- Só em Apenas Compras: ciclo de renovação tem base própria, e materializar
  -- ali inventaria linhas de roster que o gestor nunca subiu. Roda a partir das
  -- vendas JÁ COLETADAS, sem tocar na Hotmart — o refresh é o caminho mais
  -- frágil do módulo e amarrar a edição a ele faria salvar demorar um minuto ou
  -- falhar. Marcar uma oferta nova materializa os compradores dela aqui.
  if v_cycle.purchases_only then
    select public.dash_gestao_ultimates_sync_buyers_from_sales(p_cycle_id) into v_synced;
  end if;

  update public.dash_gestao_ultimates_cycles c
  set updated_at = now()
  where c.id = p_cycle_id;

  select count(*)
    into v_off_add
  from public.dash_gestao_ultimates_cycle_offers co
  where co.cycle_id = p_cycle_id
    and co.included is true
    and co.offer_code <> all(v_before);

  select count(*)
    into v_off_del
  from unnest(v_before) as antes(code)
  where not exists (
    select 1
    from public.dash_gestao_ultimates_cycle_offers co
    where co.cycle_id = p_cycle_id
      and co.included is true
      and co.offer_code = antes.code
  );

  return query select v_added, v_removed, v_buyers_del, coalesce(v_synced, 0),
                      v_off_add, v_off_del;
end;
$fn$;

-- ── 9. Opções de oferta, escopadas por PRODUTO ──────────────────────────────
-- p_cycle_id uuid vira p_product_ids text[]: a sanfona do form precisa da lista
-- na CRIAÇÃO, quando ainda não existe ciclo para escopar. DROP + CREATE por
-- duas razões somadas (assinatura e RETURNS TABLE), grants reaplicados no fim.
--
-- is_excluded SAI do retorno. Não é só que a coluna mudou de nome: escopada por
-- produto, esta função não conhece ciclo nenhum e portanto não tem como
-- responder nada sobre decisão. Quem cruza OPÇÃO com DECISÃO é o cliente, com
-- offer_codes/rejected_offer_codes de UltimatesCycleProductRef — e é esse mesmo
-- cruzamento que produz o aviso de "oferta fora da contabilidade".
--
-- Lista TODAS as ofertas do produto, inclusive is_active = false e inclusive as
-- com ZERO venda: oferta nova precisa ser marcável antes de vender, e oferta
-- desativada precisa ser reconhecível. sales_count conta vendas em qualquer
-- status e sem recorte de data — o número serve para o gestor reconhecer a
-- oferta, não para conferir contabilidade, e na criação não existe período de
-- ciclo pelo qual recortar.
--
-- Ordenação preservada da 061 (vendas desc, produto, oferta): com N produtos na
-- mesma lista, duas ofertas homônimas ("Oferta padrão") ficariam embaralhadas
-- entre si sem o product_name no meio.
drop function if exists public.dash_gestao_ultimates_offer_options(uuid);

create function public.dash_gestao_ultimates_offer_options(p_product_ids text[])
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

-- ── 10. Quantas vendas não têm oferta nenhuma ───────────────────────────────
-- Alimenta a linha fixa "(sem oferta)" da sanfona. Função separada, e não uma
-- linha sintética dentro de offer_options, porque ela NÃO É UMA OFERTA: não tem
-- offer_code, não tem offer_name e não pode entrar em cycle_offers. Enfiá-la no
-- mesmo retorno obrigaria offer_code a virar nullable e todo consumidor a tratar
-- um caso especial que o tipo não anuncia.
--
-- Produto sem nenhuma venda assim simplesmente NÃO APARECE — é o group by que
-- garante isso, e é o que faz a sanfona só exibir a linha onde ela significa
-- alguma coisa.
create function public.dash_gestao_ultimates_offerless_counts(p_product_ids text[])
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

-- ── 11. Morte da blocklist ──────────────────────────────────────────────────
-- SÓ AQUI, depois que cycle_sales, sync_buyers_from_sales e set_cycle_products
-- pararam de referenciá-la. Postgres não reclamaria se a ordem fosse outra —
-- corpo de função `language sql` em string não gera dependência rastreada — e é
-- exatamente por isso que a ordem é responsabilidade deste arquivo: a quebra
-- apareceria só em runtime, no primeiro dashboard aberto depois do deploy.
--
-- O índice idx_ultimates_excluded_offers_cycle_id cai junto e não é recriado em
-- lugar nenhum: o arquivo morto é consultado por SQL manual, sob demanda.
drop table if exists dash_gestao_ultimates_excluded_offers;

-- ── Grants ──────────────────────────────────────────────────────────────────
-- cycle_sales e sync_buyers_from_sales foram CREATE OR REPLACE e preservam os
-- grants — só o DROP os derrubaria. As outras QUATRO foram dropadas ou são
-- novas, e sem as linhas abaixo ficariam executáveis apenas pelo owner: a rota
-- chama com a service key e receberia "permission denied for function". A
-- migration 051 existiu inteira porque alguém esqueceu isto.
--
-- Mesma política de todo o módulo: só service_role. create_cycle e
-- set_cycle_products APAGAM comprador; offer_options e offerless_counts leem
-- vendas de uma conta inteira. Nada disso pode ficar exposto via PostgREST a
-- qualquer usuário autenticado.
--
-- Os dois parsers de seleção NÃO recebem grant de propósito: são chamados de
-- dentro das RPCs security definer, que rodam como o owner. Sem grant eles
-- também não viram endpoint do PostgREST.
revoke execute on function public.dash_gestao_ultimates_selection_products(jsonb) from public, anon, authenticated;
revoke execute on function public.dash_gestao_ultimates_selection_offers(jsonb) from public, anon, authenticated;

revoke execute on function public.dash_gestao_ultimates_create_cycle(text, jsonb, numeric, boolean, uuid) from public, anon, authenticated;
grant  execute on function public.dash_gestao_ultimates_create_cycle(text, jsonb, numeric, boolean, uuid) to service_role;

revoke execute on function public.dash_gestao_ultimates_set_cycle_products(uuid, jsonb) from public, anon, authenticated;
grant  execute on function public.dash_gestao_ultimates_set_cycle_products(uuid, jsonb) to service_role;

revoke execute on function public.dash_gestao_ultimates_offer_options(text[]) from public, anon, authenticated;
grant  execute on function public.dash_gestao_ultimates_offer_options(text[]) to service_role;

revoke execute on function public.dash_gestao_ultimates_offerless_counts(text[]) from public, anon, authenticated;
grant  execute on function public.dash_gestao_ultimates_offerless_counts(text[]) to service_role;

-- DOWN
-- ATENÇÃO: rollback COM PERDA, e em dois sentidos diferentes.
--
-- (a) A blocklist volta VAZIA se o passo 1 não for rodado — as linhas vivas só
--     existem no arquivo morto depois desta migration.
-- (b) A allowlist não tem representação no modelo antigo: as escolhas de oferta
--     de todo ciclo reconfigurado são DESCARTADAS, e os ciclos voltam ao default
--     permissivo (conta tudo, menos o que estiver na blocklist restaurada).
--     Reaplicar a 065 depois exige reconfigurar tudo de novo.
--
-- 1. create table dash_gestao_ultimates_excluded_offers (...);  -- corpo da 052,
--    com FKs, unique, índice e RLS; depois:
--    insert into dash_gestao_ultimates_excluded_offers
--      select id, cycle_id, offer_code, note, excluded_by, created_at
--      from dash_gestao_ultimates_excluded_offers_archive;
-- 2. drop function if exists public.dash_gestao_ultimates_offerless_counts(text[]);
-- 3. drop function if exists public.dash_gestao_ultimates_offer_options(text[]);
--    e reaplicar offer_options(uuid) da migration 061 (drop + create: o tipo de
--    retorno volta a ter is_excluded), com os grants.
-- 4. drop function if exists public.dash_gestao_ultimates_set_cycle_products(uuid, jsonb);
--    drop function if exists public.dash_gestao_ultimates_create_cycle(text, jsonb, numeric, boolean, uuid);
--    e reaplicar as versões text[] das migrations 062 e 061, com os grants.
-- 5. Reaplicar dash_gestao_ultimates_cycle_sales da migration 064 e
--    dash_gestao_ultimates_sync_buyers_from_sales da migration 062 (os corpos
--    com o CTE de excluded_offers). Só DEPOIS do passo 1, senão as duas
--    referenciam tabela inexistente.
-- 6. drop function if exists public.dash_gestao_ultimates_selection_offers(jsonb);
--    drop function if exists public.dash_gestao_ultimates_selection_products(jsonb);
-- 7. alter table dash_gestao_ultimates_cycle_products drop column include_offerless;
-- 8. drop table if exists dash_gestao_ultimates_cycle_offers;
-- 9. drop table if exists dash_gestao_ultimates_excluded_offers_archive;  -- opcional:
--    manter o arquivo morto não custa nada e ainda responde perguntas antigas.
