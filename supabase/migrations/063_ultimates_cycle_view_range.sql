-- Dash Ultimates: janela de visualização do ciclo.
--
-- PROBLEMA: o filtro De/Até nasceu (spec 2026-07-31) como preferência de quem
-- olha — estado do componente, persistido em localStorage sob UMA chave global.
-- Duas consequências que o uso real expôs: dois usuários abrindo o mesmo ciclo
-- viam números diferentes sem nenhuma indicação disso, e a chave, por ser
-- única e não por ciclo, carregava o intervalo de um ciclo para dentro de
-- outro.
--
-- SOLUÇÃO: o intervalo passa a ser propriedade do CICLO, definida por gestor.
-- Todo mundo que abre o ciclo vê a mesma janela; ciclo sem janela definida
-- mostra o produto inteiro, exatamente como antes.
--
-- NENHUMA RPC MUDA. dash_gestao_ultimates_roster já recebe (p_cycle_id,
-- p_start, p_end) desde a 058 (reescrita pela 061 para multi-produto), e o
-- recorte do gráfico é feito no cliente. Esta migration só dá ao ciclo onde
-- guardar as duas datas que a API já sabe repassar.
--
-- `date`, e não timestamptz, porque é o tipo dos parâmetros da RPC, que por sua
-- vez casa com o `approved_date::date` do bucket de dash_gestao_ultimates_daily
-- (migration 051). Manter o mesmo tipo em toda a cadeia é o que faz o número do
-- tile bater com o topo da curva — um timestamptz aqui reintroduziria fuso numa
-- fronteira que hoje é puramente de calendário.
--
-- AS DUAS COLUNAS SÃO UM VALOR SÓ, e o CHECK é quem diz isso. Meio intervalo não
-- é "sem limite de um lado": seria um recorte que ninguém pediu, e a API recusa
-- meia ponta com 400 pela mesma razão. Deixar a regra só na aplicação
-- permitiria que um UPDATE manual no painel do Supabase criasse uma linha que o
-- código não sabe ler.
--
-- COMPATIBILIDADE: colunas nullable sem default, então todo ciclo existente
-- nasce sem janela — o comportamento atual, linha por linha. Nenhum backfill.
--
-- ORDEM DE APLICAÇÃO: independente das demais. Só depende da 049 (tabela).

-- UP

alter table public.dash_gestao_ultimates_cycles
  add column if not exists view_start_date date,
  add column if not exists view_end_date   date;

alter table public.dash_gestao_ultimates_cycles
  drop constraint if exists chk_ultimates_cycle_view_range;

alter table public.dash_gestao_ultimates_cycles
  add constraint chk_ultimates_cycle_view_range check (
    (view_start_date is null) = (view_end_date is null)
    and (view_start_date is null or view_end_date >= view_start_date)
  );

comment on column public.dash_gestao_ultimates_cycles.view_start_date is
  'Início da janela de visualização do ciclo (inclusivo). Null = ciclo inteiro. Definida por gestor; vale para todos os usuários.';

comment on column public.dash_gestao_ultimates_cycles.view_end_date is
  'Fim da janela de visualização do ciclo (inclusivo). Null = ciclo inteiro. Sempre nula ou não-nula junto de view_start_date (chk_ultimates_cycle_view_range).';

-- DOWN
-- alter table public.dash_gestao_ultimates_cycles
--   drop constraint if exists chk_ultimates_cycle_view_range;
-- alter table public.dash_gestao_ultimates_cycles
--   drop column if exists view_start_date,
--   drop column if exists view_end_date;
