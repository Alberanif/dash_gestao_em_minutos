"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Button, Input } from "../../ui";
import { cx, foco } from "../../ui/cx";
import { BuscaProduto } from "./busca-produto";
import type { PropsEtapa } from "./estado";

type StatusEventos = "carregando" | "pronto" | "erro";

/** Quantos eventos de Leads até a lista mostrar o campo de filtro. */
const LIMITE_SEM_FILTRO = 8;

export function EtapaCaptacao({ estado, atualizar }: PropsEtapa) {
  const idRotulo = useId();
  const idAjuda = useId();
  const [opcoes, setOpcoes] = useState<string[]>([]);
  const [status, setStatus] = useState<StatusEventos>("carregando");
  const [filtro, setFiltro] = useState("");

  const carregar = useCallback(() => {
    let cancelado = false;
    fetch("/api/indicadores/leads/events")
      .then(async (r) => {
        if (!r.ok) throw new Error("falha");
        const dados = await r.json();
        if (!Array.isArray(dados)) throw new Error("falha");
        if (!cancelado) {
          setOpcoes(dados as string[]);
          setStatus("pronto");
        }
      })
      .catch(() => {
        if (!cancelado) setStatus("erro");
      });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => carregar(), [carregar]);

  function alternarEvento(nome: string) {
    atualizar({
      eventosLeads: estado.eventosLeads.includes(nome)
        ? estado.eventosLeads.filter((e) => e !== nome)
        : [...estado.eventosLeads, nome],
    });
  }

  // Eventos já marcados que a API não devolve mais continuam visíveis e desmarcáveis.
  const todas = [...opcoes, ...estado.eventosLeads.filter((e) => !opcoes.includes(e))];
  const termo = filtro.trim().toLowerCase();
  const visiveis = todas.filter((e) => !termo || e.toLowerCase().includes(termo));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-v2-nevoa">Captação</h3>
        <p className="text-sm text-v2-nevoa/70">
          Diga de onde vêm os leads do evento: produtos Hotmart e eventos da página de leads.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <div className="flex min-h-11 items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span id={idRotulo} className="text-sm font-medium text-v2-nevoa">
              Captação orgânica
            </span>
            <span id={idAjuda} className="text-xs text-v2-nevoa/60">
              Evento orgânico capta leads sem vender o produto de captura.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={estado.organico}
            aria-labelledby={idRotulo}
            aria-describedby={idAjuda}
            onClick={() => atualizar({ organico: !estado.organico })}
            className={cx(
              "relative h-7 w-12 shrink-0 rounded-full p-0.5 ring-1 ring-inset ring-v2-azul-luz/25 before:absolute before:-inset-2 before:content-['']",
              estado.organico ? "bg-v2-azul-igt" : "bg-v2-casco-alto",
              foco,
            )}
          >
            <span
              aria-hidden="true"
              className={cx(
                "block h-6 w-6 rounded-full bg-v2-nevoa shadow-v2-1 transition-transform duration-[120ms]",
                estado.organico ? "translate-x-5" : "translate-x-0",
              )}
            />
          </button>
        </div>
        {estado.organico && (
          <p className="text-sm text-v2-nevoa/70">
            No modo orgânico a captura Hotmart não conta. Marque pelo menos um evento de Leads ou informe um termo de
            Meta Ads na etapa Tráfego.
          </p>
        )}
      </div>

      {!estado.organico && (
        <section className="flex flex-col gap-3" aria-label="Produto de captura">
          <BuscaProduto
            rotulo="Produto de captura (Hotmart)"
            ajuda="Opcional. Os leads vêm das vendas desses produtos."
            excluidos={estado.produtosCaptura.map((p) => p.product_id)}
            onEscolher={(p) => atualizar({ produtosCaptura: [...estado.produtosCaptura, p] })}
          />
          {estado.produtosCaptura.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Produtos de captura escolhidos">
              {estado.produtosCaptura.map((p) => (
                <li
                  key={p.product_id}
                  className="flex min-h-11 items-center gap-1 rounded-full bg-v2-azul-igt/20 pl-3 text-sm text-v2-azul-luz"
                >
                  <span className="break-words">{p.product_name}</span>
                  <button
                    type="button"
                    aria-label={`Remover ${p.product_name}`}
                    onClick={() =>
                      atualizar({ produtosCaptura: estado.produtosCaptura.filter((x) => x.product_id !== p.product_id) })
                    }
                    className={cx("flex h-11 w-11 items-center justify-center rounded-full", foco)}
                  >
                    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <fieldset className="flex flex-col gap-3 border-0 p-0">
        <legend className="mb-1 text-[13px] font-medium text-v2-nevoa/70">Eventos de Captação de Leads</legend>
        <p className="-mt-2 text-xs text-v2-nevoa/55">Opcional. Marque os eventos da página de leads que fazem parte deste evento.</p>

        {status === "carregando" && <p className="text-sm text-v2-nevoa/65">Carregando eventos...</p>}

        {status === "erro" && (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-v2-queda">
            <span>Não foi possível carregar os eventos de Leads.</span>
            <Button variante="secundario" className="h-11" onClick={() => {
                setStatus("carregando");
                carregar();
              }}>
              Tentar de novo
            </Button>
          </div>
        )}

        {status === "pronto" && todas.length === 0 && (
          <p className="text-sm text-v2-nevoa/65">Nenhum evento encontrado na página de leads.</p>
        )}

        {status !== "carregando" && todas.length > 0 && (
          <>
            {todas.length > LIMITE_SEM_FILTRO && (
              <Input
                className="h-11"
                aria-label="Filtrar eventos de Leads"
                placeholder="Filtrar eventos"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
            )}
            <ul className="flex max-h-60 flex-col overflow-y-auto rounded-v2-sm bg-v2-casco-alto shadow-v2-1 ring-1 ring-inset ring-v2-azul-luz/15">
              {visiveis.map((nome) => (
                <li key={nome}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm text-v2-nevoa">
                    <input
                      type="checkbox"
                      className={cx("h-5 w-5 shrink-0 accent-v2-azul-igt", foco)}
                      checked={estado.eventosLeads.includes(nome)}
                      onChange={() => alternarEvento(nome)}
                    />
                    <span className="break-words">{nome}</span>
                  </label>
                </li>
              ))}
              {visiveis.length === 0 && <li className="px-3 py-2 text-sm text-v2-nevoa/65">Nenhum evento com esse filtro.</li>}
            </ul>
          </>
        )}
      </fieldset>
    </div>
  );
}
