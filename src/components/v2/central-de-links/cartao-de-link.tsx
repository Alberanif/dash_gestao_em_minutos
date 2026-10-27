"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { enderecoPublico } from "@/lib/central-de-links/endereco-publico";
import { TIPOS_DE_LINK, type LinkDaCentral } from "@/lib/central-de-links/tipos";
import { Popover, PopoverContent, PopoverTrigger, Selo } from "../ui";
import { cx, foco } from "../ui/cx";
import { estadoDoArquivo } from "./estado-arquivo";
import { precisaTentarDeNovo } from "./fila-arquivamento";

type Props = {
  link: LinkDaCentral;
  /** Na busca o cartão mostra a que pasta o link pertence. */
  mostrarPasta: boolean;
  /** Cor da pasta (hex): moldura do cartão. */
  cor: string;
  /** Endereço temporário da miniatura; sem ele o cartão mostra o espaço ilustrado com o tipo. */
  miniaturaUrl?: string;
  /** Ordem do cartão na pasta: escalona a entrada. */
  indice: number;
  editavel: boolean;
  onEditar: (l: LinkDaCentral) => void;
  onExcluir: (l: LinkDaCentral) => void;
  onVerCopia: (l: LinkDaCentral) => void;
  onRemoverArquivo: (l: LinkDaCentral) => void;
  /** Pede o arquivamento (só admin). */
  onArquivar: (l: LinkDaCentral) => void;
  /** Este link está sendo arquivado agora, nesta tela. */
  arquivando: boolean;
  /** A fila está rodando: nenhum arquivamento avulso até ela terminar. */
  filaAtiva: boolean;
};

const botaoRedondo =
  "relative z-10 grid size-8 place-items-center rounded-full bg-v2-nevoa/15 text-v2-nevoa/85 backdrop-blur hover:bg-v2-nevoa/30 disabled:opacity-50";

const itemDoMenu =
  "flex w-full items-center rounded-v2-sm px-3 py-2 text-left text-sm outline-none hover:bg-v2-nevoa/10 focus-visible:bg-v2-nevoa/10 disabled:opacity-50";

