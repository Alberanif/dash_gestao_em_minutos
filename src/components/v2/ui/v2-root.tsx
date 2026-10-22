"use client";

import { createContext, useContext, useState } from "react";

const PortalContext = createContext<HTMLElement | null>(null);

/**
 * Raiz `.v2` da aplicação. Expõe o próprio elemento como container dos portais do Radix,
 * para que popovers, dialogs e tooltips herdem os tokens e a fonte (que não existem no body).
 */
export function V2Root({ className, children }: { className?: string; children: React.ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  return (
    <div ref={setEl} className={className} style={{ minHeight: "100vh" }}>
      <PortalContext.Provider value={el}>{children}</PortalContext.Provider>
    </div>
  );
}

/** Container para `Portal`; fora da V2Root devolve undefined e o Radix usa o body. */
export function usePortalContainer(): HTMLElement | undefined {
  return useContext(PortalContext) ?? undefined;
}
