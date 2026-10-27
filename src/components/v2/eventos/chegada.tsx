"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Chegada em Eventos. Vindo do menu, a lista assenta de um pouco maior (v2-chega). Vindo do dashboard
 * (o botão Voltar deixa a marca data-v2-volta na página), ela assenta de um pouco menor: zoom out.
 */
export function ChegadaEventos({ children }: { children: ReactNode }) {
  useEffect(() => {
    const t = setTimeout(() => delete document.documentElement.dataset.v2Volta, 600);
    return () => clearTimeout(t);
  }, []);
  return <div className="v2-chega">{children}</div>;
}
