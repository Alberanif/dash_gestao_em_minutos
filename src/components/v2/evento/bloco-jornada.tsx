"use client";

import type { Fonte } from "@/lib/indicadores/dashboard-evento";
import { derivarResultado } from "@/lib/indicadores/dashboard-evento";
import type { GlobalHotmartMetrics, GlobalLeadsMetrics, GlobalMetrics } from "@/types/indicadores";
import { CabecalhoSecao, Corpo } from "./bloco";
import { useEvento } from "./contexto";
import { FluxoJornada } from "./fluxo-jornada";
import { useFonte } from "./use-fonte";

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

  const { funil } = derivarResultado(consulta.expanded, meta.data?.data ?? null, hotmart.data?.data ?? null, leads.data?.data ?? null);

  return (
    <section aria-labelledby="titulo-jornada">
      <CabecalhoSecao titulo="Jornada de conversão" descricao="Do investimento até a venda" id="titulo-jornada" />
      <Corpo consultas={[meta, hotmart, leads]} esqueletoAltura="h-72" formas={["fluxo"]} ordem={1}>
        {funil && (
          <FluxoJornada etapas={funil.etapas} taxas={funil.taxas} />
        )}
      </Corpo>
    </section>
  );
}
