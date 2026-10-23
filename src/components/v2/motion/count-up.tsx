"use client";

import { useEffect, useRef } from "react";
import { durDesenho, easeDesenho } from "./variants";
import { usePerfilMovimento } from "./use-perfil-movimento";
import { useReducedMotion } from "./use-reduced-motion";
import { useVisto } from "./use-visto";

type Props = {
  value: number;
  from?: number;
  format?: (n: number) => string;
  className?: string;
  /** Segundos de espera antes da primeira contagem, para casar com a entrada do card que a contém. */
  atraso?: number;
};

const defaultFormat = (n: number) => Math.round(n).toLocaleString("pt-BR");

/**
 * Número que conta até `value`. Escreve direto no DOM (sem re-render por quadro).
 * Com prefers-reduced-motion mostra o valor final na hora.
 */
export function CountUp({ value, from = 0, format = defaultFormat, className, atraso = 0 }: Props) {
  const reduced = useReducedMotion();
  const perfil = usePerfilMovimento();
  const { ref, visto } = useVisto<HTMLSpanElement>();
  const last = useRef(from);
  const jaContou = useRef(false);
  // Em ref para o perfil, que se corrige logo após a hidratação, não reiniciar uma contagem em curso.
  const perfilRef = useRef(perfil);
  useEffect(() => {
    perfilRef.current = perfil;
  }, [perfil]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      el.textContent = format(value);
      last.current = value;
      return;
    }
    // A primeira contagem espera o número entrar na tela e vai até 1,4 s (0,7 s em aparelho fraco);
    // as seguintes, de um valor a outro depois de um filtro, levam 0,38 s.
    if (!visto) return;
    const espera = jaContou.current ? 0 : atraso;
    const duracao = jaContou.current ? durDesenho.filtro : perfilRef.current === "curto" ? durDesenho.contagem / 2 : durDesenho.contagem;
    jaContou.current = true;
    // `animate` do Motion só carrega quando há número para contar: fica fora do JS inicial da rota.
    let controls: { stop: () => void } | undefined;
    let cancelado = false;
    void import("motion/react").then(({ animate }) => {
      if (cancelado) return;
      controls = animate(last.current, value, {
        duration: duracao,
        delay: espera,
        ease: easeDesenho,
        onUpdate: (n) => {
          last.current = n;
          el.textContent = format(n);
        },
      });
    });
    return () => {
      cancelado = true;
      controls?.stop();
    };
  }, [value, reduced, format, visto, ref, atraso]);

  return (
    <span ref={ref} className={className} aria-label={format(value)}>
      {reduced ? format(value) : format(from)}
    </span>
  );
}
