"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { Fonte } from "@/lib/indicadores/dashboard-evento";
import type {
  ConversionSourceRow,
  DailyPoint,
  GlobalHotmartMetrics,
  GlobalMetrics,
  MetaCampaignsResponse,
} from "@/types/indicadores";
import { Surface } from "../ui/surface";
import { topComOutros } from "./agrupar";
import { CabecalhoSecao, Corpo, Esqueleto } from "./bloco";
import { BarChartLazy, DonutChartLazy, LineChartLazy } from "./charts-lazy";
import { useEvento } from "./contexto";
import { Segmentado } from "./segmentado";
import { fmtBRL, fmtNum, fmtPct } from "./format";
import { useFonte } from "./use-fonte";

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0 rounded-v2-sm bg-v2-abismo/50 px-3 py-2.5">
      <dt className="text-xs text-v2-nevoa/60">{rotulo}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium tabular-nums">{valor}</dd>
    </div>
  );
}

const serieDiaria = (daily: DailyPoint[], campo: "meta_spend" | "hotmart_sales") =>
  daily.map((p) => ({ x: new Date(`${p.date}T00:00:00`), y: p[campo] }));

function PainelMeta({ meta, daily }: { meta: GlobalMetrics; daily: DailyPoint[] }) {
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-2 @xl:grid-cols-4">
        <Numero rotulo="Investimento" valor={fmtBRL(meta.meta_spend)} />
        <Numero rotulo="CPM" valor={fmtBRL(meta.meta_cpm)} />
        <Numero rotulo="CTR" valor={fmtPct(meta.meta_ctr)} />
        <Numero rotulo="Leads" valor={fmtNum(meta.meta_leads)} />
        <Numero rotulo="Custo por lead" valor={meta.meta_cpl_traffic === null ? "—" : fmtBRL(meta.meta_cpl_traffic)} />
        <Numero rotulo="Checkouts" valor={fmtNum(meta.meta_checkout)} />
        <Numero rotulo="Taxa de conexão" valor={fmtPct(meta.meta_connect_rate)} />
        <Numero rotulo="Conversão da página" valor={fmtPct(meta.meta_lp_conversion)} />
      </dl>
      <LineChartLazy
        titulo="Investimento por dia"
        series={[{ id: "gasto", label: "Investimento", data: serieDiaria(daily, "meta_spend") }]}
        formatarY={fmtBRL}
        altura={240}
      />
    </div>
  );
}

