"use client";

import { CountUp } from "../motion/count-up";
import type { EventoMetrics } from "@/lib/indicadores/service/eventos-metrics";

const fmtNum = (v: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);
const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v);

type Props = {
  /** null = métricas indisponíveis para este evento; undefined = fonte sem dado. */
  metrics: EventoMetrics | null | undefined;
};

/** Leads, CPL e investimento vitalícios do evento. Valor ausente aparece como "—". */
export function MetricasCelulas({ metrics }: Props) {
  const celulas = [
    { rotulo: "Leads", valor: metrics?.leads ?? null, formato: fmtNum },
    { rotulo: "CPL", valor: metrics?.cpl ?? null, formato: fmtBRL },
    { rotulo: "Investimento", valor: metrics?.spend ?? null, formato: fmtBRL },
  ];

  return (
    <dl className="mt-4 grid grid-cols-3 gap-2">
      {celulas.map((c) => (
        <div key={c.rotulo} className="min-w-0 rounded-v2-sm bg-v2-abismo/60 px-2 py-2.5 text-center">
          <dt className="truncate text-xs text-v2-nevoa/60">{c.rotulo}</dt>
          <dd className="mt-1.5 truncate text-sm font-semibold">
            {c.valor === null ? "—" : <CountUp value={c.valor} format={c.formato} />}
          </dd>
        </div>
      ))}
    </dl>
  );
}
