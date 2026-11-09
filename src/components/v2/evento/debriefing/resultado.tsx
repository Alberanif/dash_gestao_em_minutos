import type { DebriefingTotals } from "@/lib/indicadores/service/debriefing";
import { fmtBRL, fmtNum } from "./formatar";

/**
 * Superfície de resultado: uma só, em profundidade (casco), sem três cards iguais.
 * O Faturamento é o protagonista (leve, grande, âmbar, algarismos tabulares); vendas e moeda
 * estrangeira são menores. O âmbar aparece só no Faturamento.
 */
export function Resultado({ totais }: { totais: DebriefingTotals }) {
  return (
    <section aria-label="Resultado" className="rounded-v2-md bg-v2-casco p-5 shadow-v2-1 @xl:p-7">
      <div className="grid gap-6 @3xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] @3xl:items-end @3xl:gap-10">
        <div className="min-w-0">
          <p
            data-testid="debriefing-faturamento"
            className="text-[clamp(1.75rem,8cqi,4rem)] font-light leading-none tracking-tight text-v2-ponto tabular-nums [overflow-wrap:anywhere]"
          >
            {fmtBRL(totais.total_revenue_brl)}
          </p>
          <p className="mt-2 text-sm text-v2-nevoa/70">Faturamento total (R$)</p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-x-10 gap-y-4">
          <div className="min-w-0">
            <p data-testid="debriefing-total-vendas" className="text-2xl font-light tabular-nums text-v2-nevoa">
              {fmtNum(totais.total_sales)}
            </p>
            <p className="mt-1 text-sm text-v2-nevoa/70">Total de vendas</p>
            <p className="text-xs text-v2-nevoa/60">
              {fmtNum(totais.total_sales_brl)} em reais, {fmtNum(totais.total_sales_foreign)} em moeda estrangeira
            </p>
          </div>
          <div className="min-w-0">
            <p data-testid="debriefing-moeda-estrangeira" className="text-2xl font-light tabular-nums text-v2-nevoa">
              {fmtNum(totais.total_sales_foreign)}
            </p>
            <p className="mt-1 text-sm text-v2-nevoa/70">Vendas em moeda estrangeira</p>
          </div>
        </div>
      </div>
    </section>
  );
}
