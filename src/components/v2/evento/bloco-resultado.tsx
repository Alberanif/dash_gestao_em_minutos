"use client";

import type { Fonte } from "@/lib/indicadores/dashboard-evento";
import { derivarResultado } from "@/lib/indicadores/dashboard-evento";
import type { GlobalHotmartMetrics, GlobalMetrics } from "@/types/indicadores";
import { CountUp } from "../motion/count-up";
import { Surface } from "../ui/surface";
import { Corpo } from "./bloco";
import { useEvento } from "./contexto";
import { fmtBRL, fmtDecimal, fmtNum } from "./format";
import { useFonte } from "./use-fonte";

const roasFmt = (n: number) => `${fmtDecimal(n, 2)}×`;

function Kpi({ rotulo, nota, valor, formato }: { rotulo: string; nota: string; valor: number | null; formato: (n: number) => string }) {
  return (
    <Surface className="min-w-0">
      <p className="text-sm text-v2-nevoa/70">{rotulo}</p>
      <p className="mt-2 truncate text-3xl font-light tabular-nums tracking-tight @xl:text-4xl">
        {valor === null ? "—" : <CountUp value={valor} format={formato} />}
      </p>
      <p className="mt-1 text-xs text-v2-nevoa/50">{nota}</p>
    </Surface>
  );
}

/** Resultado: ROAS, receita e vendas do período, com as mesmas regras do V1. */
export function BlocoResultado({
  meta: metaInicial,
  hotmart: hotmartInicial,
}: {
  meta?: Fonte<GlobalMetrics> | null;
  hotmart?: Fonte<GlobalHotmartMetrics> | null;
}) {
  const { consulta } = useEvento();
  const meta = useFonte("meta", metaInicial);
  const hotmart = useFonte("hotmart", hotmartInicial);
  const { roas } = derivarResultado(consulta.expanded, meta.data?.data ?? null, hotmart.data?.data ?? null, null);
  const h = hotmart.data?.data;

  return (
    <Corpo consultas={[meta, hotmart]} esqueletoAltura="h-32">
      <div className="grid gap-4 @xl:grid-cols-3">
        <Kpi rotulo="ROAS" nota="Receita ÷ Investimento" valor={roas} formato={roasFmt} />
        <Kpi rotulo="Receita" nota="Via Hotmart, em reais" valor={h ? h.total_revenue : null} formato={fmtBRL} />
        <Kpi rotulo="Vendas" nota="Total de conversões" valor={h ? h.total_sales : null} formato={fmtNum} />
      </div>
    </Corpo>
  );
}
