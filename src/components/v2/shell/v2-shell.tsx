"use client";

import { usePathname } from "next/navigation";
import { cx, foco } from "../ui/cx";
import { tituloDaRota } from "./nav-config";
import { PageTransition } from "./page-transition";

/**
 * Shell da V2: atalho para o conteúdo, cabeçalho com o título da rota e a página.
 * Não há barra lateral nem de abas; a navegação sai do menu principal (/v2) e dos botões de cada tela.
 */
export function V2Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const titulo = tituloDaRota(pathname);

  return (
    <div className="@container">
      <a
        href="#conteudo"
        className={cx(
          "sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-v2-sm focus:bg-v2-casco-alto focus:px-3 focus:py-2 focus:text-sm",
          foco,
        )}
      >
        Pular para o conteúdo
      </a>
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center bg-v2-abismo/90 px-4 backdrop-blur @3xl:h-16 @3xl:px-8">
          <h1 className="truncate text-lg font-light tracking-tight @3xl:text-xl">{titulo}</h1>
        </header>
        <main id="conteudo" tabIndex={-1} className="min-w-0 flex-1 px-4 pb-10 outline-none @3xl:px-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
