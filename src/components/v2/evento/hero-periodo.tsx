"use client";

import type { CSSProperties } from "react";
import { cx } from "../ui/cx";
import { useEvento } from "./contexto";

/** "2026-09-25" -> Date ao meio-dia local, para o fuso nunca empurrar o dia. */
const data = (iso: string) => new Date(`${iso}T12:00:00`);

/** Dias do período, contando os dois extremos. */
const diasDoPeriodo = (inicio: string, fim: string) => Math.round((data(fim).getTime() - data(inicio).getTime()) / 86_400_000) + 1;

/** Dias de hoje até o início do evento; null sem data de início, 0 se já começou ou é hoje. */
export function diasParaOEvento(inicio: string | null | undefined, hoje: string): number | null {
  if (!inicio) return null;
  return Math.max(0, Math.round((data(inicio).getTime() - data(hoje).getTime()) / 86_400_000));
}

/**
 * Linha sob o título: contagem regressiva e duração do evento. Eventos sem data de início
 * (criados antes do assistente) mostram "--" no contador: espaço reservado, nunca um número inventado.
 * Com o evento em andamento, o contador vira "Em andamento". O ponto latão é o dado vivo.
 */
export function LinhaDoEvento({ ativo, className, style }: { ativo: boolean; className?: string; style?: CSSProperties }) {
  const { periodo, filter, hoje } = useEvento();
  // A duração é a do evento quando ele tem período configurado; senão, a do período que está na tela.
  const dias = filter.start_date && filter.end_date ? diasDoPeriodo(filter.start_date, filter.end_date) : diasDoPeriodo(periodo.startDate, periodo.endDate);
  const encerrado = !!filter.end_date && filter.end_date < hoje;
  const faltam = diasParaOEvento(filter.start_date, hoje);

  return (
    <p className={cx("flex flex-wrap items-center gap-x-5 gap-y-1 text-base text-v2-nevoa/70", className)} style={style}>
      <span className="inline-flex items-center gap-2.5">
        <span aria-hidden="true" className="relative flex size-2.5">
          {ativo ? <span className="v2-hero-pulso absolute inset-0 rounded-full bg-v2-ponto" /> : null}
          <span className={cx("relative size-2.5 rounded-full", ativo ? "bg-v2-ponto shadow-v2-brilho-ponto" : "bg-v2-ardosia")} />
        </span>
        <span data-contagem className="tabular-nums">
          {encerrado || faltam === 0 ? (
            <span className="text-lg font-medium text-v2-nevoa">{encerrado ? "Evento encerrado" : "Em andamento"}</span>
          ) : (
            <>
              <span className="text-lg font-medium text-v2-nevoa">{faltam ?? "--"}</span> {faltam === 1 ? "dia" : "dias"} para o evento
            </>
          )}
        </span>
      </span>
      <span className="text-sm text-v2-azul-luz tabular-nums">{dias} dias de evento</span>
    </p>
  );
}
