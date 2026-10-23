"use client";

import type { Fonte } from "@/lib/indicadores/dashboard-evento";
import { derivarResultado } from "@/lib/indicadores/dashboard-evento";
import type { GlobalHotmartMetrics, GlobalLeadsMetrics, GlobalMetrics } from "@/types/indicadores";
import { Surface } from "../ui/surface";
import { CabecalhoSecao, Corpo } from "./bloco";
import { useEvento } from "./contexto";
import { fmtBRL, fmtPct } from "./format";
import { FluxoJornada } from "./fluxo-jornada";
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
      <Corpo consultas={[meta, hotmart, leads]} esqueletoAltura="h-72" formas={["fluxo"]} ordem={1}>
        {funil && (
          <div className="space-y-4">
            <FluxoJornada etapas={funil.etapas} taxas={funil.taxas} />
            <Surface nivel={2}>
              <dl className="grid grid-cols-2 gap-4 @3xl:grid-cols-5">
                <Numero rotulo="Investimento" valor={m ? fmtBRL(m.meta_spend) : "—"} />
                <Numero rotulo="CPA" valor={cpa === null ? "—" : fmtBRL(cpa)} />
                <Numero rotulo="Custo por lead" valor={m?.meta_cpl_traffic == null ? "—" : fmtBRL(m.meta_cpl_traffic)} />
                <Numero rotulo="CPM" valor={m ? fmtBRL(m.meta_cpm) : "—"} />
                <Numero rotulo="Conversão anúncio em venda" valor={convRate === null ? "—" : fmtPct(convRate)} />
              </dl>
            </Surface>
          </div>
        )}
      </Corpo>
    </section>
  );
}
