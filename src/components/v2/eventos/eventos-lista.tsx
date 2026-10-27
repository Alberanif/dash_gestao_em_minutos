"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useId, useMemo, useOptimistic, useRef, useState, type CSSProperties } from "react";
import type { FilterRecord } from "@/types/indicadores";
import { matchesEventoSearch } from "@/lib/indicadores/eventos";
import { Button } from "../ui/button";
import { Surface } from "../ui/surface";
import { cx, foco } from "../ui/cx";
import { PastaArquivo, PastaNova } from "./pasta-arquivo";
import { ExclusaoDialogo, PastaDialogo } from "./pasta-dialogos";
import { MenuCartao, MenuPasta } from "./pasta-menus";
import { useEntradaCartao } from "./entrada-cartao";
import { BotaoNovoEvento } from "./novo-evento/botao-novo-evento";
import { ExcluirEvento } from "./excluir-evento";
import type { PropsAssistente } from "./novo-evento/estado";

// Mesmo carregamento sob demanda do botão "Novo evento": o assistente só baixa quando alguém edita.
const AssistenteNovoEvento = dynamic<PropsAssistente>(() => import("./novo-evento/assistente").then((m) => m.AssistenteNovoEvento), {
  ssr: false,
});
import { periodoDoEvento } from "./periodo";
import {
  POR_FILEIRA,
  colunasDaFileira,
  estadoDoEvento,
  eventosDaPasta,
  eventosSemPasta,
  hrefDoEvento,
  pastaDoUsuario,
  type PastaConfig,
} from "./pastas";
import { LIMITE_PASTAS, type AcoesPastas } from "./pastas-regras";
import type { PastaUsuario } from "./pastas-servidor";

type Props = {
  /** Conta dona dos eventos: o assistente "Novo evento" cria nela. */
  accountId: string;
  filters: FilterRecord[];
  /** Pastas criadas pelo usuário, com os eventos de cada uma. */
  pastasUsuario?: PastaUsuario[];
  /** false quando a migration das pastas ainda não foi aplicada: a tela mostra só a lista de eventos, sem pastas. */
  pastasDisponiveis?: boolean;
  acoes?: AcoesPastas;
};

const NOVA = "__nova";

type Casa = { chave: string; pasta?: PastaConfig };

function emFileiras<T>(itens: T[]): T[][] {
  const filas: T[][] = [];
  for (let i = 0; i < itens.length; i += POR_FILEIRA) filas.push(itens.slice(i, i + POR_FILEIRA));
  return filas;
}

type Vista = { pastas: PastaUsuario[]; movidos: string[] };

const SEM_PASTAS: PastaUsuario[] = [];

/**
 * Move o evento na hora: sai de todas as pastas do usuário e entra só nas escolhidas. O id também vai para
 * `movidos` na mesma atualização, para o painel saber que a saída do cartão foi pedida pelo usuário.
 */
function moverEvento(vista: Vista, mov: { eventoId: string; pastaIds: string[] }): Vista {
  return {
    movidos: [...vista.movidos, mov.eventoId],
    pastas: vista.pastas.map((p) => {
      const sem = p.eventoIds.filter((id) => id !== mov.eventoId);
      return { ...p, eventoIds: mov.pastaIds.includes(p.id) ? [...sem, mov.eventoId] : sem };
    }),
  };
}

