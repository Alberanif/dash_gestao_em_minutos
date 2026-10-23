"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { Fonte } from "@/lib/indicadores/dashboard-evento";
import { Button } from "../ui/button";
import { Surface } from "../ui/surface";
import { cx } from "../ui/cx";

export const esqueleto = "rounded-v2-sm bg-v2-casco-alto/60 motion-safe:animate-pulse";

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cx(esqueleto, className)} aria-hidden="true" />;
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
  children,
}: {
  consultas: Consulta[];
  esqueletoAltura?: string;
  children: React.ReactNode;
}) {
  const semDado = consultas.some((c) => c.data === undefined);
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
    return <Esqueleto className={cx("w-full", esqueletoAltura)} />;
  }

  const atualizando = consultas.some((c) => c.isPlaceholderData);
  const chave = consultas.map((c) => c.data?.chave ?? "").join("#");
  return (
    <div
      aria-busy={atualizando}
      className={cx("transition-opacity duration-[120ms]", atualizando && "opacity-60")}
    >
      {/* A troca de chave remonta o conteúdo e reaplica a entrada em CSS (opacity e transform).
          O FilterTransition do Motion faria o mesmo por 48 KB de JS, que a rota não comporta. */}
      <div key={chave} className="v2-entra">
        {children}
      </div>
    </div>
  );
}
