"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Campo, Input } from "../../ui";
import { cx } from "../../ui/cx";
import type { ProdutoHotmart } from "./estado";

interface PropsBuscaProduto {
  rotulo: string;
  ajuda?: string;
  /** product_id já escolhidos: não aparecem nos resultados. */
  excluidos: string[];
  onEscolher: (produto: ProdutoHotmart) => void;
}

/**
 * Combobox de produto Hotmart. Busca em `/api/funnels/products?q=` (nome e product_id) com
 * debounce de 300 ms. A lista fica no fluxo da página, sem portal, para o pop up rolar com ela.
 */
export function BuscaProduto({ rotulo, ajuda, excluidos, onEscolher }: PropsBuscaProduto) {
  const idLista = useId();
  const [consulta, setConsulta] = useState("");
  const [aberto, setAberto] = useState(false);
  const [resultados, setResultados] = useState<ProdutoHotmart[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    const timer = setTimeout(async () => {
      setBuscando(true);
      setFalhou(false);
      try {
        const res = await fetch(`/api/funnels/products?q=${encodeURIComponent(consulta.trim())}`);
        if (!res.ok) throw new Error("falha");
        const dados = await res.json();
        if (!cancelado && Array.isArray(dados)) setResultados(dados as ProdutoHotmart[]);
      } catch {
        if (!cancelado) setFalhou(true);
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, 300);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [consulta, aberto]);

  const opcoes = resultados.filter((p) => !excluidos.includes(p.product_id));
  const indice = Math.min(ativo, Math.max(opcoes.length - 1, 0));
  const idOpcao = (i: number) => `${idLista}-op-${i}`;

  function escolher(p: ProdutoHotmart) {
    onEscolher({ product_id: p.product_id, product_name: p.product_name });
    setConsulta("");
    setAtivo(0);
    inputRef.current?.focus();
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAberto(true);
      setAtivo(Math.min(indice + 1, Math.max(opcoes.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo(Math.max(indice - 1, 0));
    } else if (e.key === "Enter") {
      if (aberto && opcoes[indice]) {
        e.preventDefault();
        escolher(opcoes[indice]);
      }
    } else if (e.key === "Escape" && aberto) {
      // Fecha a lista. Quem cuida do Esc do pop up é a casca.
      e.preventDefault();
      setAberto(false);
    }
  }

  const mostrarLista = aberto;

  return (
    <div className="flex flex-col gap-2">
      <Campo rotulo={rotulo} ajuda={ajuda}>
        {(aria) => (
          <Input
            {...aria}
            ref={inputRef}
            role="combobox"
            aria-expanded={mostrarLista}
            aria-controls={idLista}
            aria-autocomplete="list"
            aria-activedescendant={mostrarLista && opcoes[indice] ? idOpcao(indice) : undefined}
            autoComplete="off"
            className="h-11"
            placeholder="Buscar por nome ou código do produto"
            value={consulta}
            onChange={(e) => {
              setConsulta(e.target.value);
              setAberto(true);
              setAtivo(0);
            }}
            onFocus={() => setAberto(true)}
            onBlur={() => setAberto(false)}
            onKeyDown={aoTeclar}
          />
        )}
      </Campo>
      {mostrarLista && (
        <div className="rounded-v2-sm bg-v2-casco-alto shadow-v2-1 ring-1 ring-inset ring-v2-azul-luz/15">
          <ul id={idLista} role="listbox" aria-label={rotulo} className="max-h-56 overflow-y-auto py-1">
            {opcoes.map((p, i) => (
              <li
                key={p.product_id}
                id={idOpcao(i)}
                role="option"
                aria-selected={i === indice}
                // mousedown antes do blur do input: senão a lista some antes do clique.
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(p);
                }}
                onMouseEnter={() => setAtivo(i)}
                className={cx(
                  "flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm text-v2-nevoa",
                  i === indice && "bg-v2-azul-igt/20",
                )}
              >
                <span className="min-w-0 break-words">{p.product_name}</span>
                <span className="shrink-0 text-xs text-v2-nevoa/55">#{p.product_id}</span>
              </li>
            ))}
          </ul>
          {buscando && <p className="px-3 py-2 text-sm text-v2-nevoa/65">Buscando produtos...</p>}
          {!buscando && falhou && (
            <p role="alert" className="px-3 py-2 text-sm text-v2-queda">
              Não foi possível buscar os produtos. Continue digitando para tentar de novo.
            </p>
          )}
          {!buscando && !falhou && opcoes.length === 0 && (
            <p className="px-3 py-2 text-sm text-v2-nevoa/65">
              {consulta.trim() ? "Nenhum produto encontrado." : "Digite para buscar um produto."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
