// Lógica pura da UI de Visualizações (PRD #185, fatia 3): agrupamento por
// pasta, seleção inicial, soma de séries e leitura do estado de backfill.
// Nada aqui toca React nem fetch — o que dá para decidir sem DOM mora aqui.
import type {
  VendasFolderRecord,
  VendasViewBackfillStatus,
  VendasViewDailyRow,
  VendasViewHourlyRow,
  VendasViewOfferRow,
  VendasViewRecord,
} from "@/types/vendas";
import type { UltimatesDailyRow, UltimatesHourlyRow } from "@/types/vendas";
import {
  buildCumulativeSeries,
  buildHourlyCumulativeSeries,
  type CumulativePoint,
} from "./cumulative-chart";
import { fmtDateFull } from "./format";

// ── Agrupamento por pasta ───────────────────────────────────────────────────

// Mesmo formato de CycleGroup (a chave `cycles` é mantida de propósito: o
// FolderSection é compartilhado com o modelo antigo e lê esse nome).
export interface ViewGroup {
  id: string;
  name: string;
  isUnfolder: boolean;
  folder?: VendasFolderRecord;
  cycles: VendasViewRecord[];
  isExpanded: boolean;
}

function byCreatedDesc(a: VendasViewRecord, b: VendasViewRecord): number {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

/** Visualização aberta por padrão: a mais recente por `created_at` (RF-1). */
export function selectInitialViewId(views: VendasViewRecord[]): string | null {
  if (views.length === 0) return null;
  return [...views].sort(byCreatedDesc)[0].id;
}

/**
 * Pastas A-Z, "Sem pasta" por último; visualizações por created_at desc.
 * Só o grupo que contém a selecionada começa expandido.
 */
export function groupViewsByFolder(
  views: VendasViewRecord[] = [],
  folders: VendasFolderRecord[] = [],
  selectedViewId: string | null = null
): ViewGroup[] {
  const valid = new Set(folders.map((f) => f.id));
  const byFolder = new Map<string, VendasViewRecord[]>();
  const loose: VendasViewRecord[] = [];

  for (const view of [...views].sort(byCreatedDesc)) {
    if (view.folder_id && valid.has(view.folder_id)) {
      const list = byFolder.get(view.folder_id) ?? [];
      list.push(view);
      byFolder.set(view.folder_id, list);
    } else {
      loose.push(view);
    }
  }

  const groups: ViewGroup[] = [...folders]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    .map((folder) => ({
      id: folder.id,
      name: folder.name,
      isUnfolder: false,
      folder,
      cycles: byFolder.get(folder.id) ?? [],
      isExpanded: false,
    }));

  if (loose.length > 0 || groups.length === 0) {
    groups.push({ id: "unfoldered", name: "Sem pasta", isUnfolder: true, cycles: loose, isExpanded: false });
  }

  const expandedId =
    groups.find((g) => selectedViewId && g.cycles.some((v) => v.id === selectedViewId))?.id ??
    groups.find((g) => g.cycles.length > 0)?.id ??
    groups[0]?.id ??
    null;

  return groups.map((g) => ({ ...g, isExpanded: g.id === expandedId }));
}

// ── Somas ───────────────────────────────────────────────────────────────────

function safe(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

export function sumSales(rows: { sales: number }[]): number {
  return rows.reduce((acc, r) => acc + safe(r.sales), 0);
}

export function sumRefunded(rows: VendasViewOfferRow[]): number {
  return rows.reduce((acc, r) => acc + safe(r.refunded), 0);
}

/**
 * Invariante do PRD: KPI = soma do gráfico por dia = soma da quebra por oferta.
 * Devolve `null` quando as três fontes concordam (ou quando alguma não
 * chegou, caso em que não há o que comparar) e os três totais quando divergem.
 */
export function totalsMismatch(
  kpiSales: number,
  daily: VendasViewDailyRow[] | null,
  offers: VendasViewOfferRow[] | null
): { kpi: number; daily: number; offers: number } | null {
  if (!daily || !offers) return null;
  const d = sumSales(daily);
  const o = sumSales(offers);
  if (kpiSales === d && kpiSales === o) return null;
  return { kpi: kpiSales, daily: d, offers: o };
}

// ── Acumulado (reaproveita as séries do cumulative-chart) ───────────────────

export function buildViewDailyCumulative(rows: VendasViewDailyRow[]): CumulativePoint[] {
  const adapted: UltimatesDailyRow[] = rows.map((r) => ({ day: r.day, renewals: r.sales, new_buyers: 0 }));
  return buildCumulativeSeries(adapted, "renovacoes", null);
}

export function buildViewHourlyCumulative(rows: VendasViewHourlyRow[]): CumulativePoint[] {
  const adapted: UltimatesHourlyRow[] = rows.map((r) => ({ hour: r.hour, renewals: r.sales, new_buyers: 0 }));
  return buildHourlyCumulativeSeries(adapted, "renovacoes", null);
}

// ── Backfill ────────────────────────────────────────────────────────────────

export interface BackfillNotice {
  status: VendasViewBackfillStatus;
  /** O número exibido NÃO é o histórico completo. */
  incomplete: boolean;
  message: string;
  canRetry: boolean;
}

/**
 * Nunca apresenta histórico parcial como completo: tudo que não é `done`
 * marca o número como incompleto. `partial` informa a data a partir da qual o
 * histórico é completo (backfill_from).
 */
export function describeBackfill(view: Pick<VendasViewRecord, "backfill_status" | "backfill_from">): BackfillNotice {
  switch (view.backfill_status) {
    case "done":
      return { status: "done", incomplete: false, message: "Histórico completo.", canRetry: false };
    case "partial":
      return {
        status: "partial",
        incomplete: true,
        message: view.backfill_from
          ? `Histórico parcial: os dados são completos a partir de ${fmtDateFull(view.backfill_from)}. Vendas anteriores a essa data podem não estar contadas.`
          : "Histórico parcial: a coleta atingiu o limite de tempo e vendas antigas podem não estar contadas.",
        canRetry: false,
      };
    case "failed":
      return {
        status: "failed",
        incomplete: true,
        message: "Não foi possível coletar o histórico. Os números abaixo estão incompletos.",
        canRetry: true,
      };
    case "running":
    case "pending":
    default:
      return {
        status: view.backfill_status === "running" ? "running" : "pending",
        incomplete: true,
        message: "Coletando histórico…",
        canRetry: false,
      };
  }
}

/** Rótulo curto que acompanha o KPI enquanto o histórico não está completo. */
export function incompleteBadge(notice: BackfillNotice): string | null {
  if (!notice.incomplete) return null;
  if (notice.status === "partial") return "Histórico parcial";
  if (notice.status === "failed") return "Coleta falhou";
  return "Coletando histórico…";
}

// ── Ofertas (validação do modal) ────────────────────────────────────────────

/** Normaliza um código digitado: trim; vazio → null. */
export function normalizeOfferCode(raw: string): string | null {
  const t = raw.trim();
  return t === "" ? null : t;
}
