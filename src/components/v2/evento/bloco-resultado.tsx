"use client";

import type { Fonte } from "@/lib/indicadores/dashboard-evento";
import { derivarCaptacao, derivarResultado } from "@/lib/indicadores/dashboard-evento";
import type { GlobalHotmartMetrics, GlobalLeadsMetrics, GlobalMetrics } from "@/types/indicadores";
import { CountUp } from "../motion/count-up";
import type { Dado } from "../cor";
import { Corpo } from "./bloco";
import { useEvento } from "./contexto";
import { fmtBRL, fmtDecimal, fmtNum } from "./format";
import type { NomeIcone } from "./icones";
import { Kpi } from "./kpi";
import { useFonte } from "./use-fonte";

const roasFmt = (n: number) => `${fmtDecimal(n, 2)}×`;

function KpiResultado({
  rotulo,
  nota,
  valor,
  formato,
  dado,
  icone,
}: {
  rotulo: string;
  nota: string;
  valor: number | null;
  formato: (n: number) => string;
  dado: Dado;
  icone: NomeIcone;
}) {
  return (
    <Kpi rotulo={rotulo} nota={nota} dado={dado} icone={icone}>
      {valor === null ? "—" : <CountUp value={valor} format={formato} />}
    </Kpi>
  );
}

/** Resultado: ROAS, receita e vendas do período; num evento orgânico, leads e CPL. */
export function BlocoResultado({
  meta,
  hotmart,
  leads,
}: {
  meta?: Fonte<GlobalMetrics> | null;
  hotmart?: Fonte<GlobalHotmartMetrics> | null;
  leads?: Fonte<GlobalLeadsMetrics> | null;
}) {
  const { filter } = useEvento();
  // Evento orgânico não vende: o resultado é a captação (leads e CPL), não receita e vendas.
  return filter.is_organic === true ? (
    <ResultadoOrganico meta={meta} leads={leads} />
  ) : (
    <ResultadoComVendas meta={meta} hotmart={hotmart} />
  );
}

function ResultadoComVendas({
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
        <KpiResultado rotulo="ROAS" nota="Receita ÷ Investimento" valor={roas} formato={roasFmt} dado="custo" icone="roas" />
        <KpiResultado rotulo="Receita" nota="Via Hotmart, em reais" valor={h ? h.total_revenue : null} formato={fmtBRL} dado="venda" icone="receita" />
        <KpiResultado rotulo="Vendas" nota="Total de conversões" valor={h ? h.total_sales : null} formato={fmtNum} dado="venda" icone="vendas" />
      </div>
    </Corpo>
  );
}

function ResultadoOrganico({
  meta: metaInicial,
  leads: leadsInicial,
}: {
  meta?: Fonte<GlobalMetrics> | null;
  leads?: Fonte<GlobalLeadsMetrics> | null;
}) {
  const { consulta } = useEvento();
  const meta = useFonte("meta", metaInicial);
  const leads = useFonte("leads", leadsInicial);
  const c = derivarCaptacao(consulta.expanded, meta.data?.data ?? null, leads.data?.data ?? null);

  return (
    <Corpo consultas={[meta, leads]} esqueletoAltura="h-32">
      <div className="grid gap-4 @xl:grid-cols-2">
        <KpiResultado rotulo="Leads" nota={c.origem ?? "Sem fonte de leads"} valor={c.leads} formato={fmtNum} dado="lead" icone="leads" />
        <KpiResultado rotulo="CPL" nota="Investimento ÷ Leads" valor={c.cpl} formato={fmtBRL} dado="custo" icone="receita" />
      </div>
    </Corpo>
  );
}
