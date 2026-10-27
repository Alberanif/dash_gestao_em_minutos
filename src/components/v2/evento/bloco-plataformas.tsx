"use client";

import { useState } from "react";
import type { Fonte } from "@/lib/indicadores/dashboard-evento";
import type {
  ConversionSourceRow,
  DailyPoint,
  GlobalHotmartMetrics,
  GlobalMetrics,
} from "@/types/indicadores";
import { Surface } from "../ui/surface";
import { topComOutros } from "./agrupar";
import { CabecalhoSecao, Corpo } from "./bloco";
import { Campanhas } from "./campanhas";
import { BarChartDiarioLazy, BarChartLazy, DonutChartLazy } from "./charts-lazy";
import { useEvento } from "./contexto";
import { Numero } from "./numero";
import { Segmentado } from "./segmentado";
import { fmtBRL, fmtNum, fmtPct } from "./format";
import { useFonte } from "./use-fonte";

/** Rampa de âmbar da Hotmart para as fatias da rosca (tokens --v2-hot-*). */
const RAMPA_HOTMART = [1, 2, 3, 4, 5].map((i) => `var(--v2-hot-${i})`);

const serieDiaria = (daily: DailyPoint[], campo: "meta_spend" | "hotmart_sales") =>
  daily.map((p) => ({ x: new Date(`${p.date}T00:00:00`), y: p[campo] }));

function PainelMeta({ meta, daily }: { meta: GlobalMetrics; daily: DailyPoint[] }) {
  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-2 @xl:grid-cols-4">
        <Numero caixa dado="plataforma" rotulo="Investimento" valor={fmtBRL(meta.meta_spend)} />
        <Numero caixa dado="plataforma" rotulo="CPM" valor={fmtBRL(meta.meta_cpm)} />
        <Numero caixa dado="plataforma" rotulo="CTR" valor={fmtPct(meta.meta_ctr)} />
        <Numero caixa dado="plataforma" rotulo="Leads" valor={fmtNum(meta.meta_leads)} />
        <Numero caixa dado="plataforma" rotulo="Custo por lead" valor={meta.meta_cpl_traffic === null ? "—" : fmtBRL(meta.meta_cpl_traffic)} />
        <Numero caixa dado="plataforma" rotulo="Checkouts" valor={fmtNum(meta.meta_checkout)} />
        <Numero caixa dado="plataforma" rotulo="Taxa de conexão" valor={fmtPct(meta.meta_connect_rate)} />
        <Numero caixa dado="plataforma" rotulo="Conversão da página" valor={fmtPct(meta.meta_lp_conversion)} />
      </dl>
      <BarChartDiarioLazy titulo="Investimento por dia" cor="var(--plat)" data={serieDiaria(daily, "meta_spend")} formatarY={fmtBRL} altura={240} />
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
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-2 @xl:grid-cols-4">
        <Numero caixa dado="plataforma" rotulo="Vendas" valor={fmtNum(hotmart.total_sales)} />
        <Numero caixa dado="plataforma" rotulo="Receita" valor={fmtBRL(hotmart.total_revenue)} />
        <Numero caixa dado="plataforma" rotulo="Vendas em reais" valor={fmtNum(hotmart.total_sales_brl)} />
        <Numero caixa dado="plataforma" rotulo="Vendas no exterior" valor={fmtNum(hotmart.total_sales_foreign)} />
      </dl>
      <BarChartDiarioLazy titulo="Vendas por dia" cor="var(--plat)" data={serieDiaria(daily, "hotmart_sales")} formatarY={fmtNum} altura={240} />
      <div className="grid gap-8 @5xl:grid-cols-2">
        <div className="min-w-0">
          <h3 className="mb-3 text-sm font-medium">Receita por produto</h3>
          <BarChartLazy titulo="Receita por produto" cor="var(--plat)" data={produtos} orientacao="horizontal" formatarValor={fmtBRL} />
        </div>
        {/* Em tela larga, uma linha sutil de azul-luz no meio do vão de 32 px separa as duas colunas. */}
        <div className="relative min-w-0 @5xl:before:absolute @5xl:before:inset-y-0 @5xl:before:-left-4 @5xl:before:w-px @5xl:before:bg-v2-azul-luz/15">
          <h3 className="mb-3 text-sm font-medium">Origem das vendas</h3>
          <DonutChartLazy titulo="Origem das vendas" cores={RAMPA_HOTMART} data={origens} rotuloTotal="vendas" formatarValor={fmtNum} />
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
        <div className="v2-plat" data-plat={abaAtiva}>
          <Segmentado
            plataforma
            rotulo="Plataforma"
            idPainel="painel-plataforma"
            valor={abaAtiva}
            onChange={setAba}
            opcoes={[
              ...(tem.meta ? [{ value: "meta" as const, label: "Meta Ads" }] : []),
              ...(tem.hotmart ? [{ value: "hotmart" as const, label: "Hotmart" }] : []),
            ]}
          />
          <Surface className="v2-plat-painel mt-3" id="painel-plataforma" role="tabpanel" aria-label={abaAtiva === "meta" ? "Meta Ads" : "Hotmart"}>
            <Corpo consultas={[meta, hotmart, daily, sources]} esqueletoAltura="h-96" formas={["colunas", "rosca"]} ordem={2}>
              {abaAtiva === "meta" && meta.data && daily.data && (
                <div className="space-y-8">
                  <PainelMeta meta={meta.data.data} daily={daily.data.data} />
                  <Campanhas />
                </div>
              )}
              {abaAtiva === "hotmart" && hotmart.data && daily.data && sources.data && (
                <PainelHotmart hotmart={hotmart.data.data} daily={daily.data.data} fontes={sources.data.data} />
              )}
            </Corpo>
          </Surface>
        </div>
      )}
    </section>
  );
}
