"use client";

import { m } from "motion/react";
import { usePathname } from "next/navigation";
import { fadeRise, instantaneo, useReducedMotion } from "../motion";

/**
 * Entrada animada da página na troca de rota: opacity e translateY.
 * Só entra (sem saída): no App Router o conteúdo da rota anterior já saiu quando a nova renderiza.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  return (
    <m.div
      key={pathname}
      variants={reduced ? instantaneo : fadeRise}
      initial="oculto"
      animate="visivel"
    >
      {children}
    </m.div>
  );
}
