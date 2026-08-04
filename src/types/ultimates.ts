// Dash Ultimates: monitoramento de ciclo de renovação (PRD: issue #114).
// Espelham as colunas de supabase/migrations/049_dash_gestao_ultimates.sql.

export type UltimatesCycleStatus = "ativo" | "encerrado";

// Produto acompanhado por um ciclo. Um ciclo tem 1..N — o conjunto vive em
// dash_gestao_ultimates_cycle_products (migration 061), que substituiu a
// coluna escalar cycles.product_id. product_name é null quando o produto
// ainda não foi sincronizado por /api/hotmart/sync-products.
//
// A partir da migration 065 o produto não entra INTEIRO no ciclo: ele carrega
// as ofertas que o ciclo acompanha. Venda de oferta fora de offer_codes não
// conta em lugar nenhum do dashboard.
export interface UltimatesCycleProductRef {
  product_id: string;
  product_name: string | null;
  // Ofertas ESCOLHIDAS (dash_gestao_ultimates_cycle_offers com included=true).
  // Só as vendas destas contam.
  offer_codes: string[];
  // Ofertas que o gestor VIU e recusou (included=false). Não contam — o mesmo
  // efeito de não estar em offer_codes — mas a distinção é o que faz o aviso de
  // oferta nova existir: uma oferta AUSENTE das duas listas nunca foi decidida,
  // e só essa alerta. Sem isso, a cortesia recusada de propósito alertaria para
  // sempre e o aviso viraria ruído que ninguém lê.
  rejected_offer_codes: string[];
  // Decisão sobre venda com offer_code null (existe: mapHotmartSaleItem grava
  // `item.purchase.offer?.code ?? null`). `null` = nunca decidido, e é o estado
  // de todo ciclo anterior à 065.
  include_offerless: boolean | null;
}

// O que a UI envia ao criar/editar um ciclo: o conjunto COMPLETO de produtos
// com suas decisões de oferta, nunca um delta. O diff é feito no banco, como
// já era com productIds na migration 062.
//
// rejected_offer_codes vem do cliente porque só ele sabe o que foi EXIBIDO ao
// gestor — "vista e recusada" é um fato sobre a tela, e o servidor não tem como
// derivá-lo de "não está na lista de escolhidas".
export interface UltimatesCycleProductSelection {
  product_id: string;
  offer_codes: string[];
  rejected_offer_codes: string[];
  include_offerless: boolean | null;
}

