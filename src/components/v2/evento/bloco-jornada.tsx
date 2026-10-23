"use client";

import type { Fonte } from "@/lib/indicadores/dashboard-evento";
import { derivarResultado } from "@/lib/indicadores/dashboard-evento";
import type { GlobalHotmartMetrics, GlobalLeadsMetrics, GlobalMetrics } from "@/types/indicadores";
import { Surface } from "../ui/surface";
import { CabecalhoSecao, Corpo } from "./bloco";
import { FunnelChartLazy } from "./charts-lazy";
import { useEvento } from "./contexto";
import { fmtBRL, fmtDecimal, fmtNum, fmtPct } from "./format";
import { useFonte } from "./use-fonte";

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-v2-nevoa/60">{rotulo}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium tabular-nums">{valor}</dd>
    </div>
  );
}

/** Jornada de conversão: do investimento à venda. Sem Meta e Hotmart juntos, o V1 esconde o bloco e a V2 também. */
export function BlocoJornada({
  meta: metaInicial,
  hotmart: hotmartInicial,
  leads: leadsInicial,
}: {
  meta?: Fonte<GlobalMetrics> | null;
  hotmart?: Fonte<GlobalHotmartMetrics> | null;
  leads?: Fonte<GlobalLeadsMetrics> | null;
}) {
  const { consulta } = useEvento();
  const meta = useFonte("meta", metaInicial);
  const hotmart = useFonte("hotmart", hotmartInicial);
  const leads = useFonte("leads", leadsInicial);
  const { sources } = consulta.expanded;
  if (!sources.meta || !sources.hotmart) return null;

  const m = meta.data?.data ?? null;
  const { funil, cpa, convRate } = derivarResultado(consulta.expanded, m, hotmart.data?.data ?? null, leads.data?.data ?? null);

  return (
    <section aria-labelledby="titulo-jornada">
      <CabecalhoSecao titulo="Jornada de conversão" descricao="Do investimento até a venda" id="titulo-jornada" />
      <Corpo consultas={[meta, hotmart, leads]} esqueletoAltura="h-72" formas={["funil", "barras"]} ordem={1}>
        {funil && (
          <div className="grid gap-4 @3xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Surface>
              <FunnelChartLazy
                titulo="Funil de conversão"
                etapas={funil.etapas.map((e, i) => ({ id: String(i), label: e.label, value: e.value }))}
                formatarValor={fmtNum}
              />
            </Surface>
            <Surface nivel={2} className="space-y-5">
              <dl className="grid grid-cols-2 gap-4">
                <Numero rotulo="Investimento" valor={m ? fmtBRL(m.meta_spend) : "—"} />
                <Numero rotulo="CPA" valor={cpa === null ? "—" : fmtBRL(cpa)} />
                <Numero rotulo="Custo por lead" valor={m?.meta_cpl_traffic == null ? "—" : fmtBRL(m.meta_cpl_traffic)} />
                <Numero rotulo="CPM" valor={m ? fmtBRL(m.meta_cpm) : "—"} />
                <Numero rotulo="Conversão anúncio em venda" valor={convRate === null ? "—" : fmtPct(convRate)} />
              </dl>
              <ul className="space-y-2 border-t border-v2-azul-luz/10 pt-4 text-sm">
                {funil.taxas.map((t) => (
                  <li key={t.label} className="flex items-baseline justify-between gap-3">
                    <span className="text-v2-nevoa/70">{t.label}</span>
                    <span className="tabular-nums">{t.pct === null ? "—" : `${fmtDecimal(t.pct, 2)}%`}</span>
                  </li>
                ))}
              </ul>
            </Surface>
          </div>
        )}
      </Corpo>
    </section>
  );
}