function Icone({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function dominio(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function CartaoDeLink({
  link, mostrarPasta, cor, miniaturaUrl, indice, editavel, onEditar, onExcluir, onVerCopia, onRemoverArquivo, onArquivar, arquivando, filaAtiva,
}: Props) {
  const [copia, setCopia] = useState<"" | "link" | "endereco" | "erro">("");
  const [menu, setMenu] = useState(false);
  const arquivo = estadoDoArquivo(link);
  const publica = link.arquivo_path !== null && link.pagina_ativa;
  const travado = precisaTentarDeNovo(link, new Date());
  const emAndamento = arquivando || (link.arquivo_status === "arquivando" && !travado);
  const rotuloDeArquivar =
    travado || link.arquivo_status === "falhou" ? "Tentar de novo" : link.arquivo_path ? "Arquivar de novo" : "Arquivar";
  const endereco = enderecoPublico(typeof window === "undefined" ? "" : window.location.origin, link);
  const tipo = TIPOS_DE_LINK[link.tipo] ?? link.tipo;
  const temMenu = editavel || link.arquivo_path !== null;

  async function copiar(texto: string, qual: "link" | "endereco") {
    try {
      await navigator.clipboard.writeText(texto);
      setCopia(qual);
    } catch {
      setCopia("erro");
    }
    setTimeout(() => setCopia(""), 2500);
  }

  function fecharE(acao: () => void) {
    return () => {
      setMenu(false);
      acao();
    };
  }

  return (
    <article
      id={`cartao-${link.id}`}
      data-testid="cartao-de-link"
      style={{ "--pc": cor, "--i": Math.min(indice, 8) } as CSSProperties}
      className="v2-cl-card v2-arquivo"
    >
      <div className="v2-cl-moldura" aria-hidden="true">
        <div className="v2-cl-miolo">
          {miniaturaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- endereço assinado e temporário do Storage
            <img src={miniaturaUrl} alt="" loading="lazy" decoding="async" className="v2-cl-miniatura" data-testid="miniatura" />
          ) : (
            <div className="v2-cl-vazio" data-testid="miniatura-vazia">
              <svg viewBox="0 0 24 24" className="size-14 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2.5" />
                <path d="M3 9h18M7 6.5h.01M10 6.5h.01" />
              </svg>
            </div>
          )}
        </div>
      </div>

      <div className="absolute inset-0 z-[2] flex justify-between p-2.5">
        <div className="v2-cl-vidro mt-auto flex min-h-[46%] w-[66%] flex-col rounded-xl p-4 text-v2-nevoa">
          <h3 className="m-0 line-clamp-2 text-lg font-semibold leading-snug">
            <a
              // com cópia pública, o título leva à cópia salva; com cópia só interna, abre o visualizador; sem cópia, a página original
              href={publica ? endereco : link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Abrir ${link.label}`}
              onClick={
                link.arquivo_path && !publica
                  ? (e) => {
                      e.preventDefault();
                      onVerCopia(link);
                    }
                  : undefined
              }
              className={cx("rounded-sm outline-none after:absolute after:inset-0 after:z-[1] after:rounded-2xl", foco)}
            >
              {link.label}
            </a>
          </h3>
          <span className="mt-1 truncate text-sm text-v2-nevoa/65">{dominio(link.url)}</span>
          <div className="mt-auto flex flex-col items-start gap-1.5 pt-3">
            <span data-testid="estado-arquivo">
              <Selo tom={arquivo.tom}>{arquivo.texto}</Selo>
            </span>
            {arquivo.detalhe && <span className="text-xs leading-snug text-v2-nevoa/60">{arquivo.detalhe}</span>}
            {link.arquivo_path && link.arquivo_erro && (
              <p className="m-0 line-clamp-2 text-xs leading-snug text-v2-aviso" data-testid="aviso-arquivo">
                {link.arquivo_erro}
              </p>
            )}
          </div>
        </div>

        <div className="flex h-full flex-col items-end pt-1 text-right">
          <span className="text-[11px] leading-[13px] text-v2-nevoa/75">{tipo}</span>
          {mostrarPasta && <span className="mt-0.5 max-w-24 truncate text-[11px] leading-[13px] text-v2-nevoa/55">{link.grupo}</span>}
          <span role="status" className="mt-1 text-[11px] leading-tight text-v2-nevoa/80">
            {copia === "link" ? "Link copiado" : copia === "endereco" ? "Endereço copiado" : copia === "erro" ? "Não foi possível copiar." : ""}
          </span>
          <div className="mt-auto flex flex-col items-center gap-1.5">
            {temMenu && (
              <Popover open={menu} onOpenChange={setMenu}>
                <PopoverTrigger asChild>
                  <button type="button" aria-label={`Mais ações de ${link.label}`} className={cx(botaoRedondo, foco)}>
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
                      <circle cx="12" cy="5" r="1.7" />
                      <circle cx="12" cy="12" r="1.7" />
                      <circle cx="12" cy="19" r="1.7" />
                    </svg>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-1.5" data-testid="mais-acoes">
                  {link.arquivo_path && (
                    <button type="button" className={itemDoMenu} onClick={fecharE(() => onVerCopia(link))}>
                      Ver cópia
                    </button>
                  )}
                  {publica && (
                    <>
                      <button type="button" className={itemDoMenu} onClick={fecharE(() => void copiar(endereco, "endereco"))}>
                        Copiar endereço
                      </button>
                      <a href={endereco} target="_blank" rel="noopener noreferrer" className={itemDoMenu} onClick={() => setMenu(false)}>
                        Abrir página
                      </a>
                    </>
                  )}
                  {editavel &&
                    (emAndamento ? (
                      <button type="button" className={itemDoMenu} disabled>
                        Arquivando…
                      </button>
                    ) : (
                      <button type="button" className={itemDoMenu} disabled={filaAtiva} onClick={fecharE(() => onArquivar(link))}>
                        {rotuloDeArquivar}
                      </button>
                    ))}
                  {editavel && link.arquivo_path && (
                    <button type="button" className={cx(itemDoMenu, "text-v2-queda")} onClick={fecharE(() => onRemoverArquivo(link))}>
                      Remover arquivo
                    </button>
                  )}
                </PopoverContent>
              </Popover>
            )}
            {editavel && (
              <>
                <button type="button" aria-label={`Excluir ${link.label}`} className={cx(botaoRedondo, "hover:text-v2-queda", foco)} onClick={() => onExcluir(link)}>
                  <Icone>
                    <path d="M4 7h16M9 7V4.5h6V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5M14 11v5" />
                  </Icone>
                </button>
                <button type="button" aria-label={`Editar ${link.label}`} className={cx(botaoRedondo, foco)} onClick={() => onEditar(link)}>
                  <Icone>
                    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" />
                    <path d="m14.5 7.5 3 3" />
                  </Icone>
                </button>
              </>
            )}
            <button type="button" aria-label={`Copiar link de ${link.label}`} className={cx(botaoRedondo, foco)} onClick={() => void copiar(link.url, "link")}>
              <Icone>
                <rect x="9" y="9" width="11" height="11" rx="2.5" />
                <path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" />
              </Icone>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
