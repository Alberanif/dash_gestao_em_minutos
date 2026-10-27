"use client";

import { useOptimistic, useState, useTransition, type CSSProperties } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cx, foco } from "../ui/cx";
import type { PastaUsuario } from "./pastas-servidor";
import { hexDaCor, type AcoesPastas } from "./pastas-regras";

const botaoIcone =
  "grid size-8 place-items-center rounded-full bg-v2-abismo/60 text-v2-nevoa/80 ring-1 ring-inset ring-v2-azul-luz/20 transition-transform duration-[160ms] hover:scale-105 active:scale-95";

const item =
  "flex w-full items-center gap-2 rounded-v2-sm px-3 py-2 text-left text-sm hover:bg-v2-nevoa/10 outline-none focus-visible:bg-v2-nevoa/10";

/** Menu da pasta do usuário: editar (nome e cor) ou excluir. */
export function MenuPasta({ nome, onEditar, onExcluir }: { nome: string; onEditar: () => void; onExcluir: () => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Opções da pasta ${nome}`} className={cx(botaoIcone, foco)}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
            <circle cx="5" cy="12" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="19" cy="12" r="1.7" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1.5">
        <button
          type="button"
          className={item}
          onClick={() => {
            setAberto(false);
            onEditar();
          }}
        >
          Renomear ou mudar cor
        </button>
        <button
          type="button"
          className={cx(item, "text-v2-queda")}
          onClick={() => {
            setAberto(false);
            onExcluir();
          }}
        >
          Excluir pasta
        </button>
      </PopoverContent>
    </Popover>
  );
}

type PropsCartao = {
  eventoId: string;
  eventoNome: string;
  pastas: readonly PastaUsuario[];
  /** Sem ações de pasta (pastas indisponíveis), o menu some com "Adicionar a uma pasta". */
  acoes?: AcoesPastas;
  onEditar: () => void;
  onExcluir: () => void;
  /** Pasta do usuário que está aberta: ganha o atalho "Remover desta pasta". */
  pastaAtualId?: string;
  /** O evento está de saída (foi movido): o menu fecha junto com o cartão, na mesma animação. */
  indo?: boolean;
};

/** Menu do cartão (três pontos): editar, adicionar a uma pasta e excluir. Na pasta, cada marca grava na hora. */
export function MenuCartao({ eventoId, eventoNome, pastas, acoes, onEditar, onExcluir, pastaAtualId, indo = false }: PropsCartao) {
  // Um evento fica em uma pasta só; se o banco trouxer mais de uma (dado antigo), vale a primeira.
  const doBanco = pastas.find((p) => p.eventoIds.includes(eventoId))?.id ?? null;
  // A escolha aparece na hora; se a gravação falhar, volta sozinha para o que está no banco.
  const [atual, escolherNaHora] = useOptimistic<string | null, string | null>(doBanco, (_, proxima) => proxima);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [vista, setVista] = useState<"menu" | "pastas">("menu");
  const [pendente, iniciar] = useTransition();

  // Cartão de saída: o menu fecha na hora (e some pela animação do cartão, em vez de sumir de repente).
  if (indo && aberto) setAberto(false);

  function gravar(proxima: string | null) {
    setErro(null);
    iniciar(async () => {
      escolherNaHora(proxima);
      const r = await acoes!.definirPastasDoEvento(eventoId, proxima === null ? [] : [proxima]);
      if (!r.ok) setErro(r.erro);
    });
  }

  return (
    <Popover
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (v) setVista("menu");
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Opções de ${eventoNome}`} className={cx(botaoIcone, "absolute right-4 top-4 z-20", foco)}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
            <circle cx="5" cy="12" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="19" cy="12" r="1.7" />
          </svg>
        </button>
      </PopoverTrigger>
      {vista === "menu" && (
        <PopoverContent align="end" className="w-56 p-1.5" data-movido={indo ? "" : undefined}>
          <button
            type="button"
            className={item}
            onClick={() => {
              setAberto(false);
              onEditar();
            }}
          >
            Editar evento
          </button>
          {acoes && (
            <button type="button" className={item} onClick={() => setVista("pastas")}>
              Adicionar a uma pasta
            </button>
          )}
          <button
            type="button"
            className={cx(item, "text-v2-queda")}
            onClick={() => {
              setAberto(false);
              onExcluir();
            }}
          >
            Excluir evento
          </button>
        </PopoverContent>
      )}
      {vista === "pastas" && (
      <PopoverContent align="end" className="w-64 p-2" data-movido={indo ? "" : undefined}>
        <button type="button" className={cx(item, "mb-1 text-v2-nevoa/70")} onClick={() => setVista("menu")}>
          <span aria-hidden="true">←</span> Voltar
        </button>
        <p className="px-2 pb-1.5 pt-1 text-sm font-medium">Adicionar a uma pasta</p>
        {pastas.length === 0 ? (
          <p className="px-2 pb-1 pt-1 text-sm text-v2-nevoa/60">Você ainda não tem pastas. Crie uma em “Nova pasta”.</p>
        ) : (
          <div role="radiogroup" aria-label="Pasta do evento" className="max-h-60 space-y-0.5 overflow-y-auto">
            {pastas.map((p) => {
              const escolhida = atual === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={escolhida}
                  disabled={pendente}
                  data-escolhida={escolhida ? "" : undefined}
                  style={{ "--pc": hexDaCor(p.cor) } as CSSProperties}
                  onClick={() => {
                    if (!escolhida) gravar(p.id);
                  }}
                  className={cx("v2-opcao-pasta", foco)}
                >
                  <span className="v2-opcao-icone" aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="v2-opcao-contorno" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
                    </svg>
                    <svg viewBox="0 0 24 24" className="v2-opcao-cheia" fill="currentColor">
                      <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                  {escolhida && <span className="v2-opcao-aqui">Aqui</span>}
                </button>
              );
            })}
          </div>
        )}
        {atual !== null && (
          <button
            type="button"
            className={cx(item, "mt-1.5 border-t border-v2-azul-luz/15 pt-2 text-v2-nevoa/75")}
            disabled={pendente}
            onClick={() => {
              gravar(null);
              if (atual === pastaAtualId) setAberto(false);
            }}
          >
            {atual === pastaAtualId ? "Remover desta pasta" : "Tirar da pasta"}
          </button>
        )}
        <p role="alert" className="px-1 pt-1 text-sm text-v2-queda empty:hidden">
          {erro}
        </p>
      </PopoverContent>
      )}
    </Popover>
  );
}
