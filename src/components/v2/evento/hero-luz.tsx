"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "../ui/cx";
import { decidirModo, dispositivoFraco, fpsAlvo, limiteDpr, type Ambiente } from "./hero-decisao";
import type { Cena } from "./hero-cena";

type NavegadorComSinais = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

/**
 * Feixe de luz do herói. O CSS (fallback) está sempre desenhado; o WebGL entra por cima
 * depois do primeiro conteúdo, num chunk próprio, e some de novo se o ambiente pedir:
 * movimento reduzido, dispositivo fraco, sem WebGL ou contexto perdido. Pausa com a aba
 * oculta e fora da tela.
 */
export function HeroLuz() {
  const raiz = useRef<HTMLDivElement>(null);
  const [chave, setChave] = useState(0);
  const [webglVisivel, setWebglVisivel] = useState(false);

  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const canvas = el.querySelector("canvas");
    if (!canvas) return;

    const nav = navigator as NavegadorComSinais;
    const mm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const amb: Ambiente = {
      reducedMotion: mm.matches,
      webgl: true,
      fraco: dispositivoFraco({
        deviceMemory: nav.deviceMemory,
        hardwareConcurrency: nav.hardwareConcurrency,
        saveData: nav.connection?.saveData,
      }),
      abaOculta: document.visibilityState === "hidden",
      naTela: true,
      contextoPerdido: false,
    };

    let vivo = true;
    let liberado = false;
    let cena: Cena | null = null;
    let criando = false;
    let rafId = 0;
    let ultimoQuadro = 0;
    let idleId: number | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    let fps: 30 | 60 = 60;

    const parar = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    };

    const posicionar = () => {
      if (!cena) return;
      const caixa = el.getBoundingClientRect();
      cena.redimensionar(caixa.width, caixa.height);
    };

    const laco = (agora: number) => {
      rafId = requestAnimationFrame(laco);
      // 70% do intervalo: absorve o arredondamento de telas de 90/120/144 Hz sem cair abaixo do alvo.
      if (!cena || agora - ultimoQuadro < (1000 / fps) * 0.7) return;
      ultimoQuadro = agora;
      cena.desenhar(agora);
    };

    const destruirCena = () => {
      parar();
      cena?.destruir();
      cena = null;
      setWebglVisivel(false);
    };

    const aplicar = () => {
      if (!vivo || !liberado) return;
      const modo = decidirModo(amb);
      if (modo === "css") {
        if (cena) {
          destruirCena();
          // Contexto liberado não volta: um canvas novo atende uma eventual retomada.
          if (!amb.contextoPerdido) setChave((k) => k + 1);
        }
        return;
      }
      if (!cena) {
        void iniciar();
        return;
      }
      if (modo === "webgl-rodando" && !rafId) rafId = requestAnimationFrame(laco);
      if (modo === "webgl-pausado") parar();
    };

    const iniciar = async () => {
      if (criando || cena) return;
      criando = true;
      try {
        const { criarCena } = await import("./hero-cena");
        if (!vivo || decidirModo(amb) === "css") return;
        fps = fpsAlvo(window.innerWidth, window.matchMedia("(pointer: coarse)").matches);
        const pontoEl = el.parentElement?.querySelector("[data-hero-ponto]");
        const caixa = el.getBoundingClientRect();
        let centro = 0.8;
        if (pontoEl && caixa.width > 0) {
          const p = pontoEl.getBoundingClientRect();
          centro = (p.left + p.width / 2 - caixa.left) / caixa.width;
        }
        cena = criarCena({ canvas, dpr: limiteDpr(window.devicePixelRatio || 1, fps), centro, largura: 0.36 });
        posicionar();
        cena.desenhar(performance.now());
        setWebglVisivel(true);
        aplicar();
      } catch {
        // Sem WebGL (ou falha ao criar o contexto): o CSS já está na tela.
        amb.webgl = false;
        cena = null;
      } finally {
        criando = false;
      }
    };

    const aoPerderContexto = (e: Event) => {
      e.preventDefault();
      amb.contextoPerdido = true;
      cena = null;
      parar();
      setWebglVisivel(false);
    };
    canvas.addEventListener("webglcontextlost", aoPerderContexto);

    const aoMudarMovimento = () => {
      amb.reducedMotion = mm.matches;
      aplicar();
    };
    mm.addEventListener("change", aoMudarMovimento);

    const aoMudarVisibilidade = () => {
      amb.abaOculta = document.visibilityState === "hidden";
      aplicar();
    };
    document.addEventListener("visibilitychange", aoMudarVisibilidade);

    const io = new IntersectionObserver(([e]) => {
      amb.naTela = e.isIntersecting;
      aplicar();
    });
    io.observe(el);

    const ro = new ResizeObserver(posicionar);
    ro.observe(el);

    // Só depois do primeiro conteúdo: o WebGL não disputa a pintura inicial.
    const comecar = () => {
      liberado = true;
      aplicar();
    };
    if ("requestIdleCallback" in window) idleId = window.requestIdleCallback(comecar, { timeout: 1500 });
    else timerId = setTimeout(comecar, 300);

    return () => {
      vivo = false;
      parar();
      cena?.destruir();
      cena = null;
      canvas.removeEventListener("webglcontextlost", aoPerderContexto);
      mm.removeEventListener("change", aoMudarMovimento);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      io.disconnect();
      ro.disconnect();
      if (idleId !== undefined) window.cancelIdleCallback(idleId);
      if (timerId !== undefined) clearTimeout(timerId);
    };
  }, [chave]);

  return (
    <div ref={raiz} aria-hidden="true" data-hero-luz data-webgl={webglVisivel ? "on" : "off"} className="pointer-events-none absolute inset-0 -z-10">
      <div
        className={cx(
          "absolute inset-y-0 right-[12%] w-24 bg-gradient-to-b from-v2-azul-luz/0 via-v2-azul-luz/25 to-v2-azul-luz/0 blur-2xl transition-opacity duration-700 @xl:right-[18%] @xl:w-40",
          webglVisivel && "opacity-0",
        )}
      />
      <canvas
        key={chave}
        className={cx("absolute inset-0 size-full transition-opacity duration-700", webglVisivel ? "opacity-100" : "opacity-0")}
      />
    </div>
  );
}
