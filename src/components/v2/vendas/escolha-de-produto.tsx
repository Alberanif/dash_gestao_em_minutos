"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Input } from "../ui";
import { cx } from "../ui/cx";
import type { ProdutoHotmart } from "./tipos";

interface EscolhaDeProdutoProps {
  produtos: ProdutoHotmart[];
  /** product_id escolhido, ou "" enquanto não houver escolha. */
  valor: string;
  onEscolher: (productId: string) => void;
  /** Nome acessível do campo. */
  rotulo?: string;
  placeholder?: string;
}

// A base tem centenas de produtos: desenhar todos de uma vez pesa e esconde o que importa.
const LIMITE_DE_RESULTADOS = 50;

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** Filtra por parte do nome (sem acento nem caixa) ou por parte do ID. Termo vazio devolve tudo. */
export function filtrarProdutos(produtos: ProdutoHotmart[], consulta: string): ProdutoHotmart[] {
  const termo = normalizar(consulta.trim()).replace(/^#/, "");
  if (!termo) return produtos;
  return produtos.filter((p) => normalizar(p.product_name).includes(termo) || normalizar(p.product_id).includes(termo));
}

/**
 * Combobox de produto com busca por nome e por ID. A lista fica no fluxo do modal (sem portal),
 * ocupa a largura do campo e rola por dentro, então cabe em qualquer tela.
 */
export function EscolhaDeProduto({
  produtos,
  valor,
  onEscolher,
  rotulo = "Produto",
  placeholder = "Buscar por nome ou ID do produto",
}: EscolhaDeProdutoProps) {
  const idLista = useId();
  const escolhido = produtos.find((p) => p.product_id === valor) ?? null;
  const [consulta, setConsulta] = useState<string | null>(null); // null = mostrando o escolhido
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const listaRef = useRef<HTMLUListElement>(null);

  const resultados = useMemo(() => filtrarProdutos(produtos, consulta ?? ""), [produtos, consulta]);
  const visiveis = resultados.slice(0, LIMITE_DE_RESULTADOS);
  const indice = Math.min(ativo, Math.max(visiveis.length - 1, 0));
  const idOpcao = (i: number) => `${idLista}-op-${i}`;

  useEffect(() => {
    if (!aberto) return;
    document.getElementById(idOpcao(indice))?.scrollIntoView?.({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indice, aberto]);

  function escolher(p: ProdutoHotmart) {
    onEscolher(p.product_id);
    setConsulta(null);
    setAberto(false);
    setAtivo(0);
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!aberto) setAberto(true);
      else setAtivo(Math.min(indice + 1, Math.max(visiveis.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo(Math.max(indice - 1, 0));
    } else if (e.key === "Enter") {
      // Dentro do formulário do modal, Enter não pode enviar: só escolhe.
      if (aberto && visiveis[indice]) {
        e.preventDefault();
        escolher(visiveis[indice]);
      } else if (aberto) {
        e.preventDefault();
      }
    } else if (e.key === "Escape" && aberto) {
      e.preventDefault();
      setAberto(false);
      setConsulta(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        role="combobox"
        aria-label={rotulo}
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={aberto && visiveis[indice] ? idOpcao(indice) : undefined}
        autoComplete="off"
        data-testid="view-form-product-search"
        placeholder={placeholder}
        value={consulta ?? escolhido?.product_name ?? ""}
        onChange={(e) => {
          setConsulta(e.target.value);
          setAberto(true);
          setAtivo(0);
        }}
        onFocus={(e) => {
          setAberto(true);
          e.currentTarget.select();
        }}
        onBlur={() => {
          setAberto(false);
          setConsulta(null);
        }}
        onKeyDown={aoTeclar}
      />
      {aberto && (
        <div className="rounded-v2-sm bg-v2-casco-alto shadow-v2-1 ring-1 ring-inset ring-v2-azul-luz/15">
          <ul ref={listaRef} id={idLista} role="listbox" aria-label="Produtos" className="max-h-56 overflow-y-auto overscroll-contain py-1">
            {visiveis.map((p, i) => (
              <li
                key={p.product_id}
                id={idOpcao(i)}
                role="option"
                aria-selected={p.product_id === valor}
                // mousedown antes do blur do campo: senão a lista some antes do clique.
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(p);
                }}
                onMouseEnter={() => setAtivo(i)}
                className={cx(
                  "flex min-h-11 cursor-pointer flex-col justify-center gap-0.5 px-3 py-2 text-sm text-v2-nevoa sm:flex-row sm:items-center sm:justify-between sm:gap-3",
                  i === indice && "bg-v2-azul-igt/20",
                  p.product_id === valor && "text-v2-azul-luz",
                )}
              >
                <span className="min-w-0 [overflow-wrap:anywhere]">{p.product_name}</span>
                <span className="shrink-0 text-xs text-v2-nevoa/55">ID {p.product_id}</span>
              </li>
            ))}
          </ul>
          {visiveis.length === 0 && <p className="px-3 py-2 text-sm text-v2-nevoa/65">Nenhum produto encontrado.</p>}
          {resultados.length > visiveis.length && (
            <p className="border-t border-v2-nevoa/10 px-3 py-2 text-xs text-v2-nevoa/65">
              Mostrando {visiveis.length} de {resultados.length} produtos. Digite para refinar a busca.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