export function EventosLista({ accountId, filters, pastasUsuario: pastasDoServidor = SEM_PASTAS, pastasDisponiveis = false, acoes: acoesDoServidor }: Props) {
  // A tela muda assim que o usuário escolhe; se a gravação falhar, volta sozinha para o que está no banco.
  const doServidor = useMemo<Vista>(() => ({ pastas: pastasDoServidor, movidos: [] }), [pastasDoServidor]);
  const [{ pastas: pastasUsuario, movidos }, moverNaHora] = useOptimistic(doServidor, moverEvento);
  const acoes = useMemo<AcoesPastas | undefined>(
    () =>
      acoesDoServidor && {
        ...acoesDoServidor,
        definirPastasDoEvento: (eventoId, pastaIds) => {
          moverNaHora({ eventoId, pastaIds });
          return acoesDoServidor.definirPastasDoEvento(eventoId, pastaIds);
        },
      },
    [acoesDoServidor, moverNaHora],
  );
  const [busca, setBusca] = useState("");
  const [escolhida, setEscolhida] = useState<string | null>(null);
  // Pasta que acabou de ser fechada: seus arquivos ficam uns instantes na tela, saindo.
  const [saindo, setSaindo] = useState<string | null>(null);
  // Pasta recém-criada: nasce com uma animação própria.
  const [nova, setNova] = useState<string | null>(null);
  const [criarAberto, setCriarAberto] = useState(false);
  const [editar, setEditar] = useState<{ id: string | null; aberto: boolean }>({ id: null, aberto: false });
  const [excluir, setExcluir] = useState<{ id: string | null; aberto: boolean }>({ id: null, aberto: false });
  const idBusca = useId();
  const idPainel = useId();
  const lista = useRef<HTMLUListElement>(null);
  const rolar = useRef(false);

  const podeOrganizar = pastasDisponiveis && acoes !== undefined;
  const todas = useMemo(() => pastasUsuario.map(pastaDoUsuario), [pastasUsuario]);
  // Pasta apagada (ou criada e ainda a caminho): nenhuma fica aberta.
  const ativaId = todas.some((p) => p.id === escolhida) ? escolhida : null;

  function escolher(id: string) {
    if (id === ativaId) return;
    setSaindo(ativaId);
    setEscolhida(id);
  }

  useEffect(() => {
    if (saindo === null) return;
    const t = setTimeout(() => setSaindo(null), TEMPO_SAIDA);
    return () => clearTimeout(t);
  }, [saindo]);

  useEffect(() => {
    if (nova === null) return;
    const t = setTimeout(() => setNova(null), 1600);
    return () => clearTimeout(t);
  }, [nova]);

  // Em tela estreita as pastas ficam em coluna: a tela rola até a pasta aberta.
  useEffect(() => {
    if (!rolar.current) return;
    rolar.current = false;
    const raiz = lista.current;
    if (!raiz) return;
    const pastas = raiz.querySelectorAll<HTMLElement>("[data-slot-pasta]");
    if (pastas.length < 2 || pastas[0].offsetTop === pastas[1].offsetTop) return;
    const alvo = raiz.querySelector<HTMLElement>(`[data-slot-pasta="${ativaId}"]`);
    const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    alvo?.scrollIntoView?.({ behavior: reduzido ? "auto" : "smooth", block: "start" });
  }, [ativaId]);

  const buscando = busca.trim() !== "";
  const visiveis = filters.filter((f) => matchesEventoSearch(f, busca));

  // Ao buscar, abre a pasta com mais resultados (no empate, a primeira).
  function buscar(termo: string) {
    setBusca(termo);
    if (termo.trim() === "") return;
    const achados = filters.filter((f) => matchesEventoSearch(f, termo));
    const total = (p: PastaConfig) => eventosDaPasta(p, achados, pastasUsuario).length;
    if (todas.length === 0) return;
    const melhor = todas.reduce((a, b) => (total(b) > total(a) ? b : a));
    if (total(melhor) > 0) escolher(melhor.id);
  }

  const casas: Casa[] = [
    ...(podeOrganizar ? todas.map((pasta) => ({ chave: pasta.id, pasta })) : []),
    ...(podeOrganizar ? [{ chave: NOVA }] : []),
  ];
  const nomesUsuario = pastasUsuario.map((p) => p.nome);
  const emEdicao = pastasUsuario.find((p) => p.id === editar.id);
  const emExclusao = pastasUsuario.find((p) => p.id === excluir.id);

  return (
    <div className="mt-2 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-light tracking-tight">Eventos</h2>
          <p className="mt-1 text-sm text-v2-nevoa/60">Organizados por pasta.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 @md:w-auto @md:flex-nowrap">
        <div className="w-full @md:w-72">
          <label htmlFor={idBusca} className="sr-only">
            Buscar evento
          </label>
          <input
            id={idBusca}
            type="search"
            value={busca}
            onChange={(e) => buscar(e.target.value)}
            placeholder="Buscar evento"
            autoComplete="off"
            className={cx(
              "h-10 w-full rounded-v2-sm bg-v2-casco px-3 text-sm text-v2-nevoa shadow-v2-1 ring-1 ring-inset ring-v2-azul-luz/15",
              "placeholder:text-v2-nevoa/40",
              foco,
            )}
          />
        </div>
        <BotaoNovoEvento accountId={accountId} />
        </div>
      </div>

      {buscando && visiveis.length === 0 ? (
        <Surface className="max-w-xl" role="status">
          <h3 className="text-lg font-semibold">Nenhum evento com “{busca.trim()}”</h3>
          <p className="mt-2 text-sm text-v2-nevoa/70">Confira a grafia ou limpe a busca para ver todos os eventos.</p>
          <Button variante="secundario" className="mt-4" onClick={() => setBusca("")}>
            Limpar busca
          </Button>
        </Surface>
      ) : (
        <>
        {casas.length > 0 && (
        // Telas largas: três pastas por fileira e o painel logo abaixo da fileira da pasta aberta. Estreitas: cada painel
        // logo abaixo da sua pasta. A pasta aberta vai para o meio da sua fileira: cada pasta desliza (só transform).
        <ul ref={lista} className="relative grid grid-cols-1 gap-x-6 gap-y-4 @2xl:grid-cols-3 @2xl:gap-y-0">
          {emFileiras(casas).map((fila, f) => {
            const colunas = colunasDaFileira(
              fila.map((c) => c.chave),
              ativaId,
            );
            return fila.map((casa, i) => {
              const pasta = casa.pasta;
              const estilo = { "--d": colunas[i] - i, "--fila": f, "--col": i } as CSSProperties;
              return (
                <li key={casa.chave} className="contents">
                  <div
                    data-slot-pasta={casa.chave}
                    data-nova={pasta && nova === pasta.id ? "" : undefined}
                    style={estilo}
                    className="v2-pasta-lugar flex justify-center @2xl:pb-4"
                  >
                    {pasta ? (
                      <div className="relative w-full max-w-[15rem]">
                        <PastaArquivo
                          pasta={pasta}
                          total={eventosDaPasta(pasta, visiveis, pastasUsuario).length}
                          selecionada={ativaId === pasta.id}
                          idPainel={idPainel}
                          onSelecionar={() => {
                            rolar.current = true;
                            escolher(pasta.id);
                          }}
                        />
                        <div className="absolute right-0 top-0 z-10">
                          <MenuPasta
                            nome={pasta.nome}
                            onEditar={() => setEditar({ id: pasta.id, aberto: true })}
                            onExcluir={() => setExcluir({ id: pasta.id, aberto: true })}
                          />
                        </div>
                      </div>
                    ) : (
                      <PastaNova
                        onAbrir={() => setCriarAberto(true)}
                        desabilitada={pastasUsuario.length >= LIMITE_PASTAS}
                        motivo={`Limite de ${LIMITE_PASTAS} pastas`}
                      />
                    )}
                  </div>
                  {pasta && saindo === pasta.id && (
                    <PainelEventos
                      id={`${idPainel}-saindo`}
                      pasta={pasta}
                      fila={f}
                      eventos={eventosDaPasta(pasta, visiveis, pastasUsuario)}
                      buscando={buscando}
                      pastasUsuario={pastasUsuario}
                      movidos={movidos}
                      acoes={podeOrganizar ? acoes : undefined}
                      saindo
                    />
                  )}
                  {pasta && ativaId === pasta.id && (
                    <PainelEventos
                      id={idPainel}
                      pasta={pasta}
                      fila={f}
                      eventos={eventosDaPasta(pasta, visiveis, pastasUsuario)}
                      buscando={buscando}
                      pastasUsuario={pastasUsuario}
                      movidos={movidos}
                      acoes={podeOrganizar ? acoes : undefined}
                    />
                  )}
                </li>
              );
            });
          })}
        </ul>
        )}
        <EventosSemPasta
          eventos={eventosSemPasta(visiveis, pastasUsuario)}
          comTitulo={podeOrganizar}
          pastasUsuario={pastasUsuario}
          movidos={movidos}
          acoes={podeOrganizar ? acoes : undefined}
        />
        </>
      )}

      {podeOrganizar && acoes && (
        <>
          <PastaDialogo
            aberto={criarAberto}
            onAbertoChange={setCriarAberto}
            modo="criar"
            nomesOutros={nomesUsuario}
            onSalvar={async (nome, cor) => {
              const r = await acoes.criar(nome, cor);
              if (r.ok) {
                rolar.current = true;
                setNova(r.id);
                escolher(r.id);
              }
              return r;
            }}
          />
          {emEdicao && (
            <PastaDialogo
              key={emEdicao.id}
              aberto={editar.aberto}
              onAbertoChange={(aberto) => setEditar((e) => ({ ...e, aberto }))}
              modo="editar"
              inicial={{ nome: emEdicao.nome, cor: emEdicao.cor }}
              nomesOutros={nomesUsuario.filter((n) => n !== emEdicao.nome)}
              onSalvar={(nome, cor) => acoes.atualizar(emEdicao.id, nome, cor)}
            />
          )}
          {emExclusao && (
            <ExclusaoDialogo
              key={emExclusao.id}
              aberto={excluir.aberto}
              onAbertoChange={(aberto) => setExcluir((e) => ({ ...e, aberto }))}
              nome={emExclusao.nome}
              total={emExclusao.eventoIds.length}
              onExcluir={() => acoes.excluir(emExclusao.id)}
            />
          )}
        </>
      )}
    </div>
  );
}

