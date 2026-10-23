"use client";

import { useEffect, useRef, useState } from "react";
import { cx, foco } from "../ui/cx";

/**
 * Menu "Mais" da barra de abas (celular). Um disclosure simples no lugar do Popover do Radix,
 * que arrastaria o floating-ui (~25 KB gzip) para o JS inicial de toda rota. O painel abre
 * acima da barra e fecha com Escape (devolvendo o foco ao botão), clique fora ou foco que sai.
 */
export function MaisMenu({ botao: rotulo, children }: { botao: React.ReactNode; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  return (
    <div
      ref={raiz}
      className="relative flex min-w-0 flex-1"
      onKeyDown={(e) => {
        if (e.key === "Escape" && aberto) {
          setAberto(false);
          botao.current?.focus();
        }
      }}
      onBlur={(e) => {
        if (aberto && !raiz.current?.contains(e.relatedTarget as Node | null)) setAberto(false);
      }}
    >
      <button
        ref={botao}
        type="button"
        aria-expanded={aberto}
        aria-controls="menu-mais"
        onClick={() => setAberto((v) => !v)}
        className={cx(
          "flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-v2-sm text-xs font-medium text-v2-nevoa/70",
          foco,
        )}
      >
        {rotulo}
      </button>
      {aberto && (
        <div
          id="menu-mais"
          className="v2-pop absolute bottom-full right-0 z-50 mb-2 w-64 rounded-v2-md bg-v2-casco-alto p-2 text-v2-nevoa shadow-v2-2 ring-1 ring-inset ring-v2-azul-luz/20"
        >
          {children}
        </div>
      )}
    </div>
  );
}
