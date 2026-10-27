"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { usePerfilMovimento } from "../motion/use-perfil-movimento";
import { cliqueSimples } from "../indicadores/entrada-zoom";

/** Quanto o dashboard leva para se afastar antes de a navegação acontecer (casa com v2-afasta no CSS). */
export const DURACAO_SAIDA = { completo: 320, curto: 200, reduzido: 0 } as const;

/**
 * Volta do dashboard para a escolha de eventos (as pastas). O dashboard se afasta (zoom out) e a lista
 * chega do lado oposto do zoom de entrada; Ctrl, Cmd e botão do meio abrem o link normalmente.
 */
export function BotaoVoltar() {
  const router = useRouter();
  const perfil = usePerfilMovimento();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function voltar(e: React.MouseEvent) {
    if (!cliqueSimples(e) || e.defaultPrevented) return;
    e.preventDefault();
    if (timer.current) return;
    const ir = () => router.push("/v2/indicadores/eventos");
    const espera = DURACAO_SAIDA[perfil];
    if (espera === 0) return ir();
    document.documentElement.dataset.v2Volta = "";
    document.querySelector("[data-pagina-evento]")?.setAttribute("data-saindo", "");
    timer.current = setTimeout(ir, espera);
  }

  return (
    <Link href="/v2/indicadores/eventos" onClick={voltar} className="v2-voltar">
      <span className="v2-voltar-texto">Voltar aos eventos</span>
      <span aria-hidden="true" className="v2-voltar-texto-escuro">
        Voltar aos eventos
      </span>
    </Link>
  );
}