/** Tempo que os arquivos da pasta anterior levam para sair (casa com v2-arquivo-sai no CSS). */
const TEMPO_SAIDA = 150;

/** Tempo da despedida de um evento movido (casa com v2-arquivo-movido no CSS). */
const TEMPO_DESPEDIDA = 450;

/**
 * Eventos do painel. Um evento que o usuário acabou de mover para outra pasta não some de uma vez:
 * fica no lugar, "indo", durante a animação de saída e só então deixa a lista.
 */
function useComDespedida(eventos: FilterRecord[], movidos: string[]): { evento: FilterRecord; indo: boolean }[] {
  const chave = eventos.map((e) => e.id).join();
  const [anterior, setAnterior] = useState({ chave, eventos });
  const [indo, setIndo] = useState<{ evento: FilterRecord; indice: number }[]>([]);

  if (anterior.chave !== chave) {
    setAnterior({ chave, eventos });
    const ids = new Set(eventos.map((e) => e.id));
    const saiu = anterior.eventos
      .map((evento, indice) => ({ evento, indice }))
      .filter(({ evento }) => !ids.has(evento.id) && movidos.includes(evento.id));
    if (saiu.length > 0) setIndo((atual) => [...atual.filter((a) => ids.has(a.evento.id) === false), ...saiu]);
  }

  useEffect(() => {
    if (indo.length === 0) return;
    const t = setTimeout(() => setIndo([]), TEMPO_DESPEDIDA);
    return () => clearTimeout(t);
  }, [indo]);

  const lista = eventos.map((evento) => ({ evento, indo: false }));
  for (const { evento, indice } of indo) {
    if (!lista.some((l) => l.evento.id === evento.id)) lista.splice(Math.min(indice, lista.length), 0, { evento, indo: true });
  }
  return lista;
}

