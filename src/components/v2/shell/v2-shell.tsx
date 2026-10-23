"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Tooltip } from "../ui/tooltip";
import { cx, foco } from "../ui/cx";
import { Icone, IconeMais, IconeRecolher, IconeSair } from "./icons";
import { DESTINOS, ROTULO_EM_BREVE, destinoAtivo, tituloDaRota, type DestinoNav } from "./nav-config";
import { PageTransition } from "./page-transition";

/**
 * Shell da V2. O root é um container (`@container`), e o layout reage à largura dele:
 * - a partir de 1280 px: trilho expandido (o usuário pode recolher);
 * - de 768 a 1279 px: trilho compacto, só ícones;
 * - abaixo de 768 px: barra de abas embaixo.
 * Recolher não anima largura: só opacity e transform animam na V2.
 */
export function V2Shell({ userEmail, children }: { userEmail: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [recolhido, setRecolhido] = useState(false);
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
      <div className="flex min-h-screen flex-col @3xl:flex-row">
        <Trilho
          userEmail={userEmail}
          pathname={pathname}
          recolhido={recolhido}
          onAlternar={() => setRecolhido((v) => !v)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center bg-v2-abismo/90 px-4 backdrop-blur @3xl:h-16 @3xl:px-8">
            <h1 className="truncate text-lg font-light tracking-tight @3xl:text-xl">{titulo}</h1>
          </header>
          <main id="conteudo" tabIndex={-1} className="min-w-0 flex-1 px-4 pb-24 outline-none @3xl:px-8 @3xl:pb-10">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
        <BarraDeAbas userEmail={userEmail} pathname={pathname} />
      </div>
    </div>
  );
}

const itemBase = "group/item flex h-11 items-center gap-3 rounded-v2-sm px-3 text-sm font-medium";

/** Rótulo visível só com o trilho expandido; fora disso fica para leitor de tela. */
const rotuloDoTrilho =
  "sr-only flex min-w-0 flex-1 items-center justify-between gap-2 @min-[1280px]:group-data-[expandido]/rail:not-sr-only";

function EmBreve({ className }: { className?: string }) {
  return <span className={cx("text-xs text-v2-nevoa/50", className)}>{ROTULO_EM_BREVE}</span>;
}

function ItemDoTrilho({ destino, pathname }: { destino: DestinoNav; pathname: string }) {
  const conteudo = (
    <>
      <Icone id={destino.id} />
      <span className={rotuloDoTrilho}>
        <span className="truncate">{destino.rotulo}</span>
        {!destino.href && <EmBreve />}
      </span>
    </>
  );

  if (!destino.href) {
    return (
      <Tooltip lado="right" conteudo={`${destino.rotulo}: ${ROTULO_EM_BREVE.toLowerCase()}`}>
        <span aria-disabled="true" className={cx(itemBase, "cursor-not-allowed text-v2-nevoa/40")}>
          {conteudo}
        </span>
      </Tooltip>
    );
  }

  const ativo = destinoAtivo(destino, pathname);
  return (
    <Tooltip lado="right" conteudo={destino.rotulo}>
      <Link
        href={destino.href}
        aria-current={ativo ? "page" : undefined}
        className={cx(
          itemBase,
          foco,
          ativo
            ? "bg-v2-casco-alto text-v2-nevoa shadow-v2-brilho-azul"
            : "text-v2-nevoa/70 hover:bg-v2-nevoa/5 hover:text-v2-nevoa",
        )}
      >
        {conteudo}
      </Link>
    </Tooltip>
  );
}

function Trilho({
  userEmail,
  pathname,
  recolhido,
  onAlternar,
}: {
  userEmail: string;
  pathname: string;
  recolhido: boolean;
  onAlternar: () => void;
}) {
  const inicial = (userEmail[0] ?? "?").toUpperCase();
  return (
    <aside
      data-expandido={recolhido ? undefined : ""}
      className="group/rail sticky top-0 hidden h-screen w-[4.5rem] shrink-0 flex-col bg-v2-casco px-3 py-4 shadow-v2-1 @3xl:flex @min-[1280px]:data-[expandido]:w-[15.5rem]"
    >
      <div className="flex h-10 items-center px-3 text-lg font-light tracking-tight text-v2-azul-luz">
        <span className="@min-[1280px]:group-data-[expandido]/rail:hidden">I</span>
        <span className="hidden @min-[1280px]:group-data-[expandido]/rail:inline">IGT</span>
      </div>
      <nav aria-label="Áreas do dashboard" className="mt-6 flex-1">
        <ul className="flex flex-col gap-1">
          {DESTINOS.map((d) => (
            <li key={d.id}>
              <ItemDoTrilho destino={d} pathname={pathname} />
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={!recolhido}
          aria-label={recolhido ? "Expandir navegação" : "Recolher navegação"}
          className={cx(itemBase, foco, "hidden text-v2-nevoa/70 hover:bg-v2-nevoa/5 @min-[1280px]:flex")}
        >
          <IconeRecolher recolhido={recolhido} />
          <span className="hidden @min-[1280px]:group-data-[expandido]/rail:inline">Recolher</span>
        </button>
        <form action="/api/auth/signout" method="post">
          <Tooltip lado="right" conteudo="Sair">
            <button type="submit" className={cx(itemBase, foco, "w-full text-v2-nevoa/70 hover:bg-v2-nevoa/5")}>
              <IconeSair />
              <span className={rotuloDoTrilho}>Sair</span>
            </button>
          </Tooltip>
        </form>
        <div className="flex h-11 items-center gap-3 px-3">
          <span
            aria-hidden="true"
            className="flex size-5 shrink-0 items-center justify-center rounded-full bg-v2-azul-igt text-xs font-semibold text-v2-abismo"
          >
            {inicial}
          </span>
          <span className="hidden min-w-0 truncate text-xs text-v2-nevoa/60 @min-[1280px]:group-data-[expandido]/rail:inline">
            {userEmail}
          </span>
        </div>
      </div>
    </aside>
  );
}

function BarraDeAbas({ userEmail, pathname }: { userEmail: string; pathname: string }) {
  const principal = DESTINOS.filter((d) => d.href);
  const emBreve = DESTINOS.filter((d) => !d.href);
  return (
    <nav
      aria-label="Áreas do dashboard"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around bg-v2-casco px-2 pb-[env(safe-area-inset-bottom)] shadow-v2-2 @3xl:hidden"
    >
      {principal.map((d) => {
        const ativo = destinoAtivo(d, pathname);
        return (
          <Link
            key={d.id}
            href={d.href!}
            aria-current={ativo ? "page" : undefined}
            className={cx(
              "flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-v2-sm text-xs font-medium",
              foco,
              ativo ? "text-v2-azul-luz" : "text-v2-nevoa/70",
            )}
          >
            <Icone id={d.id} />
            <span className="truncate">{d.rotulo}</span>
          </Link>
        );
      })}
      <Popover>
        <PopoverTrigger
          className={cx(
            "flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-v2-sm text-xs font-medium text-v2-nevoa/70",
            foco,
          )}
        >
          <IconeMais />
          <span>Mais</span>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-64 p-2">
          <ul className="flex flex-col">
            {emBreve.map((d) => (
              <li key={d.id}>
                <span aria-disabled="true" className="flex h-11 items-center gap-3 px-3 text-sm text-v2-nevoa/40">
                  <Icone id={d.id} />
                  <span className="flex-1 truncate">{d.rotulo}</span>
                  <EmBreve />
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 truncate px-3 text-xs text-v2-nevoa/60">{userEmail}</p>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className={cx(itemBase, foco, "w-full text-v2-nevoa/80")}>
              <IconeSair />
              Sair
            </button>
          </form>
        </PopoverContent>
      </Popover>
    </nav>
  );
}
