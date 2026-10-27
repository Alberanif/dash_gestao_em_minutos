"use client";

import { createContext, useContext } from "react";
import type { PapelCentral } from "@/lib/central-de-links/papel";

const PapelContext = createContext<PapelCentral | null>(null);

/** O papel é calculado no servidor (layout) e chega aos componentes cliente por aqui. */
export function PapelProvider({ papel, children }: { papel: PapelCentral | null; children: React.ReactNode }) {
  return <PapelContext.Provider value={papel}>{children}</PapelContext.Provider>;
}

export function usePapelCentral(): PapelCentral | null {
  return useContext(PapelContext);
}
