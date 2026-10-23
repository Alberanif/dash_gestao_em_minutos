"use client";

import dynamic from "next/dynamic";
import { cloneElement, useState } from "react";

// O Tooltip do Radix traz o floating-ui (~25 KB gzip) e a dica só aparece com o mouse em cima:
// o chunk sai do JS inicial e entra na primeira vez que o ponteiro chega a um item.
const TooltipCompleto = dynamic(() => import("../ui/tooltip").then((m) => m.Tooltip), { ssr: false });

type Props = {
  conteudo: React.ReactNode;
  children: React.ReactElement<{ onPointerEnter?: (e: React.PointerEvent<HTMLElement>) => void }>;
  lado?: "top" | "right" | "bottom" | "left";
};

/**
 * Mesmo contrato do Tooltip. Até o primeiro hover de mouse o filho é renderizado puro; ao
 * hover, troca para o Tooltip completo. Teclado e toque não trocam: o nome acessível dos itens
 * já está no texto (visível ou sr-only), e trocar com o foco no elemento o remontaria e o perderia.
 */
export function TooltipTardio({ conteudo, children, lado }: Props) {
  const [pronto, setPronto] = useState(false);
  if (pronto) {
    return (
      <TooltipCompleto conteudo={conteudo} lado={lado}>
        {children}
      </TooltipCompleto>
    );
  }
  return cloneElement(children, {
    onPointerEnter: (e: React.PointerEvent<HTMLElement>) => {
      children.props.onPointerEnter?.(e);
      if (e.pointerType === "mouse" && document.activeElement !== e.currentTarget) setPronto(true);
    },
  });
}