type PainelProps = {
  id: string;
  pasta: PastaConfig;
  /** Fileira da pasta: o painel abre logo abaixo dela. */
  fila: number;
  eventos: FilterRecord[];
  buscando: boolean;
  pastasUsuario: PastaUsuario[];
  /** Eventos que o usuário acabou de mover de pasta. */
  movidos: string[];
  acoes?: AcoesPastas;
  /** Pasta que acabou de fechar: os arquivos saem rápido e já não recebem clique. */
  saindo?: boolean;
};

function PainelEventos({ id, pasta, fila, eventos: daPasta, buscando, pastasUsuario, movidos, acoes, saindo }: PainelProps) {
  const eventos = useComDespedida(daPasta, movidos);
  return (
    <div
      id={id}
      role="region"
      aria-label={pasta.nome}
      aria-hidden={saindo ? true : undefined}
      data-saindo={saindo ? "" : undefined}
      style={{ "--fila": fila } as CSSProperties}
      className="v2-painel inset-x-0 @2xl:col-span-3 @2xl:col-start-1 @2xl:pb-4"
    >
      <p className="mb-3 text-sm text-v2-nevoa/60">{pasta.descricao}</p>
      {eventos.length === 0 ? (
        <p className="py-1 text-sm text-v2-nevoa/50">
          {buscando
            ? "Nenhum evento encontrado nesta pasta."
            : "Nenhum evento nesta pasta ainda. Use o botão de pastas no cartão de um evento para colocá-lo aqui."}
        </p>
      ) : (
        <GradeEventos eventos={eventos} pasta={pasta} pastasUsuario={pastasUsuario} acoes={acoes} />
      )}
    </div>
  );
}

type GradeProps = {
  eventos: { evento: FilterRecord; indo: boolean }[];
  /** Pasta aberta; sem ela, são os eventos que não estão em pasta. */
  pasta?: PastaConfig;
  pastasUsuario: PastaUsuario[];
  acoes?: AcoesPastas;
};

function GradeEventos({ eventos, pasta, pastasUsuario, acoes }: GradeProps) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
      {eventos.map(({ evento, indo }, i) => (
        <li
          key={evento.id}
          className="v2-arquivo"
          data-movido={indo ? "" : undefined}
          inert={indo}
          style={{ "--i": Math.min(i, 8) } as CSSProperties}
        >
          <CartaoEvento evento={evento} pasta={pasta} pastasUsuario={pastasUsuario} acoes={acoes} indo={indo} />
        </li>
      ))}
    </ul>
  );
}

