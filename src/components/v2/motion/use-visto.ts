"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const semAssinatura = () => () => {};
const semObservador = () => typeof IntersectionObserver === "undefined";
const nuncaNoServidor = () => false;

/**
 * True a partir da primeira vez que o elemento fica `limiar` visível, e nunca volta a false:
 * a animação de entrada roda uma vez, não a cada rolagem. Sem IntersectionObserver conta como
 * visto, para o conteúdo nunca ficar preso no primeiro quadro da animação.
 */
export function useVisto<T extends Element>(limiar = 0.3) {
  const ref = useRef<T>(null);
  const [cruzou, setCruzou] = useState(false);
  const semApi = useSyncExternalStore(semAssinatura, semObservador, nuncaNoServidor);

  useEffect(() => {
    const el = ref.current;
    if (!el || cruzou || semApi) return;
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setCruzou(true);
          io.disconnect();
        }
      },
      { threshold: limiar },
    );
    // Num filho de SVG observa o <svg>: a caixa de um <g> encolhe para zero enquanto as barras estão em scaleY(0).
    io.observe(el instanceof SVGElement && el.ownerSVGElement ? el.ownerSVGElement : el);
    return () => io.disconnect();
  }, [limiar, cruzou, semApi]);

  return { ref, visto: cruzou || semApi };
}
