"use client";

import { useMemo, useState } from "react";
import type { MetaCampaignRow } from "@/types/indicadores";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { cx, foco } from "../ui/cx";
import { fmtNum } from "./format";
import { CRITERIOS, Posicao, type Criterio } from "./campanhas";

const POR_PAGINA = 8;

type Coluna = { chave: string; label: string; criterio?: Criterio; valor: (c: MetaCampaignRow) => string };

/** KPIs na frente de cada campanha. As colunas que são critério de ordenação ganham destaque quando ativas. */
const COLUNAS: Coluna[] = [
  { chave: "gasto", label: "Investimento", criterio: "gasto", valor: (c) => CRITERIOS.gasto.fmt(c.meta_spend) },
  { chave: "leads", label: "Leads", criterio: "leads", valor: (c) => fmtNum(c.meta_leads) },
  { chave: "cpl", label: "Custo por lead", criterio: "cpl", valor: (c) => (c.meta_cpl_traffic === null ? "—" : CRITERIOS.cpl.fmt(c.meta_cpl_traffic)) },
  { chave: "ctr", label: "CTR", criterio: "ctr", valor: (c) => CRITERIOS.ctr.fmt(c.meta_ctr) },
  { chave: "checkouts", label: "Checkouts", valor: (c) => fmtNum(c.meta_checkout) },
];

/** Posição, nome e KPIs lado a lado a partir de 672 px; abaixo disso o nome ocupa a linha e os KPIs vão numa grade de rótulos. */
const GRADE = "@2xl:grid-cols-[1.5rem_minmax(0,1fr)_repeat(5,minmax(5.5rem,auto))]";

/** Minúsculas e sem acento, para "promocao" achar "Promoção". */
const normalizar = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const botaoPagina = cx(
  "h-8 rounded-v2-sm px-3 text-sm text-v2-azul-luz hover:bg-v2-azul-luz/10 disabled:pointer-events-none disabled:opacity-40",
  foco,
);

/**
 * Lista completa das campanhas, no critério escolhido, com busca por termo em comum e paginação.
 * A busca exige que todas as palavras digitadas apareçam no nome, em qualquer ordem.
 */
export function ModalCampanhas({
  aberto,
  onFechar,
  criterio,
  ranking,
  fora,
}: {
  aberto: boolean;
  onFechar: () => void;
  criterio: Criterio;
  ranking: MetaCampaignRow[];
  /** Campanhas que não entraram no ranking do critério; aparecem depois, sem posição. */
  fora: MetaCampaignRow[];
}) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);

  const itens = useMemo(() => [...ranking.map((c, i) => ({ c, posicao: i + 1 as number | null })), ...fora.map((c) => ({ c, posicao: null }))], [ranking, fora]);
  const filtrados = useMemo(() => {
    const termos = normalizar(busca).split(/\s+/).filter(Boolean);
    if (termos.length === 0) return itens;
    return itens.filter(({ c }) => {
      const nome = normalizar(c.campaign_name);
      return termos.every((t) => nome.includes(t));
    });
  }, [itens, busca]);

  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const atual = Math.min(pagina, paginas - 1);
  const visiveis = filtrados.slice(atual * POR_PAGINA, (atual + 1) * POR_PAGINA);

  return (
    <Dialog open={aberto} onOpenChange={(v) => (v ? undefined : onFechar())}>
      <DialogContent className="flex max-h-[min(90dvh,48rem)] w-[min(68rem,calc(100vw-2rem))]! flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <DialogTitle className="text-lg font-medium">Todas as campanhas</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-v2-nevoa/60">Ordenadas por {CRITERIOS[criterio].label.toLowerCase()}.</DialogDescription>
          </div>
          <DialogClose className={cx("h-8 shrink-0 rounded-v2-sm px-3 text-sm text-v2-nevoa/70 hover:bg-v2-nevoa/10", foco)}>Fechar</DialogClose>
        </div>

        <label className="mt-4 block">
          <span className="sr-only">Buscar campanha por termo no nome</span>
          <input
            type="search"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(0);
            }}
            placeholder="Buscar por termo no nome, como remarketing ou lookalike"
            autoComplete="off"
            className={cx(
              "h-10 w-full rounded-v2-sm bg-v2-abismo/60 px-3 text-sm text-v2-nevoa placeholder:text-v2-nevoa/40 ring-1 ring-inset ring-v2-azul-luz/20",
              foco,
            )}
          />
        </label>
        <p aria-live="polite" className="mt-2 text-xs text-v2-nevoa/60">
          {busca.trim() ? `${filtrados.length} de ${itens.length} campanhas` : `${itens.length} campanhas`}
        </p>

        <div className="@container mt-2 flex min-h-0 flex-1 flex-col">
          {filtrados.length === 0 ? (
            <p className="py-8 text-center text-sm text-v2-nevoa/70">Nenhuma campanha tem “{busca.trim()}” no nome.</p>
          ) : (
            <>
              <div aria-hidden="true" className={cx("hidden gap-x-4 border-b border-v2-azul-luz/15 pb-2 pr-1 text-xs text-v2-nevoa/60 @2xl:grid", GRADE)}>
                <span />
                <span>Campanha</span>
                {COLUNAS.map((k) => (
                  <span key={k.chave} className="text-right">
                    {k.label}
                  </span>
                ))}
              </div>
              <ol className="min-h-0 flex-1 divide-y divide-v2-azul-luz/10 overflow-y-auto pr-1">
                {visiveis.map(({ c, posicao }, i) => (
                  <li
                    key={c.campaign_id}
                    className={cx("v2-g v2-camp-surge grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 py-3 @2xl:items-center @2xl:gap-x-4", GRADE)}
                    style={{ "--i": i } as React.CSSProperties}
                  >
                    {posicao === null ? <span aria-hidden="true" className="size-6" /> : <Posicao n={posicao} destaque={posicao <= 3} />}
                    <span className="line-clamp-2 min-w-0 break-words text-sm leading-snug" title={c.campaign_name}>
                      {c.campaign_name}
                    </span>
                    <dl className="col-span-2 grid grid-cols-3 gap-x-3 gap-y-2 @2xl:contents">
                      {COLUNAS.map((k) => {
                        const ativa = k.criterio === criterio;
                        return (
                          <div key={k.chave} className="min-w-0 @2xl:text-right">
                            <dt className="truncate text-xs text-v2-nevoa/50 @2xl:sr-only">{k.label}</dt>
                            <dd className={cx("truncate text-sm tabular-nums", ativa ? "font-medium text-v2-azul-luz" : "text-v2-nevoa/85")}>{k.valor(c)}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>

        {paginas > 1 ? (
          <nav aria-label="Paginação das campanhas" className="mt-3 flex items-center justify-between gap-3 border-t border-v2-azul-luz/10 pt-3">
            <button type="button" className={botaoPagina} disabled={atual === 0} onClick={() => setPagina(atual - 1)}>
              Anterior
            </button>
            <span className="text-sm tabular-nums text-v2-nevoa/70">
              Página {atual + 1} de {paginas}
            </span>
            <button type="button" className={botaoPagina} disabled={atual >= paginas - 1} onClick={() => setPagina(atual + 1)}>
              Próxima
            </button>
          </nav>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