export interface UltimatesCycleRecord {
  id: string;
  name: string;
  account_id: string;
  goal_percent: number | null;
  status: UltimatesCycleStatus;
  // Quando false, vendas de emails fora da base deixam de ser "novo comprador"
  // e passam a renovação sem vínculo (migration 053). A reclassificação roda no
  // cliente — ver src/lib/ultimates/new-purchases-mode.ts.
  counts_new_buyers: boolean;
  // Quando true, o ciclo não tem base de renovação: toda venda aprovada do
  // produto é materializada como buyer e o dashboard fala "Compras" em vez de
  // "Renovações" (migration 059, PRD "Apenas Compras"). Definida na criação e
  // IMUTÁVEL depois — trocar o modelo no meio corromperia a contabilidade do
  // ciclo. A ramificação de nomenclatura/KPIs roda no cliente
  // (src/lib/ultimates/purchases-mode.ts).
  purchases_only: boolean;
  // Janela de visualização do ciclo (migration 063): "YYYY-MM-DD" ou null.
  // Definida por gestor e aplicada a TODOS que abrem o ciclo — é propriedade do
  // ciclo, não preferência de quem olha. Null nas duas = produto inteiro, o
  // comportamento de antes da 063. O CHECK do banco garante que ou as duas são
  // nulas ou nenhuma é, então quem lê nunca precisa tratar meia janela — mas
  // viewRangeFrom trata mesmo assim, porque um UPDATE manual no painel pode
  // preceder a constraint.
  //
  // OPCIONAIS de propósito, pela mesma razão de `from_manual_link` no roster: a
  // fila de migrations deste ambiente anda dias atrás do código, e o GET dos
  // ciclos faz `select *`. Sem a 063 aplicada as chaves simplesmente não vêm, e
  // `undefined` = "esse banco não tem janela" — que cai no mesmo lugar de "este
  // ciclo não tem janela". Tipar como obrigatório mentiria sobre a resposta.
  view_start_date?: string | null;
  view_end_date?: string | null;
  refresh_started_at: string | null;
  last_refresh_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UltimatesBuyerRecord {
  id: string;
  cycle_id: string;
  email: string;
  name: string | null;
  phone: string | null;
  extra: Record<string, unknown>;
  created_at: string;
}

export interface UltimatesManualLinkRecord {
  id: string;
  cycle_id: string;
  buyer_id: string;
  transaction_code: string;
  linked_by: string;
  created_at: string;
}

// Lead da base cuja contabilidade foi excluída do ciclo (migration 055). A
// chave é o EMAIL NORMALIZADO, não o buyer_id: é por email que o lado das
// vendas é filtrado (dash_gestao_hotmart_sales só tem buyer_email) e é o que
// faz a exclusão sobreviver ao delete+reinsert de
// dash_gestao_ultimates_replace_buyers, que troca o id de quem sai e volta ao
// CSV.
export interface UltimatesExcludedBuyerRecord {
  id: string;
  cycle_id: string;
  email: string;
  note: string | null;
  excluded_by: string;
  created_at: string;
}

// Categorias de classificação do cruzamento base-de-compradores x vendas
// Hotmart, usadas pelo restante da feature (RPCs, API, UI).
//
// As RPCs só emitem as cinco primeiras. As duas últimas são produzidas no
// cliente por applyNewPurchasesModeToRoster quando o ciclo tem
// counts_new_buyers = false. Os dois pares de linhas com buyer_id = null
// (novo_* e renovacao_sem_vinculo*) NUNCA coexistem: são dois por modo.
export type UltimatesCategory =
  | "renovado"
  | "nao_renovado"
  | "renovacao_reembolsada"
  | "novo_comprador"
  | "novo_reembolsado"
  | "renovacao_sem_vinculo"
  | "renovacao_sem_vinculo_reembolsada";

// Retornos das RPCs de leitura (migration 050). Consumidos pelas próximas
// tasks (APIs) — os nomes espelham as colunas de RETURNS TABLE das funções.

// Uma linha por comprador da base (buyer_id preenchido) OU por novo comprador
// (buyer_id null), vinda de dash_gestao_ultimates_roster.
export interface UltimatesRosterRow {
  buyer_id: string | null;
  // PROCEDÊNCIA DIFERENTE POR TIPO DE LINHA (migration 056, PRD #146):
  // - linha da base (buyer_id preenchido): vem do CSV importado, editável pelo
  //   gestor e sobrescrita pelo próximo upload;
  // - novo comprador (buyer_id null): vem da Hotmart, agregado do primeiro
  //   valor não-nulo entre as vendas daquele email.
  // Não há coalesce entre os dois — de propósito, para a coluna não ter duas
  // origens silenciosas na mesma célula.
  //
  // `phone` do novo comprador só existe para compras recebidas via webhook: a
  // API sales/history não devolve telefone, então esse campo é parcial por
  // natureza e não tem backfill.
  name: string | null;
  email: string;
  phone: string | null;
  extra: Record<string, unknown>;
  category: UltimatesCategory;
  // Menor approved_date entre as vendas aprovadas da pessoa; null se nenhuma.
  renewed_at: string | null;
  // Soma do price das vendas aprovadas; null se nenhuma. PostgREST pode
  // serializar numeric como number ou string — normalize ao consumir.
  total_value: number | null;
  // transaction_code da primeira venda aprovada; null se nenhuma.
  transaction_code: string | null;
  // A renovação exposta em transaction_code veio de vínculo manual? Decide se
  // "Desfazer vínculo" tem o que desfazer (migration 055).
  //
  // OPCIONAL de propósito: a RPC anterior à 055 não devolve o campo, e a fila
  // de migrations deste ambiente anda dias atrás do código. `undefined` = "não
  // sei", e quem consome deve cair no comportamento anterior (oferecer o
  // desfazer em toda renovação, tratando o 404 do DELETE) em vez de esconder
  // uma ação que funciona. Só `false` afirma que não há vínculo.
  from_manual_link?: boolean;
}

// Vendas aprovadas do produto do ciclo por dia (não acumuladas — o acúmulo é
// feito no cliente), vinda de dash_gestao_ultimates_daily. As duas contagens
// saem da mesma agregação (migration 051), então todo dia com venda aparece
// aqui uma única vez, ainda que uma das séries seja 0 nele.
export interface UltimatesDailyRow {
  day: string; // date ISO (YYYY-MM-DD)
  // Vendas de compradores da base (renovações).
  renewals: number;
  // Vendas de emails fora da base e sem vínculo manual.
  new_buyers: number;
}

// Mesma agregação de UltimatesDailyRow, com bucket de hora (migration 054).
// `hour` é "YYYY-MM-DDTHH" em America/Sao_Paulo — texto, não data: a RPC já
// converteu o fuso, e construir um Date a partir daqui reinterpretaria a
// string no fuso de quem renderiza. Só horas COM venda vêm da RPC; o
// preenchimento das vazias é de buildHourlyCumulativeSeries.
export interface UltimatesHourlyRow {
  hour: string;
  renewals: number;
  new_buyers: number;
}

// Contagens devolvidas por dash_gestao_ultimates_set_cycle_products (migration
// 062) quando o conjunto de produtos de um ciclo é trocado. buyers_removed é a
// que importa na tela: são linhas de roster que sumiram porque o produto que as
// materializou saiu do ciclo, e o gestor não teria como contá-las depois.
export interface SetProductsResult {
  products_added: number;
  products_removed: number;
  buyers_removed: number;
  buyers_materialized: number;
  // Migration 065: desmarcar oferta encolhe o universo de vendas exatamente
  // como remover produto, e por isso passa pela MESMA recontagem — buyers_removed
  // conta as linhas materializadas que ficaram sem venda por qualquer um dos
  // dois motivos.
  offers_added: number;
  offers_removed: number;
}

// Uma linha por oferta de um produto, vinda de
// dash_gestao_ultimates_offer_options (reescrita pela migration 065).
//
// Escopada por PRODUTO e não por ciclo desde a 065: a sanfona do form precisa
// da lista ANTES do ciclo existir, na criação. Por isso também não carrega mais
// nenhum campo de estado do ciclo (o antigo is_excluded) — quem cruza opção com
// decisão é o cliente, com as listas de UltimatesCycleProductRef.
//
// sales_count conta vendas em QUALQUER status e sem recorte de data: o número
// serve para o gestor reconhecer a oferta, não para conferir contabilidade — e
// na criação não existe período de ciclo pelo qual recortar.
export interface UltimatesOfferOption {
  offer_code: string;
  offer_name: string;
  // Produto dono da oferta. Com um ciclo multi-produto a lista mistura ofertas
  // de produtos diferentes, e duas ofertas homônimas ficariam indistinguíveis
  // no seletor sem isto.
  product_id: string;
  product_name: string;
  sales_count: number;
}

// Quantas vendas do produto não têm offer_code nenhum. Alimenta a linha fixa
// "(sem oferta)" da sanfona — a venda sem oferta contava por acidente até a
// 065 (a blocklist nunca a pegava) e vira uma decisão explícita do gestor.
// Produto sem nenhuma venda assim NÃO aparece nesta lista.
export interface UltimatesOfferlessOption {
  product_id: string;
  sales_count: number;
}

// Contadores devolvidos por dash_gestao_ultimates_replace_buyers.
export interface UltimatesReplaceResult {
  removed: number;
  updated: number;
  inserted: number;
}
