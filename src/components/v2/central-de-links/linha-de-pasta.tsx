"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { LinkDaCentral } from "@/lib/central-de-links/tipos";
import { PastaArquivo } from "../eventos/pasta-arquivo";
import type { PastaConfig } from "../eventos/pastas";
import { Popover, PopoverContent, PopoverTrigger } from "../ui";
import { cx, foco } from "../ui/cx";

export function rotuloDeLinks(total: number): string {
  return total === 1 ? "1 link" : `${total} links`;
}

const item =
  "flex w-full items-center rounded-v2-sm px-3 py-2 text-left text-sm outline-none hover:bg-v2-nevoa/10 focus-visible:bg-v2-nevoa/10 disabled:opacity-40";

type Props = {
  pasta: PastaConfig;
  /** Links da pasta que passam pela busca, já em ordem. */
  links: LinkDaCentral[];
  aberta: boolean;
  idPainel: string;
  onAlternar: () => void;
  /** Um nome da relação foi escolhido: abre a pasta e leva até o cartão desse link. */
  onEscolherLink: (id: string) => void;
  /** Só o admin organiza: sem isto o menu da pasta não aparece. */
  organizar?: {
    primeira: boolean;
    ultima: boolean;
    onEditar: () => void;
    onExcluir: () => void;
    onMover: (direcao: -1 | 1) => void;
    onNovoLink: () => void;
  };
  /** Cartões dos links, mostrados logo abaixo da linha quando a pasta está aberta. */
  children: ReactNode;
};

/** Uma pasta na lista: o desenho da pasta, ao lado a relação dos links e, aberta, os cartões embaixo. */
export function LinhaDePasta({ pasta, links, aberta, idPainel, onAlternar, onEscolherLink, organizar, children }: Props) {
  return (
    <li className="list-none" style={{ "--pc": pasta.hex } as CSSProperties}>
      <div className="v2-cl-linha" data-aberta={aberta ? "" : undefined}>
        <div className="v2-cl-pasta relative w-44 max-w-full">
          <PastaArquivo
            pasta={pasta}
            total={links.length}
            selecionada={aberta}
            idPainel={idPainel}
            onSelecionar={onAlternar}
            rotulo={rotuloDeLinks(links.length)}
            lista
          />
          {organizar && <MenuDaPasta nome={pasta.nome} {...organizar} />}
        </div>
        {/* Aberta, a relação some mas continua ocupando o lugar: a linha não muda de altura e a pasta só anda no eixo X.
            O atalho de mouse da prévia é só conveniência: o botão da pasta atende teclado e leitor de tela. */}
        <div
          className="v2-cl-previa"
          data-oculta={aberta ? "" : undefined}
          aria-hidden={aberta || undefined}
          onClick={aberta ? undefined : onAlternar}
          data-testid={`previa-${pasta.nome}`}
        >
          {links.length === 0 ? (
            <p className="m-0 text-sm text-v2-nevoa/50">Nenhum link nesta pasta ainda.</p>
          ) : (
            <RelacaoDeLinks nome={pasta.nome} links={links} onEscolher={onEscolherLink} />
          )}
        </div>
      </div>
      {aberta && (
        <div id={idPainel} role="region" aria-label={pasta.nome} className="v2-cl-painel">
          {children}
        </div>
      )}
    </li>
  );
}

/**
 * Todos os nomes da pasta numa lista que rola com a roda do mouse. Cada nome é um botão e reage sozinho à
 * rolagem: recebe `--w` (0 a 1, pela distância até o centro da janela) e o CSS o desloca, aumenta e acende.
 * Só mexe em estilo direto no DOM, sem renderizar de novo.
 */
function RelacaoDeLinks({ nome, links, onEscolher }: { nome: string; links: LinkDaCentral[]; onEscolher: (id: string) => void }) {
  const lista = useRef<HTMLUListElement>(null);
  const quadro = useRef(0);

  const ajustar = useCallback(() => {
    const el = lista.current;
    if (!el) return;
    const sobra = el.scrollHeight - el.clientHeight;
    if (sobra <= 1) {
      el.removeAttribute("data-onda");
      return;
    }
    el.setAttribute("data-onda", "");
    // cada nome reage à própria posição: quanto mais perto do centro da janela, mais forte o grau
    const centro = el.scrollTop + el.clientHeight / 2;
    const raio = el.clientHeight * 0.55;
    for (const li of Array.from(el.children) as HTMLElement[]) {
      const d = Math.abs(li.offsetTop + li.offsetHeight / 2 - centro) / raio;
      li.style.setProperty("--w", Math.cos(Math.min(1, d) * (Math.PI / 2)).toFixed(3));
    }
  }, []);

  useEffect(() => {
    ajustar();
    if (typeof ResizeObserver === "undefined" || !lista.current) return;
    const observador = new ResizeObserver(ajustar);
    observador.observe(lista.current);
    return () => observador.disconnect();
  }, [ajustar, links.length]);

  useEffect(() => () => cancelAnimationFrame(quadro.current), []);

  function aoRolar() {
    if (quadro.current) return;
    quadro.current = requestAnimationFrame(() => {
      quadro.current = 0;
      ajustar();
    });
  }

  return (
    <ul
      ref={lista}
      className="v2-cl-lista"
      tabIndex={0}
      aria-label={`Todos os links de ${nome}`}
      onScroll={aoRolar}
      // clicar na barra de rolagem não deve abrir ou fechar a pasta
      onClick={(e) => e.target === e.currentTarget && e.stopPropagation()}
    >
      {links.map((l) => (
        <li key={l.id} className="v2-cl-previa-item">
          <button
            type="button"
            className="v2-cl-previa-botao"
            aria-label={`Ver o cartão de ${l.label}`}
            onClick={(e) => {
              e.stopPropagation();
              onEscolher(l.id);
            }}
          >
            <span>{l.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function MenuDaPasta({
  nome, primeira, ultima, onEditar, onExcluir, onMover, onNovoLink,
}: NonNullable<Props["organizar"]> & { nome: string }) {
  const [aberto, setAberto] = useState(false);
  const fechar = (acao: () => void) => () => {
    setAberto(false);
    acao();
  };
  return (
    <div className="absolute right-0 top-3 z-10">
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Opções da pasta ${nome}`}
            className={cx(
              "grid size-8 place-items-center rounded-full bg-v2-abismo/60 text-v2-nevoa/80 ring-1 ring-inset ring-v2-azul-luz/20 transition-transform duration-[160ms] hover:scale-105 active:scale-95",
              foco,
            )}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
              <circle cx="5" cy="12" r="1.7" />
              <circle cx="12" cy="12" r="1.7" />
              <circle cx="19" cy="12" r="1.7" />
            </svg>
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1.5">
          <button type="button" className={item} onClick={fechar(onNovoLink)}>
            Novo link nesta pasta
          </button>
          <button type="button" className={item} onClick={fechar(onEditar)}>
            Renomear ou mudar cor
          </button>
          <button type="button" className={item} disabled={primeira} onClick={fechar(() => onMover(-1))}>
            Subir pasta
          </button>
          <button type="button" className={item} disabled={ultima} onClick={fechar(() => onMover(1))}>
            Descer pasta
          </button>
          <button type="button" className={cx(item, "text-v2-queda")} onClick={fechar(onExcluir)}>
            Excluir pasta
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
