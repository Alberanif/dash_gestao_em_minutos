"use client";

import { useEffect, useRef } from "react";
import { animate } from "motion/react";
import { easeSaida, dur } from "./variants";
import { useReducedMotion } from "./use-reduced-motion";

type Props = {
  value: number;
  from?: number;
  format?: (n: number) => string;
  className?: string;
};

const defaultFormat = (n: number) => Math.round(n).toLocaleString("pt-BR");

/**
 * Número que conta até `value`. Escreve direto no DOM (sem re-render por quadro).
 * Com prefers-reduced-motion mostra o valor final na hora.
 */
export function CountUp({ value, from = 0, format = defaultFormat, className }: Props) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const last = useRef(from);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      el.textContent = format(value);
      last.current = value;
      return;
    }
    const controls = animate(last.current, value, {
      duration: dur.lenta * 2,
      ease: easeSaida,
      onUpdate: (n) => {
        last.current = n;
        el.textContent = format(n);
      },
    });
    return () => controls.stop();
  }, [value, reduced, format]);

  return (
    <span ref={ref} className={className} aria-label={format(value)}>
      {reduced ? format(value) : format(from)}
    </span>
  );
}
