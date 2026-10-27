"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { usePerfilMovimento } from "../motion/use-perfil-movimento";
import { usePortalContainer } from "../ui/v2-root";
import { DURACAO_ENTRADA, calcularZoom, cliqueSimples, type CaixaDoCard, type Zoom } from "../indicadores/entrada-zoom";

type Entrada = { caixa: CaixaDoCard; zoom: Zoom };

/**
 * Zoom de entrada do cartão: ao clicar, o cartão cresce até cobrir a janela (mesmo overlay do card
 * Funis) e a navegação acontece quando o zoom termina. Ctrl, Cmd e botão do meio abrem o link normalmente.
 */
export function useEntradaCartao<T extends HTMLElement>(href: string): {
  ref: RefObject<T | null>;
  aoClicar: (e: MouseEvent) => void;
  overlay: ReactNode;
} {
  const router = useRouter();
  const perfil = usePerfilMovimento();
  const portal = usePortalContainer();
  const ref = useRef<T>(null);
  const [entrada, setEntrada] = useState<Entrada | null>(null);
  const [rodando, setRodando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Dois quadros: o overlay nasce na posição do cartão e só então recebe o estado final, para a transição correr.
  useEffect(() => {
    if (!entrada) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setRodando(true)));
    return () => cancelAnimationFrame(id);
  }, [entrada]);

  function aoClicar(e: MouseEvent) {
    if (!cliqueSimples(e) || e.defaultPrevented) return;
    e.preventDefault();
    if (entrada || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const caixa = { left: r.left, top: r.top, width: r.width, height: r.height };
    setEntrada({ caixa, zoom: calcularZoom(caixa, { width: window.innerWidth, height: window.innerHeight }) });
    timer.current = setTimeout(() => router.push(href), DURACAO_ENTRADA[perfil]);
  }

  const overlay =
    entrada && portal
      ? createPortal(
          <div
            className="v2-entrada"
            data-rodando={rodando ? "" : undefined}
            data-perfil={perfil}
            aria-hidden="true"
            style={
              {
                "--dur": `${DURACAO_ENTRADA[perfil]}ms`,
                "--dx": `${entrada.zoom.dx}px`,
                "--dy": `${entrada.zoom.dy}px`,
                "--escala": entrada.zoom.escala,
              } as CSSProperties
            }
          >
            <div className="v2-entrada-fundo" />
            <div
              className="v2-entrada-janela"
              style={{ left: entrada.caixa.left, top: entrada.caixa.top, width: entrada.caixa.width, height: entrada.caixa.height }}
            >
              <div className="v2-entrada-veu" />
            </div>
          </div>,
          portal,
        )
      : null;

  return { ref, aoClicar, overlay };
}
