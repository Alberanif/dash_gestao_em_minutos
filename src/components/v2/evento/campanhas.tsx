"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { GlobalMetrics, MetaCampaignRow, MetaCampaignsResponse } from "@/types/indicadores";
import { cx, foco } from "../ui/cx";
import { Esqueleto } from "./bloco";
import { useEvento } from "./contexto";
import { fmtBRL, fmtNum, fmtPct } from "./format";
import { Segmentado } from "./segmentado";

export type Criterio = "cpl" | "leads" | "gasto" | "ctr";

type Definicao = {
  label: string;
  /** Quando menor é melhor (custo), a melhor campanha é a de valor mais baixo. */
  menorMelhor: boolean;
  valor: (m: GlobalMetrics) => number | null;
  fmt: (n: number) => string;
};

export const CRITERIOS: Record<Criterio, Definicao> = {
  cpl: { label: "Custo por lead", menorMelhor: true, valor: (m) => m.meta_cpl_traffic, fmt: fmtBRL },
  leads: { label: "Leads", menorMelhor: false, valor: (m) => m.meta_leads, fmt: fmtNum },
  gasto: { label: "Investimento", menorMelhor: false, valor: (m) => m.meta_spend, fmt: fmtBRL },
  ctr: { label: "CTR", menorMelhor: false, valor: (m) => m.meta_ctr, fmt: fmtPct },
};

export const ORDEM: Criterio[] = ["cpl", "leads", "gasto", "ctr"];
/** No ranking por custo por lead, campanha com menos que isso do investimento total não entra: 1 lead barato não é resultado. */
/** O modal usa o Radix Dialog; só é baixado quando alguém pede a lista completa. */
const ModalCampanhas = dynamic(() => import("./campanhas-modal").then((m) => m.ModalCampanhas), { ssr: false });

const GASTO_MINIMO = 0.05;
const LINHAS_INICIAIS = 5;

