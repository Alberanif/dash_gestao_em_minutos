-- Dash Ultimates: o conjunto de produtos de um ciclo passa a ser editável.
--
-- A migration 061 deixou o conjunto definido na CRIAÇÃO e imutável depois. Este
-- arquivo abre a edição — e o problema não é trocar linhas numa tabela de
-- junção, é o rastro que um produto deixa quando sai.
--
-- O QUE FICA PARA TRÁS AO REMOVER UM PRODUTO
--
-- Vínculos manuais e ofertas excluídas do produto removido ficam INERTES de
-- propósito: as RPCs de leitura só olham as vendas dos produtos do ciclo, então
-- uma exclusão de oferta de produto que saiu não filtra nada. Ninguém apaga
-- essas linhas — readicionar o produto devolve a configuração do gestor
-- inteira, com a nota que ele escreveu. Apagá-las seria destruir trabalho para
-- resolver um problema que não existe.
--
-- Compradores materializados são outra história. Em ciclo Apenas Compras
-- (migration 059) o roster é preenchido por dash_gestao_ultimates_sync_buyers_-
-- from_sales, que é ADITIVA por contrato (ON CONFLICT DO NOTHING, nunca apaga)
-- para que correção manual do gestor sobreviva a todo refresh. Isso significa
-- que remover um produto NÃO remove quem ele materializou: sobrariam linhas de
-- roster sem venda nenhuma, contando nos KPIs, e sem nada no schema dizendo de
-- onde vieram.
--
-- POR QUE UM BOOLEANO E NÃO source_product_id
--
-- Gravar "qual produto materializou a linha" parece mais informativo e está
-- ERRADO. O INSERT é por EMAIL, não por venda: quem compra em dois produtos do
-- ciclo vira UMA linha, e o produto gravado seria só o primeiro que a sync viu.
-- Remover esse produto apagaria um comprador que ainda tem compra no outro —
-- silenciosamente, que é a classe de erro que este módulo mais evita.
--
-- A pergunta que a coluna precisa responder é "esta linha é do gestor ou da
-- máquina?", e essa é binária. "Ainda tem venda?" é pergunta de RUNTIME,
-- respondida recontando as vendas dos produtos que sobraram. As duas juntas dão
-- a regra certa: apaga se É materializada E não tem mais venda contável.
--
-- from_sales espelha o nome de from_manual_link, que o roster já devolve pela
-- mesma razão (distinguir o que a máquina fez do que o gestor fez).

-- UP

-- ── 1. Procedência da linha de roster ───────────────────────────────────────
-- default false = "do gestor". É o default correto: dos dois únicos caminhos de
-- INSERT nesta tabela, dash_gestao_ultimates_replace_buyers (migration 050, o
-- upload da base) não menciona a coluna e portanto grava false, que é
-- exatamente o que ele é.
alter table dash_gestao_ultimates_buyers
  add column from_sales boolean not null default false;

-- Backfill determinístico, sem inferência: em ciclo Apenas Compras não existe
-- upload de base (a UI nem oferece o botão), então TODA linha veio da
-- materialização. Em ciclo de renovação a sync nunca roda, então toda linha
-- veio do upload — e o default false já a descreve.
update dash_gestao_ultimates_buyers b
set from_sales = true
from dash_gestao_ultimates_cycles c
where c.id = b.cycle_id
  and c.purchases_only;

