"use client";

import { useEffect, useMemo, useState } from "react";
import type { UserRole } from "@/types/auth";
import type { UltimatesDailyRow, UltimatesHourlyRow, UltimatesRosterRow } from "@/types/ultimates";
import type { CycleWithProducts } from "./types";
import { aggregateRosterKpis } from "@/lib/ultimates/kpi-aggregation";
import { countPurchasesForEmail, derivePurchaseKpis } from "@/lib/ultimates/purchases-mode";
import {
  buildCumulativeSeries,
  buildHourlyCumulativeSeries,
  type UltimatesGranularity,
  type UltimatesSeries,
} from "@/lib/ultimates/cumulative-chart";
import {
  applyNewPurchasesModeToRoster,
  applyNewPurchasesModeToCounts,
} from "@/lib/ultimates/new-purchases-mode";
import { viewRangeFrom, type DateRange } from "@/lib/ultimates/date-range";
import { originSourceFor } from "@/lib/ultimates/origin-source";
import type { OriginBreakdownBlock } from "@/lib/ultimates/origin-breakdown";
import { fmtDateShort, formatCycleProducts } from "@/lib/ultimates/format";
import { DateRangeFilter } from "./date-range-filter";
import { KpiRow } from "./kpi-row";
import { GoalProgressBar } from "./goal-progress-bar";
import { CumulativeChart } from "./cumulative-chart";
import { RosterTable } from "./roster-table";
import { RefreshControls } from "./refresh-controls";
import { SectionHeader } from "./section-header";
import { OriginBreakdownTable } from "./origin-breakdown-table";
import { UploadBuyersModal } from "./upload-buyers-modal";
import { LinkBuyerModal } from "./link-buyer-modal";
import { UnlinkBuyerModal } from "./unlink-buyer-modal";
import { ExcludedOffersModal } from "./excluded-offers-modal";
import { ExcludedBuyersModal } from "./excluded-buyers-modal";
import { ExcludeBuyerModal } from "./exclude-buyer-modal";
import { EditBuyerModal } from "./edit-buyer-modal";
import { MarkRenewedModal } from "./mark-renewed-modal";
import { NewPurchasesToggle } from "./new-purchases-toggle";

// Dashboard do ciclo selecionado (PRD issue #114, seções 3.2–3.4/3.6, task
// #123). UMA chamada ao roster + UMA ao daily + UMA ao hourly (task de
// evolução por hora) alimentam KPIs (agregados no cliente,
// src/lib/ultimates/kpi-aggregation.ts), meta, gráfico acumulado (nas duas
// granularidades) e tabela — nunca fontes separadas, para que os números
// batam entre si (critério 9). As duas primeiras são obrigatórias; a horária
// é opcional (ver `hourly` abaixo). Contrato de props preservado da task #122:
// não renomeie sem avisar quem pegar a #124 (slot "Vincular à base" em
// RosterTable).
export interface UltimatesDashboardProps {
  cycle: CycleWithProducts;
  role: UserRole;
  // Persiste a política do ciclo e devolve se deu certo. Mora no pai porque a
  // fonte de verdade é a lista de ciclos — ver comentário em ultimates-screen.
  onCountsNewBuyersChange: (cycleId: string, value: boolean) => Promise<boolean>;
  // Persiste a janela de visualização do ciclo (migration 063). Mora no pai
  // pela MESMA razão do callback acima: o valor de verdade é a lista de ciclos,
  // e este componente é renderizado sem key — uma cópia local em useState
  // carregaria a janela do ciclo anterior na troca de ciclo.
  onViewRangeChange: (cycleId: string, range: DateRange | null) => Promise<boolean>;
}

