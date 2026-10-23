"use client";

import type { Fonte } from "@/lib/indicadores/dashboard-evento";
import type { DailyPoint, GlobalLeadsMetrics } from "@/types/indicadores";
import { CountUp } from "../motion/count-up";
import { Surface } from "../ui/surface";
import { topComOutros } from "./agrupar";
import { CabecalhoSecao, Corpo } from "./bloco";
import { BarChartLazy, DonutChartLazy, LineChartLazy } from "./charts-lazy";
import { fmtNum } from "./format";
import { useFonte } from "./use-fonte";

/** Captação de leads. O V1 avisa que estes dados não seguem o filtro de campanha; a V2 mantém o aviso. */
export function BlocoLeads({
  leads: leadsInicial,
  daily: dailyInicial,
}: {
  leads?: Fonte<GlobalLeadsMetrics> | null;
  daily?: Fonte<DailyPoint[]> | null;
}) {
  const leads = useFonte("leads", leadsInicial);
  const daily = useFonte("daily", dailyInicial);
  const l = leads.data?.data;
  const d = daily.data?.data;
  const porEvento = topComOutros((l?.by_event ?? []).map((e) => ({ label: e.evento, value: e.count })));
  const porOrigem = topComOutros((l?.by_source ?? []).map((s) => ({ label: s.source, value: s.count })));

  return (
    <section aria-labelledby="titulo-leads">
      <CabecalhoSecao
        titulo="Captação de leads"
        descricao="Novos leads que entraram no funil, sem filtro de campanha"
        id="titulo-leads"
      />
      <Corpo consultas={[leads, daily]} esqueletoAltura="h-96">
        {l && d && (
          <div className="grid gap-4 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <Surface className="flex flex-col justify-between">
              <div>
                <p className="text-sm text-v2-nevoa/70">Leads captados</p>
                <p className="mt-2 text-4xl font-light tabular-nums tracking-tight">
                  <CountUp value={l.total} format={fmtNum} />
                </p>
              </div>
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-medium">Por origem</h3>
                <DonutChartLazy titulo="Leads por origem" data={porOrigem} rotuloTotal="leads" formatarValor={fmtNum} />
              </div>
            </Surface>
            <Surface className="space-y-5">
              <LineChartLazy
                titulo="Leads por dia"
                series={[
                  {
                    id: "leads",
                    label: "Leads",
                    data: d.map((p) => ({ x: new Date(`${p.date}T00:00:00`), y: p.lead_captacoes })),
                  },
                ]}
                formatarY={fmtNum}
                altura={240}
              />
              <div>
                <h3 className="mb-2 text-sm font-medium">Por evento de captação</h3>
                <BarChartLazy titulo="Leads por evento" data={porEvento} orientacao="horizontal" formatarValor={fmtNum} />
              </div>
            </Surface>
          </div>
        )}
      </Corpo>
    </section>
  );
}
