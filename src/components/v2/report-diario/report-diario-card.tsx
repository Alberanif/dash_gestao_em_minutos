"use client";

import Link from "next/link";
import type { ReportFunil } from "@/lib/indicadores/report-diario-tipos";
import { CountUp } from "../motion/count-up";
import { SeloIcone } from "../evento/icones";
import { cx, foco } from "../ui/cx";

/** Altura mínima compartilhada pelo card e pelo skeleton: todos os cards do fluxo têm o mesmo tamanho. */
export const ALTURA_CARD_REPORT = "min-h-44";

const fmtNum = (v: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);
const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v);

/** CPL nunca é R$ 0: zero, negativo ou ausente viram "—". */
const cplValido = (v: number | null | undefined) => (v != null && Number.isFinite(v) && v > 0 ? v : null);

type Props = {
  /** null = a consulta deste funil falhou: o card mostra "indisponível" sem afetar os outros. */
  funil: ReportFunil | null;
  nome: string;
  /** Dashboard do evento. */
  href: string;
};

function Secundario({ rotulo, valor, formato }: { rotulo: string; valor: number | null; formato: (n: number) => string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-v2-nevoa/60">{rotulo}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium tabular-nums">
        {valor === null ? "—" : <CountUp value={valor} format={formato} />}
      </dd>
    </div>
  );
}

/**
 * Card de UM funil no fluxo do Report Diário, com os números de todo o período da ação até hoje.
 * Mesmo desenho dos cards da Jornada: selo redondo, filete colorido no topo, número em destaque.
 * O CPL é o herói (único âmbar do card); leads e investimento são secundários.
 * O card inteiro leva ao dashboard do evento.
 */
export function ReportDiarioCard({ funil, nome, href }: Props) {
  const periodo = funil?.periodo;
  const cpl = cplValido(periodo?.cpl);

  return (
    <article
      data-testid="report-diario-card"
      className={cx(
        "group relative flex h-full flex-col gap-3 overflow-hidden rounded-v2-md bg-v2-casco p-4 shadow-v2-1 ring-1 ring-inset ring-v2-azul-luz/15",
        ALTURA_CARD_REPORT,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: "linear-gradient(90deg, var(--v2-d-lead), transparent 85%)" }}
      />
      {/* Brilho no hover e no foco: só opacity. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-v2-md opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:duration-0"
        style={{ boxShadow: "inset 0 0 42px color-mix(in srgb, var(--v2-d-lead) 20%, transparent)" }}
      />

      <div className="flex items-center gap-3">
        <SeloIcone nome="leads" dado="lead" tamanho="sm" />
        <Titulo nome={nome} href={href} />
      </div>

      {funil === null ? (
        <div role="status" className="mt-auto">
          <p className="text-base font-light">Indisponível no momento</p>
          <p className="mt-1 text-xs text-v2-nevoa/70">Não foi possível ler os números deste funil.</p>
        </div>
      ) : (
        <>
          <div className="mt-auto">
            <p className="text-xs text-v2-nevoa/70">CPL do período</p>
            <p className="mt-0.5 text-3xl font-semibold leading-none tabular-nums tracking-tight text-v2-ponto" data-testid="cpl-periodo">
              {cpl === null ? "—" : <CountUp value={cpl} format={fmtBRL} />}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 border-t border-v2-azul-luz/10 pt-3">
            <Secundario rotulo="Leads" valor={periodo?.leads ?? null} formato={fmtNum} />
            <Secundario rotulo="Investimento" valor={periodo?.spend ?? null} formato={fmtBRL} />
          </dl>
        </>
      )}
    </article>
  );
}

/** Título do funil: o card inteiro é clicável pelo pseudo-elemento do link. */
function Titulo({ nome, href }: { nome: string; href: string }) {
  return (
    <h3 className="min-w-0 text-sm font-semibold leading-snug">
      <Link
        href={href}
        className={cx("inline-flex min-h-11 items-center rounded-v2-sm after:absolute after:inset-0 after:content-['']", foco)}
      >
        <span className="line-clamp-2">{nome}</span>
      </Link>
    </h3>
  );
}