-- ── 2. A sync passa a carimbar o que cria ───────────────────────────────────
-- Corpo idêntico ao da 061 — mesma CTE prods, mesmo universo, mesmo ON CONFLICT
-- DO NOTHING. A ÚNICA diferença é a coluna from_sales no INSERT.
--
-- O ON CONFLICT continua DO NOTHING e isso importa aqui: uma linha que já
-- existe como do gestor NÃO é reclassificada como materializada por um refresh.
-- Quem o gestor cadastrou continua sendo dele, e nunca será apagado por remoção
-- de produto.
create or replace function public.dash_gestao_ultimates_sync_buyers_from_sales(
  p_cycle_id uuid
)
returns integer
language sql
security definer
set search_path = public
as $$
  with prods as (
    select cp.product_id
    from public.dash_gestao_ultimates_cycle_products cp
    where cp.cycle_id = p_cycle_id
  ),
  excluded as (
    select eo.offer_code
    from public.dash_gestao_ultimates_excluded_offers eo
    where eo.cycle_id = p_cycle_id
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
    where s.product_id in (select prods.product_id from prods)
      and not exists (
        select 1 from excluded ex where ex.offer_code = s.offer_code
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

-- ── 3. Troca atômica do conjunto de produtos ────────────────────────────────
-- Recebe o conjunto FINAL, não um delta: o cliente manda o que quer que o ciclo
-- passe a ter, e o diff acontece aqui. Delta exigiria que cliente e servidor
-- concordassem sobre o estado anterior, e uma edição concorrente aplicaria a
-- diferença sobre um conjunto que o gestor nunca viu.
--
-- Tudo numa transação, pela mesma razão de dash_gestao_ultimates_create_cycle:
-- são quatro escritas (remove produtos, adiciona produtos, apaga compradores
-- órfãos, materializa os novos) e parar no meio deixaria o ciclo num estado que
-- ninguém pediu — sem erro, só número errado no dashboard.
--
-- ORDEM DAS ESCRITAS IMPORTA: a junção precisa já refletir o conjunto NOVO
-- antes da limpeza de compradores, porque a limpeza pergunta "ainda existe
-- venda nos produtos do ciclo?" e essa pergunta é feita à junção.
create or replace function public.dash_gestao_ultimates_set_cycle_products(
  p_cycle_id    uuid,
  p_product_ids text[]
)
returns table (
  products_added      int,
  products_removed    int,
  buyers_removed      int,
  buyers_materialized int
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_ids        text[];
  v_accounts   uuid[];
  v_found      int;
  v_cycle      public.dash_gestao_ultimates_cycles;
  v_added      int := 0;
  v_removed    int := 0;
  v_buyers_del int := 0;
  v_synced     int := 0;
begin
  select * into v_cycle
  from public.dash_gestao_ultimates_cycles c
  where c.id = p_cycle_id;

  if not found then
    raise exception 'Ciclo não encontrado' using errcode = 'UL004';
  end if;

  -- Ciclo encerrado é histórico. Trocar o produto reescreve TODOS os números do
  -- ciclo de uma vez — outra classe de escrita que excluir uma oferta de teste,
  -- que segue liberada em ciclo encerrado de propósito.
  if v_cycle.status <> 'ativo' then
    raise exception 'Ciclo encerrado não pode ter os produtos alterados' using errcode = 'UL005';
  end if;

  -- Deduplica e descarta vazios, com btrim DENTRO do array_agg — mesma razão
  -- de create_cycle: um id com espaço de borda passaria pelo filtro e morreria
  -- depois na comparação exata, virando "Produto não encontrado" para um
  -- produto que existe.
  select array_agg(distinct btrim(x))
    into v_ids
  from unnest(coalesce(p_product_ids, '{}'::text[])) as x
  where btrim(x) <> '';

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

  -- Conta única, e travada na conta DO CICLO — não basta o conjunto novo ser
  -- coerente consigo mesmo. O refresh busca credenciais uma vez só, pelo
  -- account_id do ciclo; deixar o conjunto migrar para outra conta faria toda
  -- busca de venda ir na conta errada e voltar vazia, sem erro nenhum. Trocar
  -- de conta é criar outro ciclo.
  if array_length(v_accounts, 1) <> 1 or v_accounts[1] <> v_cycle.account_id then
    raise exception 'Todos os produtos devem ser da mesma conta Hotmart do ciclo' using errcode = 'UL003';
  end if;

  -- ── Diff da junção ────────────────────────────────────────────────────────
  with removed as (
    delete from public.dash_gestao_ultimates_cycle_products cp
    where cp.cycle_id = p_cycle_id
      and cp.product_id <> all(v_ids)
    returning 1
  )
  select count(*)::int into v_removed from removed;

  with added as (
    insert into public.dash_gestao_ultimates_cycle_products (cycle_id, product_id)
    select p_cycle_id, x from unnest(v_ids) as x
    on conflict (cycle_id, product_id) do nothing
    returning 1
  )
  select count(*)::int into v_added from added;

  -- ── Limpeza dos compradores que o produto removido deixou ────────────────
  -- Só linhas materializadas (from_sales), e só as que não têm mais NENHUMA
  -- venda contável nos produtos que sobraram. As duas condições são
  -- necessárias: sem a primeira apagaríamos gente que o gestor cadastrou; sem a
  -- segunda apagaríamos quem comprou em dois produtos do ciclo e continua
  -- valendo pelo outro.
  --
  -- O universo aqui é o MESMO da sync (produto do ciclo, oferta não excluída,
  -- email não vazio, ao menos um status contável) de propósito: é o que faz
  -- adicionar e remover serem operações inversas. Se divergirem, um ciclo de
  -- remover-e-readicionar não volta ao estado original.
  --
  -- dash_gestao_ultimates_manual_links tem ON DELETE CASCADE em buyer_id, então
  -- o vínculo manual de um comprador apagado vai junto — que é o correto: ele
  -- apontava para uma linha que não existe mais.
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
          and not exists (
            select 1
            from public.dash_gestao_ultimates_excluded_offers eo
            where eo.cycle_id = p_cycle_id
              and eo.offer_code = s.offer_code
          )
      )
    returning 1
  )
  select count(*)::int into v_buyers_del from orphans;

  -- ── Materialização dos produtos que entraram ─────────────────────────────
  -- Só em Apenas Compras: ciclo de renovação tem base própria, e materializar
  -- ali inventaria linhas de roster que o gestor nunca subiu.
  --
  -- Roda a partir das vendas JÁ COLETADAS, sem tocar na Hotmart. O refresh é o
  -- caminho mais frágil do módulo (lock, deadline de 45s) e nunca foi validado
  -- neste ambiente; amarrar a edição de um ciclo a ele faria salvar um produto
  -- poder demorar um minuto ou falhar. O que ainda não foi coletado entra no
  -- próximo "Atualizar agora".
  if v_cycle.purchases_only then
    select public.dash_gestao_ultimates_sync_buyers_from_sales(p_cycle_id) into v_synced;
  end if;

  update public.dash_gestao_ultimates_cycles c
  set updated_at = now()
  where c.id = p_cycle_id;

  return query select v_added, v_removed, v_buyers_del, coalesce(v_synced, 0);
end;
$fn$;

-- ── Grants ──────────────────────────────────────────────────────────────────
-- sync_buyers_from_sales preserva os grants (CREATE OR REPLACE não os derruba).
-- set_cycle_products é nova. Mesma política do módulo: só service_role — ela
-- apaga compradores, e liberar authenticated deixaria qualquer usuário logado
-- destruir roster via PostgREST.
revoke execute on function public.dash_gestao_ultimates_set_cycle_products(uuid, text[]) from public, anon, authenticated;
grant  execute on function public.dash_gestao_ultimates_set_cycle_products(uuid, text[]) to service_role;

-- DOWN
-- 1. drop function if exists public.dash_gestao_ultimates_set_cycle_products(uuid, text[]);
-- 2. Reaplicar dash_gestao_ultimates_sync_buyers_from_sales da migration 061
--    (o INSERT sem a coluna from_sales).
-- 3. alter table dash_gestao_ultimates_buyers drop column from_sales;
--
-- Sem perda de dado de comprador: a coluna só classifica linhas que já existiam.
-- O que NÃO volta é o que a edição já apagou — compradores materializados
-- removidos junto com um produto não são recuperáveis por rollback; eles voltam
-- pela materialização se o produto for readicionado e a venda ainda existir.
