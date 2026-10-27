"use client";

import { useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../ui/dialog";
import { cx, foco } from "../../ui/cx";
import {
  ETAPAS,
  avisoFontes,
  estadoDoEvento,
  estadoInicial,
  montarCorpo,
  problemasDoEstado,
  type EstadoAssistente,
  type EtapaId,
  type PropsAssistente,
} from "./estado";
import { EtapaIdentificacao } from "./etapa-identificacao";
import { EtapaCaptacao } from "./etapa-captacao";
import { EtapaProdutoPrincipal } from "./etapa-produto-principal";
import { EtapaTrafego } from "./etapa-trafego";
import { EtapaRevisao } from "./etapa-revisao";
import "./assistente.css";

const TOTAL = ETAPAS.length;
const MENSAGEM_ERRO_PADRAO = "Não foi possível criar o evento.";

function IconeCheck() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconeAlerta() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M8 3v6M8 12v.5" strokeLinecap="round" />
    </svg>
  );
}

/** Pop up em etapas para criar um evento (dashboard de indicadores). */
export function AssistenteNovoEvento({ accountId, onFechar, evento }: PropsAssistente) {
  const router = useRouter();
  const idMotivo = useId();
  const editando = evento !== undefined;
  const [estado, setEstado] = useState<EstadoAssistente>(() => (evento ? estadoDoEvento(evento) : estadoInicial));
  const [indice, setIndice] = useState(0);
  // Evento existente: todas as etapas já foram preenchidas, então o trilho abre livre.
  const [visitadas, setVisitadas] = useState<ReadonlySet<EtapaId>>(
    () => new Set<EtapaId>(editando ? ETAPAS.map((e) => e.id) : ["identificacao"]),
  );
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const titulo = editando ? "Editar evento" : "Novo evento";
  const mensagemErro = editando ? "Não foi possível salvar o evento." : MENSAGEM_ERRO_PADRAO;
  const etapa = ETAPAS[indice];
  const ultima = indice === TOTAL - 1;
  const nomeVazio = !estado.nome.trim();
  const problemas = problemasDoEstado(estado);
  const aviso = avisoFontes(estado);
  const revisaoVisitada = visitadas.has("revisao");
  const etapasComProblema = new Set(problemas.map((p) => p.etapa));

  // Só o nome bloqueia o avanço da primeira etapa; as demais passam livremente.
  const motivoBloqueio =
    etapa.id === "identificacao" && nomeVazio
      ? "Dê um nome ao evento para continuar."
      : ultima && problemas.length > 0
        ? problemas.length === 1
          ? "Resolva 1 pendência para criar o dashboard."
          : `Resolva ${problemas.length} pendências para criar o dashboard.`
        : null;

  function atualizar(parcial: Partial<EstadoAssistente>) {
    setEstado((e) => ({ ...e, ...parcial }));
  }

  function irPara(i: number) {
    setIndice(i);
    setVisitadas((v) => (v.has(ETAPAS[i].id) ? v : new Set(v).add(ETAPAS[i].id)));
    setErro(null);
  }

  function irParaEtapa(id: EtapaId) {
    irPara(ETAPAS.findIndex((e) => e.id === id));
  }

  async function criar() {
    if (criando || problemas.length > 0) return;
    setCriando(true);
    setErro(null);
    try {
      const res = await fetch(editando ? `/api/indicadores/filters/${evento.id}` : "/api/indicadores/filters", {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(montarCorpo(estado, accountId)),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro((d as { error?: string }).error ?? mensagemErro);
        setCriando(false);
        return;
      }
      // Sucesso: mantém "criando" até o componente sair, para não haver duplo envio.
      if (editando) router.refresh();
      else router.push(`/v2/indicadores/${(d as { id: string }).id}`);
      onFechar();
    } catch {
      setErro(MENSAGEM_ERRO_PADRAO);
      setCriando(false);
    }
  }

  function continuar() {
    if (ultima) void criar();
    else if (!motivoBloqueio) irPara(indice + 1);
  }

  let conteudo: ReactNode;
  const props = { estado, atualizar };
  switch (etapa.id) {
    case "identificacao":
      conteudo = <EtapaIdentificacao {...props} />;
      break;
    case "captacao":
      conteudo = <EtapaCaptacao {...props} />;
      break;
    case "produto":
      conteudo = <EtapaProdutoPrincipal {...props} />;
      break;
    case "trafego":
      conteudo = <EtapaTrafego {...props} />;
      break;
    case "revisao":
      conteudo = <EtapaRevisao {...props} problemas={problemas} aviso={aviso} irParaEtapa={irParaEtapa} />;
      break;
  }

  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto && !criando) onFechar();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className={cx(
          "flex flex-col p-0! h-[min(40rem,calc(100dvh-2rem))] w-[min(47.5rem,calc(100vw-2rem))] overflow-hidden",
          // Celular: tela cheia.
          "max-sm:top-0! max-sm:left-0! max-sm:h-dvh! max-sm:w-screen! max-sm:translate-x-0! max-sm:translate-y-0! max-sm:rounded-none!",
        )}
      >
        <DialogTitle className="sr-only">{titulo}</DialogTitle>
        <DialogDescription className="sr-only">
          Assistente em {TOTAL} etapas para {editando ? "editar" : "criar"} um dashboard de indicadores.
        </DialogDescription>
        <p className="sr-only" aria-live="polite" role="status">
          {`Etapa ${indice + 1} de ${TOTAL}: ${etapa.rotulo}`}
        </p>

        {/* Celular: barra de progresso no topo no lugar do trilho. */}
        <div className="shrink-0 px-4 pt-4 sm:hidden" aria-hidden="true">
          <p className="text-sm font-medium text-v2-nevoa">
            Etapa {indice + 1} de {TOTAL} · {etapa.rotulo}
          </p>
          <div className="mt-2 flex gap-1">
            {ETAPAS.map((e, i) => (
              <span key={e.id} className={cx("h-1 flex-1 rounded-full", i <= indice ? "bg-v2-azul-igt" : "bg-v2-casco-alto")} />
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Desktop: trilho lateral. */}
          <nav aria-label="Etapas" className="hidden w-52 shrink-0 flex-col gap-4 bg-v2-abismo/40 p-5 sm:flex">
            <p className="text-lg font-semibold text-v2-nevoa" aria-hidden="true">
              {titulo}
            </p>
            <ol className="flex flex-col gap-1">
              {ETAPAS.map((e, i) => {
                const atual = i === indice;
                const visitada = visitadas.has(e.id);
                const concluida = visitada && !atual;
                const comProblema = revisaoVisitada && etapasComProblema.has(e.id);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => irPara(i)}
                      disabled={!visitada || criando}
                      aria-current={atual ? "step" : undefined}
                      className={cx(
                        "flex min-h-11 w-full items-center gap-3 rounded-v2-sm px-2 text-left text-sm transition-opacity",
                        atual ? "bg-v2-casco-alto font-semibold text-v2-nevoa" : "text-v2-nevoa/80",
                        !visitada && "opacity-50",
                        foco,
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cx(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1 ring-inset",
                          comProblema
                            ? "bg-v2-queda/20 text-v2-queda ring-v2-queda"
                            : concluida
                              ? "bg-v2-azul-igt text-v2-abismo ring-v2-azul-igt"
                              : atual
                                ? "text-v2-azul-luz ring-v2-azul-luz"
                                : "text-v2-nevoa/60 ring-v2-nevoa/30",
                        )}
                      >
                        {comProblema ? <IconeAlerta /> : concluida ? <IconeCheck /> : i + 1}
                      </span>
                      <span>
                        {e.rotulo}
                        {comProblema && <span className="sr-only"> (com pendência)</span>}
                        {concluida && !comProblema && <span className="sr-only"> (concluída)</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div key={etapa.id} className="v2-etapa-entra">
                <h2 className="mb-4 text-xl font-semibold text-v2-nevoa">{etapa.rotulo}</h2>
                {conteudo}
              </div>
            </div>

            <div className="shrink-0 border-t border-v2-azul-luz/15 p-4 sm:px-6">
              {erro && (
                <p role="alert" className="mb-3 text-sm text-v2-queda">
                  {erro}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-end gap-3">
                {motivoBloqueio && (
                  <p id={idMotivo} className="mr-auto text-sm text-v2-nevoa/80">
                    {motivoBloqueio}
                  </p>
                )}
                <Button
                  variante="secundario"
                  className="min-h-11"
                  disabled={criando}
                  onClick={() => (indice === 0 ? onFechar() : irPara(indice - 1))}
                >
                  {indice === 0 ? "Cancelar" : "Voltar"}
                </Button>
                <Button
                  className="min-h-11"
                  disabled={criando || motivoBloqueio !== null}
                  aria-describedby={motivoBloqueio ? idMotivo : undefined}
                  onClick={continuar}
                >
                  {ultima
                    ? editando
                      ? criando
                        ? "Salvando..."
                        : "Salvar alterações"
                      : criando
                        ? "Criando..."
                        : "Criar dashboard"
                    : "Continuar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
