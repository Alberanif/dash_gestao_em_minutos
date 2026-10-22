"use client";

import { AnimatePresence, m } from "motion/react";
import { fadeRise, instantaneo } from "./variants";
import { useReducedMotion } from "./use-reduced-motion";

type Props = {
  /** Muda quando o filtro muda; a troca de chave dispara a saída e a entrada. */
  filtroKey: string;
  children: React.ReactNode;
  className?: string;
};

/** Transição de conteúdo na troca de filtro: opacity e translateY, nada além disso. */
export function FilterTransition({ filtroKey, children, className }: Props) {
  const reduced = useReducedMotion();
  const variants = reduced ? instantaneo : fadeRise;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={filtroKey}
        className={className}
        variants={variants}
        initial="oculto"
        animate="visivel"
        exit="saindo"
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}
