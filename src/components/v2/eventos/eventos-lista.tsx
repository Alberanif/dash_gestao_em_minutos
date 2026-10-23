"use client";

import Link from "next/link";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import type { FilterRecord, FilterStatus } from "@/types/indicadores";
import {
  eventoCompositionSubtitle,
  eventoMetaLine,
  groupFiltersByStatus,
  matchesEventoSearch,
  statusSummaryCounts,
} from "@/lib/indicadores/eventos";
import { Button, Surface } from "../ui";
import { cx, foco } from "../ui/cx";
import { PASTAS, PASTAS_RECOLHIDAS_INICIAL, hrefDoEvento, type PastaConfig } from "./pastas";

type Props = {
  filters: FilterRecord[];
  /** Métricas de cada evento, já em Suspense no servidor: id do evento -> conteúdo. */
  metricas: Record<string, ReactNode>;
};

export function EventosLista({ filters, metricas }: Props) {
  const [busca, setBusca] = useState("");
  const [recolhidas, setRecolhidas] = useState(PASTAS_RECOLHIDAS_INICIAL);
  const idBusca = useId();

  const buscando = busca.trim() !== "";
  const visiveis = filters.filter((f) => matchesEventoSearch(f, busca));
  const grupos = groupFiltersByStatus(visiveis);
  const contagem = statusSummaryCounts(filters);

  return (
    <div className="mt-2 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-light tracking-tight">Eventos</h2>
          <p className="mt-1 text-sm text-v2-nevoa/60">Organizados por pasta.</p>
        </div>
        <div className="w-full @md:w-72">
          <label htmlFor={idBusca} className="sr-only">
            Buscar evento
          </label>
          <input
            id={idBusca}
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar evento"
            autoComplete="off"
            className={cx(
              "h-10 w-full rounded-v2-sm bg-v2-casco px-3 text-sm text-v2-nevoa shadow-v2-1 ring-1 ring-inset ring-v2-azul-luz/15",
              "placeholder:text-v2-nevoa/40",
              foco,
            )}
          />
        </div>
      </div>

      <ul className="grid grid-cols-3 gap-3" aria-label="Resumo por status">
        {PASTAS.map((pasta) => (
          <li key={pasta.status}>
            <Surface className="flex h-full flex-col gap-1 p-4">
              <span className="flex items-center gap-2 text-sm text-v2-nevoa/70">
                <span aria-hidden="true" className={cx("size-2 shrink-0 rounded-full", pasta.marcador)} />
                {pasta.rotuloResumo}
              </span>
              <span className="text-3xl font-light leading-none">{contagem[pasta.status]}</span>
            </Surface>
          </li>
        ))}
      </ul>

      {buscando && visiveis.length === 0 ? (
        <Surface className="max-w-xl" role="status">
          <h3 className="text-lg font-semibold">Nenhum evento com “{busca.trim()}”</h3>
          <p className="mt-2 text-sm text-v2-nevoa/70">Confira a grafia ou limpe a busca para ver todos os eventos.</p>
          <Button variante="secundario" className="mt-4" onClick={() => setBusca("")}>
            Limpar busca
          </Button>
        </Surface>
      ) : (
        <div className="space-y-6">
          {PASTAS.map((pasta) => (
            <Pasta
              key={pasta.status}
              pasta={pasta}
              eventos={grupos[pasta.status]}
              metricas={metricas}
              aberta={buscando ? true : !recolhidas[pasta.status]}
              buscando={buscando}
              onAlternar={() => setRecolhidas((prev) => alternar(prev, pasta.status))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function alternar(prev: Record<FilterStatus, boolean>, status: FilterStatus) {
  return { ...prev, [status]: !prev[status] };
}

type PastaProps = {
  pasta: PastaConfig;
  eventos: FilterRecord[];
  metricas: Record<string, ReactNode>;
  aberta: boolean;
  buscando: boolean;
  onAlternar: () => void;
};

function Pasta({ pasta, eventos, metricas, aberta, buscando, onAlternar }: PastaProps) {
  const id = useId();
  const idConteudo = `${id}-conteudo`;

  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-base font-semibold">
        <button
          type="button"
          aria-expanded={aberta}
          aria-controls={idConteudo}
          onClick={onAlternar}
          className={cx("flex w-full items-center gap-3 rounded-v2-sm py-2 text-left", foco)}
        >
          <span aria-hidden="true" className={cx("size-2.5 shrink-0 rounded-full", pasta.marcador)} />
          <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3">
            <span>{pasta.nome}</span>
            <span className="text-sm font-normal text-v2-nevoa/60">{pasta.descricao}</span>
          </span>
          <span className="shrink-0 rounded-full bg-v2-casco-alto px-2.5 py-0.5 text-xs font-medium">{eventos.length}</span>
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cx("shrink-0 transition-transform duration-[240ms]", aberta ? "rotate-180" : "rotate-0")}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </h3>

      <div id={idConteudo} hidden={!aberta} className="mt-3">
        {aberta &&
          (eventos.length === 0 ? (
            <p className="py-1 text-sm text-v2-nevoa/50">
              {buscando ? "Nenhum evento encontrado nesta pasta." : "Nenhum evento nesta pasta."}
            </p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {eventos.map((evento, i) => (
                <li key={evento.id} className="v2-entra" style={{ "--i": Math.min(i, 8) } as CSSProperties}>
                  <CartaoEvento evento={evento} pasta={pasta} metricas={metricas[evento.id]} />
                </li>
              ))}
            </ul>
          ))}
      </div>
    </section>
  );
}

function CartaoEvento({ evento, pasta, metricas }: { evento: FilterRecord; pasta: PastaConfig; metricas: ReactNode }) {
  const cancelado = evento.status === "cancelado";
  const composicao = eventoCompositionSubtitle(evento);

  return (
    <article
      data-testid={`evento-card-${evento.id}`}
      className={cx(
        "group relative flex h-full flex-col rounded-v2-md bg-v2-casco p-5 shadow-v2-1 ring-1 ring-inset ring-v2-azul-luz/15",
        "transition-transform duration-[240ms] hover:-translate-y-0.5",
        // Brilho azul numa camada própria: só a opacidade anima.
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-v2-md before:opacity-0 before:shadow-v2-brilho-azul before:transition-opacity before:duration-[240ms] hover:before:opacity-100",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-v2-azul-luz",
        cancelado && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span aria-hidden="true" className={cx("mt-1.5 size-2 shrink-0 rounded-full", pasta.marcador)} />
        <div className="min-w-0">
          <h4 className="truncate text-base font-semibold leading-snug">
            <Link
              href={hrefDoEvento(evento.id)}
              className="outline-none after:absolute after:inset-0 after:z-10 after:rounded-v2-md"
            >
              {evento.name}
            </Link>
          </h4>
          {composicao && <p className="mt-0.5 text-sm text-v2-nevoa/60">{composicao}</p>}
        </div>
      </div>

      {metricas}

      <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-sm">
        <span className="min-w-0 truncate text-v2-nevoa/60">{eventoMetaLine(evento)}</span>
        <span className="shrink-0 font-medium text-v2-azul-luz" aria-hidden="true">
          {cancelado ? "Ver dashboard" : "Abrir dashboard"}
        </span>
      </div>
    </article>
  );
}