const fmtParte = (p: number) => `${(p * 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;

/** Média do evento para o critério: a do total, ou o total dividido pelas campanhas quando o critério é uma soma. */
function mediaDo(c: Criterio, total: GlobalMetrics, n: number): number | null {
  if (c === "leads") return n > 0 ? total.meta_leads / n : null;
  if (c === "gasto") return n > 0 ? total.meta_spend / n : null;
  return CRITERIOS[c].valor(total);
}

type Comparacao = { texto: string; melhor: boolean } | null;

function comparar(valor: number | null, media: number | null, menorMelhor: boolean): Comparacao {
  if (valor === null || media === null || media <= 0) return null;
  const pct = (valor - media) / media;
  if (Math.abs(pct) < 0.01) return { texto: "Na média do evento", melhor: false };
  const abaixo = pct < 0;
  return {
    texto: `${Math.round(Math.abs(pct) * 100)}% ${abaixo ? "abaixo" : "acima"} da média`,
    melhor: menorMelhor ? abaixo : !abaixo,
  };
}

export function Posicao({ n, destaque }: { n: number; destaque: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "grid size-6 shrink-0 place-items-center rounded-full text-xs font-medium tabular-nums",
        destaque ? "bg-v2-azul-luz text-v2-abismo" : "ring-1 ring-inset ring-v2-azul-luz/30 text-v2-nevoa/70",
      )}
    >
      {n}
    </span>
  );
}

/** Selo da comparação com a média: azul-luz quando é melhor, neutro quando não. Sem vermelho. */
function Selo({ comparacao }: { comparacao: Comparacao }) {
  if (!comparacao) return null;
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs",
        comparacao.melhor ? "bg-v2-azul-luz/15 text-v2-azul-luz" : "bg-v2-nevoa/10 text-v2-nevoa/70",
      )}
    >
      <svg viewBox="0 0 8 8" aria-hidden="true" className="size-2 shrink-0 fill-current">
        {comparacao.melhor ? <path d="M4 0l4 6H0z" /> : <circle cx="4" cy="4" r="3" />}
      </svg>
      <span className="truncate">{comparacao.texto}</span>
    </span>
  );
}

function Destaque({
  campanha,
  posicao,
  criterio,
  media,
  gastoTotal,
}: {
  campanha: MetaCampaignRow;
  posicao: number;
  criterio: Criterio;
  media: number | null;
  gastoTotal: number;
}) {
  const def = CRITERIOS[criterio];
  const valor = def.valor(campanha);
  const parte = gastoTotal > 0 ? campanha.meta_spend / gastoTotal : 0;
  const apoio = ORDEM.filter((c) => c !== criterio);
  return (
    <li
      className="v2-g v2-camp-surge relative flex min-w-0 flex-col gap-3 rounded-v2-sm bg-v2-abismo/50 p-4 ring-1 ring-inset ring-v2-azul-luz/15"
      style={{ "--i": posicao - 1 } as React.CSSProperties}
    >
      <div className="flex items-start gap-2.5">
        <Posicao n={posicao} destaque={posicao === 1} />
        <h4 className="line-clamp-2 min-w-0 break-words text-sm font-medium leading-snug" title={campanha.campaign_name}>
          {campanha.campaign_name}
        </h4>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-v2-nevoa/60">{def.label}</p>
        <p className="whitespace-nowrap text-2xl font-light tabular-nums">{valor === null ? "—" : def.fmt(valor)}</p>
      </div>
      <Selo comparacao={comparar(valor, media, def.menorMelhor)} />
      <div>
        <div className="h-1 overflow-hidden rounded-full bg-v2-nevoa/10">
          <div
            className="v2-g v2-camp-barra h-full rounded-full"
            style={{ width: `${Math.max(2, parte * 100)}%`, background: "var(--plat)", "--i": posicao - 1 } as React.CSSProperties}
          />
        </div>
        <p className="mt-1 text-xs text-v2-nevoa/60">{fmtParte(parte)} do investimento</p>
      </div>
      <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-v2-azul-luz/10 pt-3">
        {apoio.map((c) => {
          const v = CRITERIOS[c].valor(campanha);
          return (
            <div key={c} className="min-w-0">
              <dt className="truncate text-xs text-v2-nevoa/50" title={CRITERIOS[c].label}>
                {CRITERIOS[c].label}
              </dt>
              <dd className="truncate text-xs tabular-nums" title={v === null ? "—" : CRITERIOS[c].fmt(v)}>
                {v === null ? "—" : CRITERIOS[c].fmt(v)}
              </dd>
            </div>
          );
        })}
      </dl>
    </li>
  );
}

export function Linha({
  campanha,
  posicao,
  indice,
  criterio,
  proporcao,
}: {
  campanha: MetaCampaignRow;
  /** Posição no ranking; nulo para campanha que ficou fora dele. */
  posicao: number | null;
  /** Ordem de entrada na tela, para escalonar a animação. */
  indice: number;
  criterio: Criterio;
  /** 0 a 1; barra cheia é a melhor do ranking. */
  proporcao: number;
}) {
  const def = CRITERIOS[criterio];
  const valor = def.valor(campanha);
  return (
    <li className="v2-g v2-camp-surge flex min-w-0 items-start gap-2.5 py-2.5" style={{ "--i": Math.min(indice, 8) } as React.CSSProperties}>
      {posicao === null ? <span aria-hidden="true" className="size-6 shrink-0" /> : <Posicao n={posicao} destaque={false} />}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-sm text-v2-nevoa/80" title={campanha.campaign_name}>
            {campanha.campaign_name}
          </span>
          <span className="shrink-0 whitespace-nowrap text-sm tabular-nums">{valor === null ? "—" : def.fmt(valor)}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-v2-nevoa/10">
          <div
            className="v2-g v2-camp-barra h-full rounded-full"
            style={{ width: `${Math.max(2, proporcao * 100)}%`, background: "var(--plat)", opacity: 0.8, "--i": Math.min(indice, 8) } as React.CSSProperties}
          />
        </div>
      </div>
    </li>
  );
}

function Ranking({ dados }: { dados: MetaCampaignsResponse }) {
  const [criterio, setCriterio] = useState<Criterio>("cpl");
  const [modalAberto, setModalAberto] = useState(false);
  const def = CRITERIOS[criterio];
  const gastoTotal = dados.total.meta_spend;

  const { ranking, fora } = useMemo(() => {
    const elegiveis = dados.campaigns.filter((c) => {
      const v = def.valor(c);
      if (v === null) return false;
      return criterio === "cpl" ? c.meta_leads > 0 && gastoTotal > 0 && c.meta_spend / gastoTotal >= GASTO_MINIMO : true;
    });
    const ordenadas = [...elegiveis].sort((a, b) => {
      const d = (def.valor(a) ?? 0) - (def.valor(b) ?? 0);
      return def.menorMelhor ? d : -d;
    });
    return { ranking: ordenadas, fora: dados.campaigns.length - ordenadas.length };
  }, [dados.campaigns, criterio, def, gastoTotal]);

  const media = mediaDo(criterio, dados.total, dados.campaigns.length);
  const destaques = ranking.slice(0, 3);
  const resto = ranking.slice(3);
  const visiveis = resto.slice(0, LINHAS_INICIAIS);

  const melhor = ranking.length > 0 ? (def.valor(ranking[0]) ?? 0) : 0;
  const maior = ranking.reduce((m, c) => Math.max(m, def.valor(c) ?? 0), 0);
  const proporcao = (c: MetaCampaignRow) => {
    const v = def.valor(c) ?? 0;
    if (def.menorMelhor) return v > 0 ? melhor / v : 1;
    return maior > 0 ? v / maior : 0;
  };

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3 className="text-sm font-medium">Campanhas com melhor resultado</h3>
        <Segmentado
          rotulo="Ordenar campanhas por"
          idPainel="painel-campanhas"
          valor={criterio}
          onChange={(c) => {
            setCriterio(c);
          }}
          opcoes={ORDEM.map((c) => ({ value: c, label: CRITERIOS[c].label }))}
        />
      </div>
      {/* key: ao trocar o critério o painel remonta e a entrada se repete, o que mostra a reordenação. */}
      <div id="painel-campanhas" role="tabpanel" aria-label={def.label} key={criterio} className="mt-4">
        {ranking.length === 0 ? (
          <p className="text-sm text-v2-nevoa/70">Nenhuma campanha atende a este critério no período.</p>
        ) : (
          <>
            <ol className="grid grid-cols-1 gap-3 @2xl:grid-cols-3">
              {destaques.map((c, i) => (
                <Destaque key={c.campaign_id} campanha={c} posicao={i + 1} criterio={criterio} media={media} gastoTotal={gastoTotal} />
              ))}
            </ol>
            {visiveis.length > 0 ? (
              <ol start={4} className="mt-4 divide-y divide-v2-azul-luz/10 border-t border-v2-azul-luz/10">
                {visiveis.map((c, i) => (
                  <Linha key={c.campaign_id} campanha={c} posicao={i + 4} indice={i} criterio={criterio} proporcao={proporcao(c)} />
                ))}
              </ol>
            ) : null}
            {resto.length > LINHAS_INICIAIS ? (
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setModalAberto(true)}
                className={cx("mt-2 h-8 rounded-v2-sm px-3 text-sm text-v2-azul-luz hover:bg-v2-azul-luz/10", foco)}
              >
                {`Ver todas as ${dados.campaigns.length} campanhas`}
              </button>
            ) : null}
          </>
        )}
        <p className="mt-3 text-xs text-v2-nevoa/50">
          {criterio === "cpl"
            ? `Só entram campanhas com ao menos ${GASTO_MINIMO * 100}% do investimento e algum lead.${fora > 0 ? ` ${fora} ficaram de fora.` : ""} `
            : ""}
          Barra cheia é a melhor do ranking.
          {dados.hidden_zero_spend > 0 ? ` ${dados.hidden_zero_spend} sem investimento no período não aparecem.` : ""}
        </p>
      </div>
      {modalAberto ? (
        <ModalCampanhas
          aberto
          onFechar={() => setModalAberto(false)}
          criterio={criterio}
          ranking={ranking}
          fora={dados.campaigns.filter((c) => !ranking.includes(c))}
        />
      ) : null}
    </div>
  );
}

/** Campanhas do Meta Ads: as melhores em destaque, pelo critério que o gestor escolher. */
export function Campanhas() {
  const { consulta } = useEvento();
  const campanhas = useQuery({
    queryKey: ["campaigns", consulta.chave],
    queryFn: async ({ signal }) => {
      const r = await fetch(`/api/indicadores/campaigns${consulta.params}`, { signal });
      if (!r.ok) throw new Error(`API error ${r.status}`);
      return (await r.json()) as MetaCampaignsResponse;
    },
  });
  if (campanhas.isPending) return <Esqueleto className="h-48 w-full" />;
  if (campanhas.isError) return <p className="text-sm text-v2-nevoa/70">Não foi possível carregar as campanhas.</p>;
  if (campanhas.data.campaigns.length === 0) return <p className="text-sm text-v2-nevoa/70">Nenhuma campanha com investimento no período.</p>;
  return <Ranking dados={campanhas.data} />;
}