type SemPastaProps = {
  eventos: FilterRecord[];
  /** Com pastas na tela, a lista ganha título; sem elas, é a única coisa na tela. */
  comTitulo: boolean;
  pastasUsuario: PastaUsuario[];
  movidos: string[];
  acoes?: AcoesPastas;
};

/** Eventos que não estão em nenhuma pasta. Um evento recém-colocado numa pasta sai daqui pela mesma animação de despedida. */
function EventosSemPasta({ eventos: soltos, comTitulo, pastasUsuario, movidos, acoes }: SemPastaProps) {
  const eventos = useComDespedida(soltos, movidos);
  if (eventos.length === 0) return null;
  return (
    <section aria-label="Eventos sem pasta" className="space-y-3">
      {comTitulo && <h3 className="text-sm font-medium text-v2-nevoa/70">Sem pasta</h3>}
      <GradeEventos eventos={eventos} pastasUsuario={pastasUsuario} acoes={acoes} />
    </section>
  );
}

type CartaoProps = {
  evento: FilterRecord;
  pasta?: PastaConfig;
  pastasUsuario: PastaUsuario[];
  acoes?: AcoesPastas;
  indo?: boolean;
};


function CartaoEvento({ evento, pasta, pastasUsuario, acoes, indo }: CartaoProps) {
  const cancelado = evento.status === "cancelado";
  const status = estadoDoEvento(evento.status);
  const href = hrefDoEvento(evento.id);
  const { ref, aoClicar, overlay } = useEntradaCartao<HTMLElement>(href);
  const [dialogo, setDialogo] = useState<"editar" | "excluir" | null>(null);

  return (
    <article
      ref={ref}
      data-testid={`evento-card-${evento.id}`}
      className={cx(
        "v2-cartao group relative flex h-full min-h-48 flex-col overflow-hidden rounded-v2-md p-6 shadow-v2-1",
        "transition-transform duration-[240ms] hover:-translate-y-0.5",
        // Brilho azul numa camada própria: só a opacidade anima.
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-v2-md before:opacity-0 before:shadow-v2-brilho-azul before:transition-opacity before:duration-[240ms] hover:before:opacity-100",
        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-v2-azul-luz",
        cancelado && "opacity-60",
      )}
    >
      <span aria-hidden="true" className="v2-cartao-aura" />
      <span aria-hidden="true" className="v2-cartao-trama" />
      <BotaoEntrar />
      <span className="v2-cartao-status relative inline-flex items-center gap-2 self-start rounded-full px-3 py-1 text-xs font-medium text-v2-nevoa/85">
        <span aria-hidden="true" className={cx("size-1.5 shrink-0 rounded-full", status.marcador)} />
        {status.rotulo}
      </span>
      <h4 className="mt-5 line-clamp-2 text-[1.75rem] font-semibold leading-[1.15] tracking-tight">
        <Link
          href={href}
          onClick={aoClicar}
          className="outline-none after:absolute after:inset-0 after:z-10 after:rounded-v2-md"
        >
          {evento.name}
        </Link>
      </h4>
      <p className="v2-cartao-periodo relative mt-auto flex items-center gap-2 pr-20 pt-5 text-sm text-v2-nevoa/60">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
          <path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
        <span>{periodoDoEvento(evento)}</span>
      </p>
      <MenuCartao
        eventoId={evento.id}
        eventoNome={evento.name}
        pastas={pastasUsuario}
        acoes={acoes}
        onEditar={() => setDialogo("editar")}
        onExcluir={() => setDialogo("excluir")}
        pastaAtualId={pasta?.id}
        indo={indo}
      />
      {dialogo === "editar" && <AssistenteNovoEvento accountId={evento.account_id} evento={evento} onFechar={() => setDialogo(null)} />}
      {dialogo === "excluir" && <ExcluirEvento eventoId={evento.id} nome={evento.name} onFechar={() => setDialogo(null)} />}
      {overlay}
    </article>
  );
}

/**
 * Botão de entrar. É só visual: o link do nome cobre o cartão inteiro, e o hover ou o foco do cartão
 * enchem o disco de azul. A seta diz que o cartão abre o dashboard.
 */
function BotaoEntrar() {
  return (
    <span aria-hidden="true" className="v2-entrar">
      <svg viewBox="0 0 24 24" className="v2-entrar-seta" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    </span>
  );
}
