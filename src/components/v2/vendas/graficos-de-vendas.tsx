"use client";

import { useMemo } from "react";
import type { VendasViewDailyRow, VendasViewHourlyRow } from "@/types/vendas";
import type { ChartGranularity } from "@/lib/vendas/cumulative-chart";
import { buildViewDailyCumulative, buildViewHourlyCumulative } from "@/lib/vendas/views";
import { BarChartDiarioLazy, LineChartLazy } from "../evento/charts-lazy";
import { Segmentado } from "../evento/segmentado";
import { Surface } from "../ui";
import { formatarValor } from "../charts/geometry";
import { formatosDoEixo, pontosAcumulados, pontosDeVendas } from "./series";

const ALTURA = 220;

const OPCOES: { value: ChartGranularity; label: string }[] = [
  { value: "dia", label: "Dia" },
  { value: "hora", label: "Hora" },
];

interface GraficoProps {
  daily: VendasViewDailyRow[];
  // null = a série horária não chegou: o switch some em vez de levar a um gráfico vazio.
  hourly: VendasViewHourlyRow[] | null;
  granularity: ChartGranularity;
  onGranularityChange: (g: ChartGranularity) => void;
}

function Cartao({
  testId,
  titulo,
  controle,
  children,
}: {
  testId: string;
  titulo: string;
  controle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Surface data-testid={testId} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-base font-semibold text-v2-nevoa">{titulo}</h4>
        {controle}
      </div>
      {children}
    </Surface>
  );
}

function SemVendas({ testId }: { testId: string }) {
  return (
    <p data-testid={testId} className="py-10 text-center text-sm text-v2-nevoa/65">
      Sem vendas no período.
    </p>
  );
}

function Alternador({
  testId,
  ativo,
  onChange,
  rotulo,
}: {
  testId: string;
  ativo: ChartGranularity;
  onChange: (g: ChartGranularity) => void;
  rotulo: string;
}) {
  return (
    <div data-testid={testId}>
      <Segmentado valor={ativo} onChange={onChange} opcoes={OPCOES} rotulo={rotulo} />
    </div>
  );
}

export function GraficoDeVendas({ daily, hourly, granularity, onGranularityChange }: GraficoProps) {
  const porHora = granularity === "hora" && hourly !== null;
  const efetiva: ChartGranularity = porHora ? "hora" : "dia";
  const pontos = useMemo(() => pontosDeVendas(daily, hourly ?? [], efetiva), [daily, hourly, efetiva]);
  const vazio = pontos.length === 0 || pontos.every((p) => p.y === 0);
  const formatos = useMemo(() => formatosDoEixo(efetiva), [efetiva]);
  const titulo = porHora ? "Vendas por hora" : "Vendas por dia";

  return (
    <Cartao
      testId="view-daily-chart"
      titulo={titulo}
      controle={
        hourly !== null ? (
          <Alternador
            testId="view-daily-granularity"
            ativo={efetiva}
            onChange={onGranularityChange}
            rotulo="Granularidade das vendas"
          />
        ) : undefined
      }
    >
      {vazio ? (
        <SemVendas testId="view-daily-chart-empty" />
      ) : (
        <BarChartDiarioLazy
          titulo={titulo}
          data={pontos}
          cor="var(--v2-azul-igt)"
          altura={ALTURA}
          formatarY={formatarValor}
          formatarX={formatos.curto}
          formatarXLongo={formatos.longo}
          rotuloX={porHora ? "Hora" : "Dia"}
          unidade={porHora ? "horas" : "dias"}
        />
      )}
    </Cartao>
  );
}

export function GraficoAcumulado({ daily, hourly, granularity, onGranularityChange }: GraficoProps) {
  const porHora = granularity === "hora" && hourly !== null;
  const efetiva: ChartGranularity = porHora ? "hora" : "dia";
  const acumulado = useMemo(
    () => (porHora ? buildViewHourlyCumulative(hourly ?? []) : buildViewDailyCumulative(daily)),
    [daily, hourly, porHora],
  );
  const pontos = useMemo(() => pontosAcumulados(acumulado, efetiva), [acumulado, efetiva]);
  const vazio = acumulado.length === 0 || acumulado[acumulado.length - 1].cumulative === 0;
  const formatos = useMemo(() => formatosDoEixo(efetiva), [efetiva]);
  const titulo = porHora ? "Vendas acumuladas por hora" : "Vendas acumuladas";

  return (
    <Cartao
      testId="view-cumulative-chart"
      titulo={titulo}
      controle={
        hourly !== null ? (
          <Alternador
            testId="view-cumulative-granularity"
            ativo={efetiva}
            onChange={onGranularityChange}
            rotulo="Granularidade do acumulado"
          />
        ) : undefined
      }
    >
      {vazio ? (
        <SemVendas testId="view-cumulative-chart-empty" />
      ) : (
        <LineChartLazy
          titulo={titulo}
          series={[{ id: "acumulado", label: "Vendas acumuladas", data: pontos, cor: "var(--v2-azul-luz)" }]}
          altura={ALTURA}
          area
          formatarY={formatarValor}
          formatarX={formatos.curto}
          formatarXLongo={formatos.longo}
        />
      )}
    </Cartao>
  );
}
