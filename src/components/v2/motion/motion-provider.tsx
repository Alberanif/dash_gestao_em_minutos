"use client";

import { LazyMotion, domAnimation } from "motion/react";

/** Carrega só os recursos de animação de DOM do Motion (bundle menor que o `motion` completo). */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <LazyMotion features={domAnimation}>{children}</LazyMotion>;
}