function Campanhas() {
  const { consulta } = useEvento();
  const campanhas = useQuery({
    queryKey: ["campaigns", consulta.chave],
    queryFn: async ({ signal }) => {
      const r = await fetch(`/api/indicadores/campaigns${consulta.params}`, { signal });
      if (!r.ok) throw new Error(`API error ${r.status}`);
      return (await r.json()) as MetaCampaignsResponse;
    },
  });
  if (campanhas.isPending) return <Esqueleto className="h-32 w-full" />;
  if (campanhas.isError) return <p className="text-sm text-v2-nevoa/70">Não foi possível carregar as campanhas.</p>;
  const lista = campanhas.data.campaigns.slice(0, 8);
  if (lista.length === 0) return <p className="text-sm text-v2-nevoa/70">Nenhuma campanha com investimento no período.</p>;
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">Campanhas</h3>
      <ul className="divide-y divide-v2-azul-luz/10 text-sm">
        {lista.map((c) => (
          <li key={c.campaign_id} className="flex items-baseline justify-between gap-3 py-2">
            <span className="min-w-0 truncate text-v2-nevoa/80">{c.campaign_name}</span>
            <span className="shrink-0 tabular-nums">
              {fmtBRL(c.meta_spend)} <span className="text-v2-nevoa/50">· {fmtNum(c.meta_leads)} leads</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PainelHotmart({
  hotmart,
  daily,
  fontes,
}: {
  hotmart: GlobalHotmartMetrics;
  daily: DailyPoint[];
  fontes: ConversionSourceRow[];
}) {
  const produtos = hotmart.products.map((p) => ({ id: p.product_id, label: p.product_name, value: p.revenue }));
  const origens = topComOutros(fontes.map((f) => ({ label: f.source, value: f.count })));
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-2 @xl:grid-cols-4">
        <Numero rotulo="Vendas" valor={fmtNum(hotmart.total_sales)} />
        <Numero rotulo="Receita" valor={fmtBRL(hotmart.total_revenue)} />
        <Numero rotulo="Vendas em reais" valor={fmtNum(hotmart.total_sales_brl)} />
        <Numero rotulo="Vendas no exterior" valor={fmtNum(hotmart.total_sales_foreign)} />
      </dl>
      <LineChartLazy
        titulo="Vendas por dia"
        series={[{ id: "vendas", label: "Vendas", data: serieDiaria(daily, "hotmart_sales") }]}
        formatarY={fmtNum}
        altura={240}
      />
      <div className="grid gap-5 @3xl:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-medium">Receita por produto</h3>
          <BarChartLazy titulo="Receita por produto" data={produtos} orientacao="horizontal" formatarValor={fmtBRL} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium">Origem das vendas</h3>
          <DonutChartLazy titulo="Origem das vendas" data={origens} rotuloTotal="vendas" formatarValor={fmtNum} />
        </div>
      </div>
    </div>
  );
}

/** Plataformas: o detalhe de cada fonte configurada no evento, com a troca de plataforma em abas. */
export function BlocoPlataformas({
  meta: metaInicial,
  hotmart: hotmartInicial,
  daily: dailyInicial,
  sources: sourcesInicial,
}: {
  meta?: Fonte<GlobalMetrics> | null;
  hotmart?: Fonte<GlobalHotmartMetrics> | null;
  daily?: Fonte<DailyPoint[]> | null;
  sources?: Fonte<ConversionSourceRow[]> | null;
}) {
  const { consulta } = useEvento();
  const meta = useFonte("meta", metaInicial);
  const hotmart = useFonte("hotmart", hotmartInicial);
  const daily = useFonte("daily", dailyInicial);
  const sources = useFonte("sources", sourcesInicial);
  const { sources: tem } = consulta.expanded;
  const [aba, setAba] = useState<"meta" | "hotmart">(tem.meta ? "meta" : "hotmart");
  // Se o evento não tem a fonte da aba aberta, cai na que existe.
  const abaAtiva = aba === "meta" && !tem.meta ? "hotmart" : aba === "hotmart" && !tem.hotmart ? "meta" : aba;

  return (
    <section aria-labelledby="titulo-plataformas">
      <CabecalhoSecao titulo="Plataformas" descricao="Detalhe por fonte de dados" id="titulo-plataformas" />
      {!tem.meta && !tem.hotmart ? (
        <Surface>
          <p className="text-sm text-v2-nevoa/70">Este evento não tem Meta Ads nem Hotmart configurados.</p>
        </Surface>
      ) : (
        <>
          <Segmentado
            rotulo="Plataforma"
            idPainel="painel-plataforma"
            valor={abaAtiva}
            onChange={setAba}
            opcoes={[
              ...(tem.meta ? [{ value: "meta" as const, label: "Meta Ads" }] : []),
              ...(tem.hotmart ? [{ value: "hotmart" as const, label: "Hotmart" }] : []),
            ]}
          />
          <Surface className="mt-3" id="painel-plataforma" role="tabpanel" aria-label={abaAtiva === "meta" ? "Meta Ads" : "Hotmart"}>
            <Corpo consultas={[meta, hotmart, daily, sources]} esqueletoAltura="h-96">
              {abaAtiva === "meta" && meta.data && daily.data && (
                <div className="space-y-6">
                  <PainelMeta meta={meta.data.data} daily={daily.data.data} />
                  <Campanhas />
                </div>
              )}
              {abaAtiva === "hotmart" && hotmart.data && daily.data && sources.data && (
                <PainelHotmart hotmart={hotmart.data.data} daily={daily.data.data} fontes={sources.data.data} />
              )}
            </Corpo>
          </Surface>
        </>
      )}
    </section>
  );
}
