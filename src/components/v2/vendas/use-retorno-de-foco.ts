"use client";

import { useState } from "react";

/**
 * O Dialog do Radix só devolve o foco a um DialogTrigger. Os modais do Relatório de Vendas abrem
 * por estado (sem trigger), então guardamos o elemento que tinha o foco na abertura e o
 * devolvemos ao fechar. Chame no corpo do modal: o primeiro render acontece logo após o clique.
 */
export function useRetornoDeFoco() {
  const [origem] = useState<Element | null>(() =>
    typeof document === "undefined" ? null : document.activeElement,
  );
  return (e: Event) => {
    e.preventDefault();
    if (origem instanceof HTMLElement && origem.isConnected) origem.focus();
  };
}
