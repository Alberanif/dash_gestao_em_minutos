import type { ReactNode } from "react";
import type { FilterStatus } from "@/types/indicadores";
import { LinhaDoEvento } from "./hero-periodo";

/**
 * Cabeçalho do evento: uma faixa aberta sobre o fundo da página, sem moldura. O título é o único
 * elemento de destaque: nasce em branco pleno e a máscara horizontal o funde ao fundo (v2-titulo).
 * Uma cópia forte do texto some ao carregar (só opacity), então o título "se funde" diante de quem
 * abre a página; com movimento reduzido ou em aparelho fraco ele já nasce no estado final.
 * A barra de vidro com os controles fica logo abaixo da linha fina que fecha a faixa.
 */
export function HeroSlot({ nome, status, children }: { nome: string; status: FilterStatus; children: ReactNode }) {
  return (
    <header>
      <div className="v2-hero-faixa relative px-1 pb-10 pt-8 @xl:px-3 @xl:pb-14 @xl:pt-12">
        <h2 className="v2-titulo v2-g v2-hero-entra max-w-[22ch] [overflow-wrap:anywhere] text-[clamp(2.5rem,8cqi,6rem)] font-light leading-[1.05] tracking-tight" style={{ "--i": 0 } as React.CSSProperties}>
          <span className="v2-titulo-base">{nome}</span>
          <span aria-hidden="true" className="v2-titulo-forte">
            {nome}
          </span>
        </h2>
        <LinhaDoEvento ativo={status === "ativo"} className="v2-g v2-hero-entra mt-5" style={{ "--i": 1 } as React.CSSProperties} />
        <div aria-hidden="true" className="v2-hero-linha absolute inset-x-0 bottom-0 h-px" />
      </div>
      <div className="v2-g v2-hero-entra relative mt-6 rounded-v2-md v2-vidro p-3 @xl:p-4" style={{ "--i": 2 } as React.CSSProperties}>
        {children}
      </div>
    </header>
  );
}
