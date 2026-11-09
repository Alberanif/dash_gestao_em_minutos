"use client";

import { useMemo, useState } from "react";
import type { DebriefingDailyPoint } from "@/lib/indicadores/service/debriefing";
import { BarChartDiarioLazy, LineChartLazy } from "../charts-lazy";
import { fmtBRL, fmtDate, fmtNum } from "./formatar";

const ALTURA_FATURAMENTO = 220;
const ALTURA_VENDAS = 132;

/** "2026-10-07" -> meio-dia UTC, o mesmo critério dos gráficos (a data nunca cai no dia vizinho). */
const paraData = (d: string) => new Date(`${d}T12:00:00Z`);

/**
 * Evolução diária do Debriefing: Faturamento por dia (linha) sobre Vendas por dia (colunas), no mesmo
 * eixo de datas. Passar o mouse, tocar ou focar um dia destaca o mesmo dia nos dois gráficos.
 * Os gráficos vêm do chunk lazy; a série é a consolidada ou a do produto selecionado.
 */
export function EvolucaoDiaria({ series }: { series: DebriefingDailyPoint[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);

  // Mesma ordem e mesmos dias nos dois gráficos: o índice ativo vale para ambos.
  const ordenada = useMemo(
    () => [...series].sort((a, b) => a.date.localeCompare(b.date)),
    [series],
  );
  const faturamento = useMemo(() => ordenada.map((p) => ({ x: paraData(p.date), y: p.revenue })), [ordenada]);
  const vendas = useMemo(() => ordenada.map((p) => ({ x: paraData(p.date), y: p.sales_count })), [ordenada]);

  if (ordenada.length === 0) {
    return (
      <section aria-label="Evolução diária" className="text-sm text-v2-nevoa/70">
        <p role="status">Sem vendas no período.</p>
      </section>
    );
  }

  const dia = ativo !== null && ativo < ordenada.length ? ordenada[ativo] : null;

  return (
    <section aria-label="Evolução diária: faturamento e vendas por dia" className="min-w-0">
      <p data-testid="leitura-dia" className="mb-2 min-h-5 text-sm text-v2-nevoa/80">
        {dia ? (
          <>
            <span className="font-semibold text-v2-nevoa">{fmtDate(dia.date)}</span>
            {" · "}
            {fmtNum(dia.sales_count)} {dia.sales_count === 1 ? "venda" : "vendas"}
            {" · "}
            {fmtBRL(dia.revenue)}
          </>
        ) : (
          <span className="text-v2-nevoa/60">Passe o mouse ou toque em um dia para ver vendas e faturamento.</span>
        )}
      </p>
      <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-v2-nevoa/60">Faturamento por dia</h3>
      <LineChartLazy
        titulo="Faturamento por dia"
        series={[{ id: "faturamento", label: "Faturamento", data: faturamento }]}
        altura={ALTURA_FATURAMENTO}
        formatarY={fmtBRL}
        indiceAtivo={ativo}
        onIndiceAtivo={setAtivo}
      />
      <h3 className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-v2-nevoa/60">Vendas por dia</h3>
      <BarChartDiarioLazy
        titulo="Vendas por dia"
        data={vendas}
        cor="var(--v2-serie-1)"
        altura={ALTURA_VENDAS}
        formatarY={fmtNum}
        indiceAtivo={ativo}
        onIndiceAtivo={setAtivo}
      />
    </section>
  );
}
