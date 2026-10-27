"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const LARGURA_SEM_OBSERVER = 640;

/** Largura do elemento, acompanhando redimensionamento. Zero até a primeira medida (nada é desenhado antes). */
export function useLarguraMedida<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof ResizeObserver === "undefined") {
      setLargura(Math.round(el.getBoundingClientRect().width) || LARGURA_SEM_OBSERVER);
      return;
    }
    const ro = new ResizeObserver((entradas) => {
      const w = Math.round(entradas[0].contentRect.width);
      setLargura((anterior) => (anterior === w ? anterior : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, largura };
}

/**
 * Item ativo de um gráfico, comandado por mouse e teclado.
 * Setas movem, Home e End vão às pontas, Escape limpa. Foco entrando já ativa o primeiro item.
 */
export function useItemAtivo(total: number) {
  const [ativo, setAtivo] = useState<number | null>(null);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (total === 0) return;
      const seguinte = (delta: number) => setAtivo((a) => Math.min(total - 1, Math.max(0, (a ?? (delta > 0 ? -1 : total)) + delta)));
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
          e.preventDefault();
          seguinte(1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          seguinte(-1);
          break;
        case "Home":
          e.preventDefault();
          setAtivo(0);
          break;
        case "End":
          e.preventDefault();
          setAtivo(total - 1);
          break;
        case "Escape":
          setAtivo(null);
          break;
      }
    },
    [total],
  );

  const onFocus = useCallback(() => setAtivo((a) => a ?? 0), []);
  const onBlur = useCallback(() => setAtivo(null), []);

  // Dados novos podem ter menos itens que o índice ativo.
  const valido = ativo !== null && ativo < total ? ativo : null;
  return { ativo: valido, setAtivo, handlers: { onKeyDown, onFocus, onBlur } };
}