// Bloco de pulso do skeleton no tema escuro (o skeleton compartilhado de
// src/components/ui/skeleton.tsx tem cores claras fixas — não serve aqui).
function SkeletonBlock({ height, radius = 11 }: { height: number; radius?: number }) {
  return (
    <div
      style={{
        height,
        background: "var(--surface-2)",
        borderRadius: radius,
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

// Lê a resposta da série horária sem nunca lançar: qualquer coisa fora do
// contrato (rota 500 porque a migration 054 não subiu, corpo sem `hours`, JSON
// inválido) vira `null` = "indisponível", e o card esconde a granularidade em
// vez de oferecer um chip que leva a um gráfico vazio. `[]` é resposta
// legítima — ciclo sem venda ainda — e continua distinta de `null`.
async function lerHourly(res: Response | null): Promise<UltimatesHourlyRow[] | null> {
  if (!res?.ok) return null;
  try {
    const data = await res.json();
    return Array.isArray(data?.hours) ? data.hours : null;
  } catch {
    return null;
  }
}

export function UltimatesDashboard({
  cycle,
  role,
  onCountsNewBuyersChange,
  onViewRangeChange,
}: UltimatesDashboardProps) {
  const [roster, setRoster] = useState<UltimatesRosterRow[] | null>(null);
  const [daily, setDaily] = useState<UltimatesDailyRow[] | null>(null);
  // `null` aqui NÃO é "carregando" como nos dois acima: é "indisponível". A
  // série horária é a mais nova das três e a única cuja RPC (migration 054)
  // pode não existir no banco no momento do deploy — a fila de migrations
  // deste ambiente anda dias atrás. Um 500 dela não pode apagar KPIs, meta,
  // roster, CSV e a curva DIÁRIA, que já funcionam; ela degrada sozinha,
  // escondendo o chip de granularidade (ver `hourlyDisponivel`).
  const [hourly, setHourly] = useState<UltimatesHourlyRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Incrementado ao clicar "Tentar novamente" ou após um refresh bem
  // sucedido — reexecuta o efeito de carga abaixo (mesmo padrão de
  // ultimates-screen.tsx: fetch inline no efeito + flag de cancelamento).
  const [reloadToken, setReloadToken] = useState(0);
  // Fluxos de escrita (task #124) — só montados para gestor em ciclo ativo.
  const [uploadOpen, setUploadOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<UltimatesRosterRow | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<UltimatesRosterRow | null>(null);
  // Ofertas excluídas da contabilidade (PRD 2026-07-30). Só o CONTADOR mora
  // aqui — a lista completa é do modal. Serve para sinalizar que os números
  // exibidos passaram por um filtro; sem isso o dashboard mentiria por omissão
  // para quem não configurou a exclusão.
  const [excludedOpen, setExcludedOpen] = useState(false);
  const [excludedCount, setExcludedCount] = useState(0);
  // Leads excluídos da contabilidade (PRD editar_roster). Mesmo desenho do
  // par acima: só o CONTADOR mora aqui, porque ele alimenta duas sinalizações
  // (o rótulo do botão e o subtítulo do tile "Base") — a lista completa é do
  // modal. A exclusão derruba o denominador do % da meta, então o dashboard
  // não pode exibir o número novo sem dizer que ele foi filtrado.
  const [excludedBuyersOpen, setExcludedBuyersOpen] = useState(false);
  const [excludedBuyersCount, setExcludedBuyersCount] = useState(0);
  // Alvos das três ações da linha do roster.
  const [excludeTarget, setExcludeTarget] = useState<UltimatesRosterRow | null>(null);
  const [editTarget, setEditTarget] = useState<UltimatesRosterRow | null>(null);
  const [markRenewedTarget, setMarkRenewedTarget] = useState<UltimatesRosterRow | null>(null);
  // Série exibida no card "Evolução". Mora aqui (e não dentro do gráfico)
  // para sobreviver à troca de ciclo — ultimates-screen.tsx renderiza este
  // componente sem key, então quem compara a mesma métrica entre ciclos não
  // precisa reclicar o switch a cada troca.
  const [series, setSeries] = useState<UltimatesSeries>("renovacoes");
  // Mesma razão do `series` acima: granularidade é preferência de quem olha e
  // deve sobreviver à troca de ciclo.
  const [granularity, setGranularity] = useState<UltimatesGranularity>("dia");
  // Roster recortado pela janela. Como o `hourly` lá em cima, `null` aqui é
  // INDISPONÍVEL, não "carregando": ele só existe quando há intervalo E a
  // migration 058 já subiu. Sem ele o dashboard inteiro mostra o ciclo.
  const [rosterRange, setRosterRange] = useState<UltimatesRosterRow[] | null>(null);
  // A rota respondeu 501 — recorte pedido, migration pendente. Estado separado
  // porque `rosterRange = null` sozinho não distingue "não pedi" de "pedi e não
  // deu", e só o segundo caso merece aviso na barra.
  const [rangeUnavailable, setRangeUnavailable] = useState(false);
  // Cruzamento das compras com a base de inscritos do evento (seção "Por
  // origem"). Só existe para o punhado de ciclos configurados em
  // origin-source.ts — nos demais nada aqui é usado. `null` é "carregando";
  // a falha tem estado próprio porque a base de inscritos mora fora da fila de
  // migrations e some sem aviso, e nesse caso a seção precisa DIZER, não sumir.
  const [originBlocks, setOriginBlocks] = useState<OriginBreakdownBlock[] | null>(null);
  const [originError, setOriginError] = useState(false);

  // Janela de visualização DO CICLO (migration 063). Derivada da prop, nunca
  // estado: ela é propriedade do ciclo e não preferência de quem olha, então
  // trocar de ciclo tem de trocar a janela junto — o oposto de `series` e
  // `granularity`, que sobrevivem à troca de propósito. Como o dashboard é
  // renderizado sem key, um useState aqui manteria a janela do ciclo anterior
  // aplicada ao ciclo novo, e os números da tela seriam de um recorte que o
  // ciclo exibido não define.
  //
  // useMemo obrigatório, não otimização: viewRangeFrom devolve objeto NOVO a
  // cada chamada, e este valor é dependência do efeito de carga logo abaixo —
  // sem memo, todo re-render refaria o fetch do roster recortado.
  const range = useMemo(
    () => viewRangeFrom(cycle.view_start_date, cycle.view_end_date),
    [cycle.view_start_date, cycle.view_end_date]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Reset dentro da função async (não no corpo síncrono do efeito) —
      // react-hooks/set-state-in-effect rejeita setState direto no corpo do
      // efeito (mesmo ajuste que a task #122 precisou fazer em
      // ultimates-screen.tsx).
      setRoster(null);
      setDaily(null);
      setHourly(null);
      setLoadError(false);
      try {
        const [rosterRes, dailyRes, hourlyRes] = await Promise.all([
          fetch(`/api/ultimates/cycles/${cycle.id}/roster`),
          fetch(`/api/ultimates/cycles/${cycle.id}/daily`),
          // `.catch` só nesta: sem ele uma rejeição (rede fora, rota ainda não
          // publicada) rejeitaria o Promise.all inteiro e levaria roster e
          // daily junto — exatamente o acoplamento que esta carga evita.
          fetch(`/api/ultimates/cycles/${cycle.id}/hourly`).catch(() => null),
        ]);
        // Só roster e daily governam o estado de erro do dashboard.
        if (!rosterRes.ok || !dailyRes.ok) {
          if (!cancelled) setLoadError(true);
          return;
        }
        const rosterData = await rosterRes.json();
        const dailyData = await dailyRes.json();
        const hourlyRows = await lerHourly(hourlyRes);
        if (cancelled) return;
        setRoster(Array.isArray(rosterData?.rows) ? rosterData.rows : []);
        setDaily(Array.isArray(dailyData?.days) ? dailyData.days : []);
        setHourly(hourlyRows);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [cycle.id, reloadToken]);

  // Carga do contador em efeito PRÓPRIO e tolerante a falha: é informação
  // acessória, não pode derrubar o dashboard para o estado de erro nem
  // atrasar KPIs/gráfico/tabela se a rota estiver lenta.
  useEffect(() => {
    let cancelled = false;

    async function loadExcludedCount() {
      try {
        const res = await fetch(`/api/ultimates/cycles/${cycle.id}/excluded-offers`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setExcludedCount(Array.isArray(data?.offers) ? data.offers.length : 0);
      } catch {
        // Silencioso de propósito — ver comentário acima.
      }
    }

    loadExcludedCount();
    return () => {
      cancelled = true;
    };
  }, [cycle.id, reloadToken]);

  // Contador de leads excluídos, em efeito próprio pelo mesmo motivo do de
  // ofertas: informação acessória não derruba o dashboard nem atrasa
  // KPIs/gráfico/tabela.
  useEffect(() => {
    let cancelled = false;

    async function loadExcludedBuyersCount() {
      try {
        const res = await fetch(`/api/ultimates/cycles/${cycle.id}/excluded-buyers`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setExcludedBuyersCount(Array.isArray(data?.buyers) ? data.buyers.length : 0);
      } catch {
        // Silencioso de propósito — ver comentário acima.
      }
    }

    loadExcludedBuyersCount();
    return () => {
      cancelled = true;
    };
  }, [cycle.id, reloadToken]);

  // Carga do roster recortado, em efeito PRÓPRIO e tolerante a falha — mesma
  // razão dos contadores de excluídos: o recorte não pode derrubar o dashboard
  // para o estado de erro nem atrasar KPIs, gráfico e tabela do ciclo, que já
  // funcionam sem ele.
  useEffect(() => {
    let cancelled = false;

    async function loadRange(r: DateRange | null) {
      // Reset dentro da função async, e não no corpo síncrono do efeito —
      // react-hooks/set-state-in-effect rejeita setState direto ali (mesmo
      // contorno da carga de roster/daily acima).
      if (r === null) {
        setRosterRange(null);
        setRangeUnavailable(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/ultimates/cycles/${cycle.id}/roster?start=${r.start}&end=${r.end}`
        );
        if (cancelled) return;
        if (!res.ok) {
          setRosterRange(null);
          // QUALQUER falha marca indisponível, não só o 501 de migration
          // pendente. Quando o intervalo era escolha pessoal, cair calado para
          // o ciclo era aceitável — quem pediu o recorte tinha acabado de
          // clicar e via os números mudarem. Agora o período é institucional:
          // quem abre o ciclo não pediu nada, não sabe qual janela deveria
          // estar valendo, e um fallback silencioso mostraria números MAIORES
          // que o período define sem ninguém perceber.
          setRangeUnavailable(true);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setRosterRange(Array.isArray(data?.rows) ? data.rows : []);
        setRangeUnavailable(false);
      } catch {
        if (cancelled) return;
        setRosterRange(null);
        // Mesma razão do bloco acima: rede fora com período salvo continua
        // sendo "os números na tela não são os do período".
        setRangeUnavailable(true);
      }
    }

    loadRange(range);
    return () => {
      cancelled = true;
    };
  }, [cycle.id, range, reloadToken]);

  function handleRefreshed() {
    setReloadToken((t) => t + 1);
  }

  // `hourly` fora do guarda de propósito: ela é opcional (ver o estado acima),
  // então esperar por ela seria transformar a carga mais frágil em pré-
  // requisito do skeleton sair.
  const loading = roster === null || daily === null;
  const countsNewBuyers = cycle.counts_new_buyers;
  // Modo Apenas Compras (migration 059): a UI ramifica nele. Quando ligado,
  // counts_new_buyers é irrelevante (seu interruptor some) e a tela fala a
  // língua de compras.
  const purchasesOnly = cycle.purchases_only;
  // Reetiquetagem ANTES de tudo: KPIs, gráfico, tabela e CSV consomem estas
  // listas, então nenhum deles precisa conhecer a política do ciclo.
  // useMemo é OBRIGATÓRIO aqui, não otimização: com countsNewBuyers = false o
  // mapeador devolve array NOVO a cada render (ver comentário em
  // new-purchases-mode.ts). Sem memo, essa nova referência se propaga para o
  // `filtered` do RosterTable (useMemo com `rows` na dependência) e dispara o
  // reset de página do DataTable/RosterCards (que comparam identidade de
  // array) em QUALQUER re-render do dashboard — inclusive abrir um modal
  // ("Vincular à base", "Ofertas excluídas", "Carregar base") jogava o
  // usuário de volta para a página 1 atrás do próprio modal.
  const viewRoster = useMemo(
    () => applyNewPurchasesModeToRoster(roster ?? [], countsNewBuyers),
    [roster, countsNewBuyers]
  );
  // Uma métrica só na curva quando o ciclo não admite novas compras OU é Apenas
  // Compras: em compras não há série "novos" — toda venda materializada é base,
  // e qualquer new_buyer residual entra na curva de compras em vez de sumir.
  const seriesCountsNewBuyers = countsNewBuyers && !purchasesOnly;
  const viewDaily = useMemo(
    () => applyNewPurchasesModeToCounts(daily ?? [], seriesCountsNewBuyers),
    [daily, seriesCountsNewBuyers]
  );
  const viewHourly = useMemo(
    () => applyNewPurchasesModeToCounts(hourly ?? [], seriesCountsNewBuyers),
    [hourly, seriesCountsNewBuyers]
  );
  // Mesma reetiquetagem do roster do ciclo, pelo mesmo motivo e com o mesmo
  // useMemo obrigatório (ver o comentário de `viewRoster` acima).
  const viewRosterRange = useMemo(
    () => (rosterRange ? applyNewPurchasesModeToRoster(rosterRange, countsNewBuyers) : null),
    [rosterRange, countsNewBuyers]
  );
  // Recorte EFETIVO: só existe quando o intervalo foi pedido E a janela chegou.
  // Todo o resto do componente lê esta variável, nunca `range` sozinho — assim
  // a degradação do 501 cai de volta para o ciclo em UM lugar só.
  const recorteAtivo = range !== null && viewRosterRange !== null;
  const kpis = roster ? aggregateRosterKpis(viewRoster) : null;
  // KPIs da janela. `aggregateRosterKpis` roda sobre a lista COMPLETA da
  // janela (com os nao_renovado dentro): o KpiRow só lê dela os números de
  // movimento, e base/naoRenovados dela nunca chegam à tela.
  const periodKpis = viewRosterRange ? aggregateRosterKpis(viewRosterRange) : undefined;
  // KPIs de compra (modo Apenas Compras). Derivados sobre o roster EFETIVO —
  // recortado pelo filtro De/Até quando ativo, senão o ciclo inteiro — para
  // baterem com a curva e a tabela. `null` fora do modo (no-op).
  const purchaseKpis = derivePurchaseKpis(
    recorteAtivo ? (viewRosterRange as UltimatesRosterRow[]) : viewRoster,
    purchasesOnly
  );
  // A tabela é a única consumidora que descarta `nao_renovado`: no recorte,
  // essa categoria significa "não teve venda na janela", e listar a base
  // inteira como não renovada esconderia justamente quem movimentou.
  const tableRows = recorteAtivo
    ? (viewRosterRange as UltimatesRosterRow[]).filter((r) => r.category !== "nao_renovado")
    : viewRoster;
  // Série derivada no render, nunca por efeito: assim o `series` escolhido pelo
  // usuário sobrevive intacto e volta sozinho se o ciclo religar novas compras.
  const activeSeries = seriesCountsNewBuyers ? series : "renovacoes";
  // Mesma técnica para a granularidade, pelo mesmo motivo: sem a série horária
  // o card volta para "dia" sem apagar a preferência de quem escolheu "hora" —
  // ela volta sozinha no ciclo (ou no reload) em que a rota responder.
  const hourlyDisponivel = hourly !== null;
  const activeGranularity = hourlyDisponivel ? granularity : "dia";
  // useMemo obrigatório, não otimização: o preenchimento das horas vazias
  // percorre todo o intervalo do ciclo e não pode rodar a cada render.
  // O recorte do gráfico passa por `recorteAtivo`, e não por `range` direto,
  // para que a curva e os tiles nunca discordem: se a janela do roster não
  // veio, os dois mostram o ciclo.
  const chartRange = recorteAtivo ? range : null;
  const chartPoints = useMemo(
    () =>
      activeGranularity === "hora"
        ? buildHourlyCumulativeSeries(viewHourly, activeSeries, chartRange)
        : buildCumulativeSeries(viewDaily, activeSeries, chartRange),
    [activeGranularity, viewHourly, viewDaily, activeSeries, chartRange]
  );
  // Escrita só para gestor e ciclo ativo (critério 11: ciclo encerrado tem
  // dashboard acessível, mas upload/vínculo/atualização bloqueados).
  const canWrite = role === "gestor" && cycle.status !== "encerrado";
  // Excluir/restaurar lead é a ÚNICA escrita do roster que atravessa o
  // encerramento (decisão 13 do PRD editar_roster, mesmo racional das ofertas
  // excluídas): um email de teste descoberto depois do encerramento também
  // suja o histórico. As demais ações seguem `canWrite`.
  const canExcludeBuyers = role === "gestor";
  const baseRows = viewRoster.filter((r) => r.buyer_id !== null);
  // Compras não atribuídas — alimentam o vínculo invertido sem nenhuma chamada
  // nova: são as mesmas linhas que a tabela já mostra como "Novos Compradores"
  // (ou "Renovação sem vínculo", conforme o modo do ciclo).
  const unattributedRows = viewRoster.filter((r) => r.buyer_id === null);

  // Ciclo com cruzamento de origem configurado, ou null (quase todos). A
  // referência é estável — vem de um mapa de módulo —, então serve de
  // dependência de efeito sem memo.
  const originSource = originSourceFor(cycle.id);
  // Emails que a tela está exibindo COMO COMPRA, em chave canônica.
  //
  // É uma string, e não um array, de propósito: `tableRows` é recalculado a
  // cada render e um array novo dispararia o efeito abaixo para sempre. String
  // compara por VALOR na lista de dependências, então o efeito só refaz o
  // cruzamento quando o conjunto de compras realmente muda. O sort torna a
  // chave canônica — reordenar o roster não vale um refetch.
  //
  // Filtrar por `renovado` é o que faz a soma da coluna "Compras" fechar com o
  // tile "Compras" do topo: é a mesma categoria que derivePurchaseKpis conta.
  // Compra reembolsada tem tile próprio e fica de fora dos dois.
  const originEmailsKey = originSource
    ? tableRows
        .filter((r) => r.category === "renovado")
        .map((r) => r.email)
        .sort()
        .join("\n")
    : "";
  // O recorte por data chega DEPOIS do roster do ciclo (efeito separado). Sem
  // esta espera a seção cruzaria primeiro o ciclo inteiro e depois a janela —
  // no ciclo real são 88 compras piscando antes de virarem 19. O resto do
  // dashboard tem a mesma janela de transição, mas ali ela é imperceptível; num
  // número que cai pela metade, não é.
  const aguardandoRecorte = range !== null && rosterRange === null && !rangeUnavailable;

  useEffect(() => {
    if (!originSource || loading || aguardandoRecorte) return;
    let cancelled = false;

    async function load() {
      // Reset dentro da função async, e não no corpo síncrono do efeito —
      // react-hooks/set-state-in-effect rejeita setState direto ali (mesmo
      // contorno das demais cargas deste componente).
      setOriginBlocks(null);
      setOriginError(false);
      try {
        const res = await fetch(`/api/ultimates/cycles/${cycle.id}/origin-breakdown`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            // "" é ciclo sem nenhuma compra no recorte; split("\n") em string
            // vazia devolveria [""], um email fantasma que viraria "não
            // encontrado".
            emails: originEmailsKey === "" ? [] : originEmailsKey.split("\n"),
          }),
        });
        if (cancelled) return;
        if (!res.ok) {
          setOriginError(true);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setOriginBlocks(Array.isArray(data?.blocks) ? data.blocks : []);
      } catch {
        if (!cancelled) setOriginError(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [cycle.id, originSource, originEmailsKey, loading, aguardandoRecorte, reloadToken]);

  function handleWriteDone() {
    setUploadOpen(false);
    setLinkTarget(null);
    setUnlinkTarget(null);
    setExcludeTarget(null);
    setEditTarget(null);
    setMarkRenewedTarget(null);
    setReloadToken((t) => t + 1);
  }

  return (
    <div data-testid="ultimates-dashboard-slot" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="ult-cycle-head">
        <div>
          <h2
            data-testid="ultimates-selected-cycle"
            style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-strong)", margin: 0 }}
          >
            {cycle.name}
          </h2>
          <p
            data-testid="ultimates-cycle-products"
            title={cycle.products.map((p) => p.product_name ?? p.product_id).join(", ")}
            style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 0" }}
          >
            {formatCycleProducts(cycle.products)}
          </p>
        </div>
        <div className="ult-cycle-actions">
          {/* Sem base de renovação no modo Apenas Compras: não há lista para
              carregar (as compras entram sozinhas via materialização). */}
          {canWrite && !purchasesOnly && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setUploadOpen(true)}
              data-testid="ultimates-upload-btn"
            >
              Carregar base
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setExcludedOpen(true)}
            data-testid="ultimates-excluded-offers-btn"
          >
            {excludedCount > 0 ? `Ofertas excluídas (${excludedCount})` : "Ofertas excluídas"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setExcludedBuyersOpen(true)}
            data-testid="ultimates-excluded-buyers-btn"
          >
            {excludedBuyersCount > 0
              ? `Leads excluídos (${excludedBuyersCount})`
              : "Leads excluídos"}
          </button>
          {/* key={cycle.id} remonta só o toggle na troca de ciclo — o `failed`
              interno dele (PATCH que falhou) não deve sobreviver para o ciclo
              seguinte. O dashboard continua sem key (comentário no estado
              `series` acima), então isso não afeta a série do gráfico. */}
          {/* O interruptor classifica vendas contra uma base que não existe no
              modo Apenas Compras — escondido lá. */}
          {!purchasesOnly && (
            <NewPurchasesToggle
              key={cycle.id}
              checked={countsNewBuyers}
              disabled={!canWrite}
              onChange={(value) => onCountsNewBuyersChange(cycle.id, value)}
            />
          )}
          <RefreshControls
            cycleId={cycle.id}
            cycleStatus={cycle.status}
            lastRefreshAt={cycle.last_refresh_at}
            onRefreshed={handleRefreshed}
          />
        </div>
      </div>

      {/* Acima dos blocos de erro/loading de propósito: a barra é o controle
          que produziu o estado atual, e escondê-la enquanto o dashboard
          recarrega deixaria quem acabou de salvar um período sem como
          desfazê-lo.

          `role === "gestor"` e NÃO `canWrite`: definir o período atravessa o
          encerramento do ciclo, como as listas de ofertas e leads excluídos
          (decisões 8 e 13 dos PRDs anteriores). O período é lente de leitura —
          não altera nenhum dado —, e um ciclo encerrado é justamente o que se
          analisa em recorte depois. */}
      <DateRangeFilter
        value={range}
        canEdit={role === "gestor"}
        onSave={(next) => onViewRangeChange(cycle.id, next)}
        unavailable={rangeUnavailable}
      />

      {loadError && (
        <div
          data-testid="ultimates-dashboard-error"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: "56px 24px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 13, color: "var(--red)", margin: 0 }}>
            Não foi possível carregar os dados do ciclo.
          </p>
          <button type="button" onClick={() => setReloadToken((t) => t + 1)} className="btn-secondary">
            Tentar novamente
          </button>
        </div>
      )}

      {!loadError && loading && (
        <div data-testid="ultimates-dashboard-loading" className="z-layout">
          <div className="ult-kpi-grid">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} height={104} />
            ))}
          </div>
          <SkeletonBlock height={252} />
          <SkeletonBlock height={320} />
        </div>
      )}

      {!loadError && !loading && kpis && (
        <div className="z-layout">
          <section>
            <SectionHeader
              index="01"
              title="Visão do ciclo"
              desc={
                purchasesOnly
                  ? "Compras do ciclo"
                  : countsNewBuyers
                    ? "Base, renovações e novos compradores"
                    : "Base, renovações e renovações sem vínculo"
              }
            />
            {/* Mesmo princípio das duas notas abaixo: quando um número
                exibido passou por um filtro, o card diz — senão o dashboard
                mente por omissão para quem só bate o olho nos tiles. Aqui o
                aviso é obrigatório porque o recorte é MISTO: movimento da
                janela ao lado de estoque do ciclo. */}
            {recorteAtivo && range && (
              <p
                data-testid="ultimates-date-note"
                style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 12px" }}
              >
                {purchasesOnly
                  ? `Compras restritas a ${fmtDateShort(range.start)} – ${fmtDateShort(range.end)}`
                  : `Renovações e novos compradores restritos a ${fmtDateShort(range.start)} – ${fmtDateShort(range.end)} · Base e meta seguem o ciclo inteiro`}
              </p>
            )}
            {excludedCount > 0 && (
              <p
                data-testid="ultimates-excluded-offers-note"
                style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 12px" }}
              >
                {excludedCount === 1
                  ? "1 oferta excluída da contabilidade"
                  : `${excludedCount} ofertas excluídas da contabilidade`}
              </p>
            )}
            {!countsNewBuyers && !purchasesOnly && (
              <p
                data-testid="ultimates-new-purchases-note"
                style={{ fontSize: 12, color: "var(--text-3)", margin: "0 0 12px" }}
              >
                Compras de emails fora da base contam como renovação
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <KpiRow
                kpis={kpis}
                periodKpis={recorteAtivo ? periodKpis : undefined}
                countsNewBuyers={countsNewBuyers}
                excludedBuyersCount={excludedBuyersCount}
                purchaseKpis={purchaseKpis}
              />
              {/* Meta é removida no modo Apenas Compras (não substituída): um
                  percentual de uma base inexistente não tem sentido. */}
              {!purchasesOnly && cycle.goal_percent != null && (
                <GoalProgressBar goalPercent={cycle.goal_percent} currentPercent={kpis.renovadosPercent} />
              )}
            </div>
          </section>

          <section>
            <SectionHeader
              index="02"
              title="Evolução"
              desc={`${
                purchasesOnly
                  ? "Compras acumuladas"
                  : countsNewBuyers
                    ? "Renovações e novos compradores"
                    : "Renovações acumuladas"
              }, ${activeGranularity === "hora" ? "hora a hora" : "dia a dia"}`}
            />
            <CumulativeChart
              data={chartPoints}
              series={activeSeries}
              onSeriesChange={setSeries}
              countsNewBuyers={seriesCountsNewBuyers}
              purchasesOnly={purchasesOnly}
              granularity={activeGranularity}
              onGranularityChange={setGranularity}
              granularityAvailable={hourlyDisponivel}
              rangeActive={recorteAtivo}
            />
          </section>

          {/* Só nos ciclos com base de inscritos configurada. Ausência de
              configuração NÃO é erro: nos outros ciclos a seção simplesmente
              não existe, e não há o que avisar.

              Vem ANTES do Roster: a leitura natural é ciclo → evolução → de
              onde vieram as vendas, e só então a lista nominal, que é a seção
              de trabalho e a mais longa da página. */}
          {originSource && (
            <section data-testid="ultimates-origin-section">
              <SectionHeader index="03" title="Por origem" desc={originSource.desc} />
              <OriginBreakdownTable
                blocks={originBlocks}
                loading={originBlocks === null && !originError}
                error={originError}
              />
            </section>
          )}

          <section>
            {/* Índice derivado da presença da seção acima, e não literal: sem
                isso os ciclos sem cruzamento de origem — todos os outros —
                exibiriam 01 → 02 → 04. */}
            <SectionHeader
              index={originSource ? "04" : "03"}
              title="Roster"
              desc={
                purchasesOnly
                  ? "Compras do ciclo, busca e exportação"
                  : "Compradores do ciclo, busca e exportação"
              }
            />
            <RosterTable
              rows={tableRows}
              role={role}
              countsNewBuyers={countsNewBuyers}
              purchasesOnly={purchasesOnly}
              // Sem base: no modo Apenas Compras não há vínculo nem "marcar
              // renovado" — só Editar e Excluir. As demais ações não são
              // passadas, então não aparecem.
              onLinkClick={canWrite && !purchasesOnly ? setLinkTarget : undefined}
              onUnlinkClick={canWrite && !purchasesOnly ? setUnlinkTarget : undefined}
              onMarkRenewedClick={canWrite && !purchasesOnly ? setMarkRenewedTarget : undefined}
              onEditClick={canWrite ? setEditTarget : undefined}
              onExcludeClick={canExcludeBuyers ? setExcludeTarget : undefined}
            />
          </section>
        </div>
      )}

      {/* Diferente dos demais modais, este NÃO é gateado por ciclo ativo:
          a lista de ofertas excluídas continua editável em ciclo encerrado
          (decisão 8 do PRD de 2026-07-30). Só o papel decide quem escreve. */}
      {excludedOpen && (
        <ExcludedOffersModal
          cycleId={cycle.id}
          // O seletor só lista ofertas dos produtos DESTE ciclo. Sem saber quais
          // são, uma busca por um código legítimo de outro produto devolve
          // "nenhuma oferta" e se lê como "essa oferta não existe".
          cycleProducts={cycle.products}
          canWrite={role === "gestor"}
          onChanged={handleRefreshed}
          onClose={() => setExcludedOpen(false)}
        />
      )}

      {/* Como o de ofertas, este NÃO é gateado por ciclo ativo — a lista de
          leads excluídos continua editável em ciclo encerrado (decisão 13 do
          PRD editar_roster). Só o papel decide quem escreve. */}
      {excludedBuyersOpen && (
        <ExcludedBuyersModal
          cycleId={cycle.id}
          canWrite={canExcludeBuyers}
          onChanged={handleRefreshed}
          onClose={() => setExcludedBuyersOpen(false)}
        />
      )}

      {excludeTarget && canExcludeBuyers && (
        <ExcludeBuyerModal
          cycleId={cycle.id}
          targetRow={excludeTarget}
          purchaseCount={countPurchasesForEmail(tableRows, excludeTarget.email)}
          onExcluded={handleWriteDone}
          onCancel={() => setExcludeTarget(null)}
        />
      )}

      {editTarget && canWrite && (
        <EditBuyerModal
          cycleId={cycle.id}
          targetRow={editTarget}
          onSaved={handleWriteDone}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {markRenewedTarget && canWrite && (
        <MarkRenewedModal
          cycleId={cycle.id}
          targetRow={markRenewedTarget}
          unattributedRows={unattributedRows}
          countsNewBuyers={countsNewBuyers}
          onLinked={handleWriteDone}
          onCancel={() => setMarkRenewedTarget(null)}
        />
      )}

      {uploadOpen && canWrite && (
        <UploadBuyersModal
          cycleId={cycle.id}
          onCommitted={handleWriteDone}
          onCancel={() => setUploadOpen(false)}
        />
      )}

      {linkTarget && canWrite && (
        <LinkBuyerModal
          cycleId={cycle.id}
          newBuyerRow={linkTarget}
          baseRows={baseRows}
          onLinked={handleWriteDone}
          onCancel={() => setLinkTarget(null)}
        />
      )}

      {unlinkTarget && canWrite && (
        <UnlinkBuyerModal
          cycleId={cycle.id}
          targetRow={unlinkTarget}
          countsNewBuyers={countsNewBuyers}
          onUnlinked={handleWriteDone}
          onCancel={() => setUnlinkTarget(null)}
        />
      )}
    </div>
  );
}
