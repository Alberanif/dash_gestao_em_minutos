"use client";

import React, { useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Fonte } from "@/lib/indicadores/dashboard-evento";
import { Button } from "../ui/button";
import { Surface } from "../ui/surface";
import { cx } from "../ui/cx";

/** O brilho azul que atravessa o esqueleto vem do `.v2-esq` (ui.css): só transform, e parado com movimento reduzido. */
export const esqueleto = "v2-esq rounded-v2-sm bg-v2-casco-alto/60";

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cx(esqueleto, className)} aria-hidden="true" />;
}

export type FormaEsqueleto = "linha" | "barras" | "rosca" | "funil" | "fluxo";

const LARGURAS_BARRAS = ["86%", "64%", "48%", "34%", "22%"];
const LARGURAS_FUNIL = ["100%", "72%", "50%", "32%"];

/**
 * Esqueleto com a forma do gráfico que vai chegar: grade e eixo para a linha, trilhos para as barras,
 * anel para a rosca, degraus para o funil. Os eixos já estão no lugar, então o traçado nasce sobre eles.
 */
export function EsqueletoGrafico({ forma, className }: { forma: FormaEsqueleto; className?: string }) {
  return (
    <div aria-hidden="true" className={cx("v2-esq rounded-v2-sm bg-v2-casco-alto/30", className)}>
      {forma === "linha" ? (
        <div className="absolute inset-x-4 inset-y-5 flex flex-col justify-between">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={cx("h-px", i === 4 ? "bg-[var(--v2-eixo)]" : "bg-[var(--v2-grade)]")} />
          ))}
        </div>
      ) : null}
      {forma === "barras" ? (
        <div className="absolute inset-0 flex flex-col justify-center gap-3 px-4">
          {LARGURAS_BARRAS.map((w) => (
            <div key={w} className="h-3 rounded-full bg-v2-casco-alto/80" style={{ width: w }} />
          ))}
        </div>
      ) : null}
      {forma === "rosca" ? (
        <div className="absolute left-4 top-1/2 aspect-square h-[78%] max-h-56 -translate-y-1/2 rounded-full border-[14px] border-v2-casco-alto/80" />
      ) : null}
      {forma === "fluxo" ? (
        <div className="absolute inset-0 flex items-center gap-3 px-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <React.Fragment key={i}>
              {i > 0 ? <div className="h-px w-6 shrink-0 bg-[var(--v2-eixo)]" /> : null}
              <div className="h-24 min-w-0 flex-1 rounded-v2-sm bg-v2-casco-alto/80" />
            </React.Fragment>
          ))}
        </div>
      ) : null}
      {forma === "funil" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
          {LARGURAS_FUNIL.map((w) => (
            <div key={w} className="h-6 rounded-[4px] bg-v2-casco-alto/80" style={{ width: w }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CabecalhoSecao({ titulo, descricao, id }: { titulo: string; descricao: string; id?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 id={id} className="text-base font-semibold tracking-tight">
        {titulo}
      </h2>
      <p className="text-xs text-v2-nevoa/60">{descricao}</p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Consulta = UseQueryResult<Fonte<any>, Error>;

/**
 * Estado de um bloco que depende de uma ou mais fontes: esqueleto no primeiro
 * carregamento, erro com nova tentativa, e — com dado na tela — o conteúdo animado
 * a cada troca de filtro, esmaecido enquanto o dado novo não chega.
 */
export function Corpo({
  consultas,
  esqueletoAltura = "h-40",
  formas,
  ordem = 0,
  children,
}: {
  consultas: Consulta[];
  esqueletoAltura?: string;
  /** Formas dos gráficos do bloco, lado a lado em tela larga. Sem elas, um retângulo. */
  formas?: FormaEsqueleto[];
  /** Posição do bloco na página: na primeira entrada, cada bloco espera 140 ms a mais que o anterior. */
  ordem?: number;
  children: React.ReactNode;
}) {
  const semDado = consultas.some((c) => c.data === undefined);
  const chave = consultas.map((c) => c.data?.chave ?? "").join("#");
  // "Ajustar estado durante a renderização": a primeira chave com dado é a entrada; as seguintes são troca de filtro.
  const [estado, setEstado] = useState<{ chave: string | null; trocou: boolean }>({ chave: null, trocou: false });
  if (!semDado && estado.chave !== chave) setEstado({ chave, trocou: estado.chave !== null });
  if (semDado) {
    const erro = consultas.find((c) => c.isError);
    if (erro) {
      return (
        <Surface role="alert" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-v2-nevoa/80">Não foi possível carregar este bloco.</p>
          <Button variante="secundario" onClick={() => consultas.filter((c) => c.isError).forEach((c) => void c.refetch())}>
            Tentar de novo
          </Button>
        </Surface>
      );
    }
    if (formas?.length) {
      return (
        <div className={cx("grid w-full auto-rows-fr gap-4 @3xl:grid-flow-col @3xl:auto-cols-fr", esqueletoAltura)} aria-hidden="true">
          {formas.map((f) => (
            <EsqueletoGrafico key={f} forma={f} className="h-full w-full" />
          ))}
        </div>
      );
    }
    return <Esqueleto className={cx("w-full", esqueletoAltura)} />;
  }

  const atualizando = consultas.some((c) => c.isPlaceholderData);
  return (
    <div
      aria-busy={atualizando}
      className={cx("transition-opacity duration-[120ms]", atualizando && "opacity-60")}
    >
      {/* A troca de chave remonta o conteúdo e reaplica a entrada em CSS (opacity e transform).
          O FilterTransition do Motion faria o mesmo por 48 KB de JS, que a rota não comporta.
          Primeira entrada: lenta e escalonada entre os blocos. Troca de filtro: a entrada curta de sempre. */}
      <div
        key={chave}
        data-troca={estado.trocou ? "" : undefined}
        className={estado.trocou ? "v2-entra" : "v2-entra-bloco"}
        style={estado.trocou ? undefined : ({ "--i": ordem } as React.CSSProperties)}
      >
        {children}
      </div>
    </div>
  );
}
