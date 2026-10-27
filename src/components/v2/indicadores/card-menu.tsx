"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { PerfilMovimento } from "../motion/perfil-movimento";
import { usePerfilMovimento } from "../motion/use-perfil-movimento";
import { usePortalContainer } from "../ui/v2-root";
import { cx, foco } from "../ui/cx";
import { ArteFunis } from "./arte-funis";
import { ArteTestesAb } from "./arte-testes-ab";
import { DURACAO_ENTRADA, calcularZoom, cliqueSimples, type CaixaDoCard, type Zoom } from "./entrada-zoom";
import type { ItemDoMenu } from "./itens";

type Entrada = { caixa: CaixaDoCard; zoom: Zoom };

/**
 * Card clicável do menu. No hover (ou foco por teclado) o desenho dá zoom e o título sobe, revelando
 * a descrição. No clique, a arte do card cresce até cobrir a janela, como se o usuário entrasse nele,
 * e a navegação acontece quando o zoom termina. Ctrl, Cmd e botão do meio abrem o link normalmente.
 */
export function CardMenu({ item }: { item: ItemDoMenu }) {
  const router = useRouter();
  const perfil = usePerfilMovimento();
  const portal = usePortalContainer();
  const ref = useRef<HTMLAnchorElement>(null);
  const [entrada, setEntrada] = useState<Entrada | null>(null);
  const [rodando, setRodando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Dois quadros: o overlay nasce na posição do card e só então recebe o estado final, para a transição correr.
  useEffect(() => {
    if (!entrada) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setRodando(true)));
    return () => cancelAnimationFrame(id);
  }, [entrada]);

  function entrar() {
    if (entrada || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const caixa = { left: r.left, top: r.top, width: r.width, height: r.height };
    setEntrada({ caixa, zoom: calcularZoom(caixa, { width: window.innerWidth, height: window.innerHeight }) });
    timer.current = setTimeout(() => router.push(item.href), DURACAO_ENTRADA[perfil]);
  }

  return (
    <>
      <Link
        ref={ref}
        href={item.href}
        className={cx("v2-card group", foco)}
        onClick={(e) => {
          if (!cliqueSimples(e) || e.defaultPrevented) return;
          e.preventDefault();
          entrar();
        }}
        onKeyDown={(e) => {
          // Em link, só o Enter dispara o clique; o Espaço também entra no card.
          if (e.key !== " ") return;
          e.preventDefault();
          entrar();
        }}
      >
        <div className="v2-card-arte">
          <Arte tipo={item.arte} />
        </div>
        <div className="v2-card-texto">
          <span className="v2-card-titulo">{item.titulo}</span>
          <p className="v2-card-desc">{item.descricao}</p>
        </div>
      </Link>
      {entrada && portal && createPortal(<Entrando entrada={entrada} perfil={perfil} rodando={rodando} arte={item.arte} />, portal)}
    </>
  );
}

function Entrando({ entrada, perfil, rodando, arte }: { entrada: Entrada; perfil: PerfilMovimento; rodando: boolean; arte: ItemDoMenu["arte"] }) {
  const { caixa, zoom } = entrada;
  const estilo = {
    "--dur": `${DURACAO_ENTRADA[perfil]}ms`,
    "--dx": `${zoom.dx}px`,
    "--dy": `${zoom.dy}px`,
    "--escala": zoom.escala,
  } as CSSProperties;
  return (
    <div className="v2-entrada" data-rodando={rodando ? "" : undefined} data-perfil={perfil} style={estilo} aria-hidden="true">
      <div className="v2-entrada-fundo" />
      <div
        className="v2-entrada-janela"
        style={{ left: caixa.left, top: caixa.top, width: caixa.width, height: caixa.height }}
      >
        <Arte tipo={arte} />
        <div className="v2-entrada-veu" />
      </div>
    </div>
  );
}

function Arte({ tipo }: { tipo: ItemDoMenu["arte"] }) {
  return tipo === "testes-ab" ? <ArteTestesAb /> : <ArteFunis />;
}
