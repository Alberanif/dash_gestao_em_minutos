"use client";

import { useMemo, useState } from "react";
import type { VendasViewRecord } from "@/types/vendas";
import type { UserRole } from "@/types/auth";
import type { DateRange } from "@/lib/vendas/date-range";
import { interpretRefreshResponse } from "@/lib/vendas/refresh";
import { describeBackfill, incompleteBadge, totalsMismatch } from "@/lib/vendas/views";
import { Button, Selo, Surface } from "../ui";
import { cx, foco } from "../ui/cx";
import { ControleDeAtualizacao } from "./controle-de-atualizacao";
import { FiltroDePeriodo } from "./filtro-de-periodo";
import { useDadosDaVisualizacao } from "./use-dados-da-visualizacao";

interface DashboardProps {
  view: VendasViewRecord;
  productName: string;
  role: UserRole;
  // Grava o período na visualização (só quem edita chega a chamar). Devolve se deu certo.
  onRangeChange: (range: DateRange | null) => Promise<boolean>;
  // Pede à tela que releia a visualização (estado da coleta, last_refresh_at).
  onViewChanged: () => void;
}

// Inteiros sem símbolo: o Intl pt-BR não põe NBSP aqui (só em moeda), então o
// número quebra normalmente no celular (PR #162).
const fmtInt = (n: number) => Intl.NumberFormat("pt-BR").format(n);

export function DashboardDaVisualizacao({ view, productName, role, onRangeChange, onViewChanged }: DashboardProps) {
  const canEdit = role === "gestor" || role === "analista";
  const { range, dados, erro, atualizando, recarregar } = useDadosDaVisualizacao(view);

  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [tentando, setTentando] = useState(false);
  const [erroDaTentativa, setErroDaTentativa] = useState<string | null>(null);

  const aviso = describeBackfill(view);
  const selo = incompleteBadge(aviso);
  const divergencia = useMemo(
    () => (dados ? totalsMismatch(dados.kpis.sales, dados.daily, dados.offers) : null),
    [dados],
  );

  async function tentarDeNovo() {
    setTentando(true);
    setErroDaTentativa(null);
    try {
      const res = await fetch(`/api/vendas/views/${view.id}/refresh`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      const resultado = interpretRefreshResponse(res.status, body);
      if (resultado.kind !== "success") setErroDaTentativa(resultado.message);
    } catch {
      setErroDaTentativa("Erro de conexão ao tentar novamente.");
    } finally {
      setTentando(false);
      onViewChanged();
    }
  }

  const ofertas = view.offer_codes.length;

  return (
    <div data-testid="view-dashboard" className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 data-testid="view-selected-name" className="text-xl font-bold text-v2-nevoa [overflow-wrap:anywhere]">
            {view.name}
          </h2>
          <p data-testid="view-product" className="mt-0.5 text-sm text-v2-nevoa/65 [overflow-wrap:anywhere]">
            {productName}, {ofertas} {ofertas === 1 ? "oferta" : "ofertas"}
          </p>
        </div>
        <ControleDeAtualizacao
          viewId={view.id}
          refreshUrl={`/api/vendas/views/${view.id}/refresh`}
          lastRefreshAt={view.last_refresh_at}
          onRefreshed={() => {
            recarregar();
            onViewChanged();
          }}
        />
      </div>

      <div
        role="status"
        data-testid="view-backfill-notice"
        data-backfill-status={aviso.status}
        className="flex flex-wrap items-center justify-between gap-3 rounded-v2-sm bg-v2-casco px-3 py-2.5 text-sm ring-1 ring-inset ring-v2-azul-luz/15"
      >
        <span
          className={cx(
            "min-w-0 [overflow-wrap:anywhere]",
            aviso.status === "failed" ? "text-v2-queda" : aviso.status === "done" ? "text-v2-nevoa/65" : "text-v2-nevoa",
          )}
        >
          {aviso.message}
        </span>
        {aviso.canRetry && (
          <Button variante="secundario" onClick={tentarDeNovo} disabled={tentando} data-testid="view-backfill-retry">
            {tentando ? "Tentando…" : "Tentar novamente"}
          </Button>
        )}
        {erroDaTentativa && (
          <span data-testid="view-backfill-retry-error" className="w-full text-v2-queda">
            {erroDaTentativa}
          </span>
        )}
      </div>

      <FiltroDePeriodo value={range} canEdit={canEdit} onSave={onRangeChange} />

      {erro && (
        <Surface data-testid="view-load-error" role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-v2-queda">Falha ao carregar os números.</p>
          <Button variante="secundario" onClick={recarregar}>
            Tentar novamente
          </Button>
        </Surface>
      )}

      {!dados && !erro && (
        <div data-testid="view-loading" aria-busy="true" aria-label="Carregando os números" className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <div className="h-32 animate-pulse rounded-v2-md bg-v2-casco motion-reduce:animate-none" />
          <div className="h-32 animate-pulse rounded-v2-md bg-v2-casco motion-reduce:animate-none" />
        </div>
      )}

      {dados && !erro && (
        <div className={cx("flex flex-col gap-5 transition-opacity duration-[240ms]", atualizando && "opacity-50")} aria-busy={atualizando}>
          {divergencia && (
            <p
              role="alert"
              data-testid="view-totals-mismatch"
              className="rounded-v2-sm bg-v2-queda/10 px-3 py-2.5 text-sm text-v2-queda ring-1 ring-inset ring-v2-queda/40"
            >
              Os totais não batem entre si (KPI {fmtInt(divergencia.kpi)}, gráfico por dia {fmtInt(divergencia.daily)},
              quebra por oferta {fmtInt(divergencia.offers)}). Use Atualizar agora; se persistir, avise o time.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <Surface data-testid="view-kpi-sales" className="flex min-w-0 flex-col gap-2">
              <span className="text-sm font-medium text-v2-nevoa/70">Vendas</span>
              <span
                data-testid="view-kpi-sales-value"
                className="text-5xl font-bold leading-none tracking-tight text-v2-ponto [overflow-wrap:anywhere]"
              >
                {fmtInt(dados.kpis.sales)}
              </span>
              {selo && (
                <span>
                  <Selo tom={aviso.status === "failed" ? "erro" : "info"}>{selo}</Selo>
                </span>
              )}
            </Surface>

            <Surface data-testid="view-kpi-refunded" className="flex min-w-0 flex-col gap-2">
              <span className="flex items-center gap-2 text-sm font-medium text-v2-nevoa/70">
                Reembolsadas
                <button
                  type="button"
                  data-testid="view-refunded-help-btn"
                  aria-label="Sobre reembolsos"
                  aria-expanded={ajudaAberta}
                  title="Reembolso retroativo: a venda sai do dia em que foi aprovada"
                  onClick={() => setAjudaAberta((o) => !o)}
                  className={cx(
                    "inline-flex size-6 items-center justify-center rounded-full text-xs text-v2-nevoa/70 ring-1 ring-inset ring-v2-azul-luz/30",
                    foco,
                  )}
                >
                  ?
                </button>
              </span>
              <span data-testid="view-kpi-refunded-value" className="text-3xl font-bold leading-none text-v2-nevoa">
                {fmtInt(dados.kpis.refunded)}
              </span>
              {ajudaAberta && (
                <span data-testid="view-refunded-help" className="text-xs text-v2-nevoa/65">
                  Reembolso é retroativo: a venda reembolsada sai da contagem de vendas e do dia em que foi aprovada, não do dia do
                  reembolso.
                </span>
              )}
            </Surface>
          </div>
        </div>
      )}
    </div>
  );
}
