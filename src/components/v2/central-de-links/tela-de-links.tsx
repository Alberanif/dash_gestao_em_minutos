"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  baixarCopia,
  criarGrupo,
  definirCorDaPasta,
  definirPaginaAtiva,
  enviarArquivo,
  excluirGrupo,
  excluirLink,
  lerLink,
  lerTudo,
  removerArquivo,
  renomearPasta,
  reordenarGrupos,
  salvarLink,
  urlsDeMiniaturas,
} from "@/lib/central-de-links/dados";
import { buscarLinks, linksDoGrupo, mover, montarGrupos, ordemDasPastas, type MapaDeGrupos } from "@/lib/central-de-links/organizacao";
import { podeEditar } from "@/lib/central-de-links/papel";
import type { LinkDaCentral } from "@/lib/central-de-links/tipos";
import { COR_PADRAO, ehCorPasta, hexDaCor, type CorPasta, type ResultadoAcao } from "../eventos/pastas-regras";
import type { PastaConfig } from "../eventos/pastas";
import { PastaDialogo } from "../eventos/pasta-dialogos";
import { Button, Confirmar, Input, Surface } from "../ui";
import { CartaoDeLink } from "./cartao-de-link";
import { DialogoDeCopia } from "./dialogo-de-copia";
import { DialogoDeLink, type DadosDoLink } from "./dialogos";
import { LinhaDePasta } from "./linha-de-pasta";
import { usePapelCentral } from "./papel-context";
import {
  arquivarNoServidor,
  executarFila,
  navegadorIndisponivel,
  pendentesParaArquivar,
  type ResultadoDoItem,
} from "./fila-arquivamento";

type Carga = "carregando" | "pronto" | "erro";

type Confirmacao = {
  titulo: string;
  descricao: string;
  acao: () => Promise<void>;
  /** Verbo do botão; padrão "Excluir". */
  rotulo?: string;
};

type Fila = { total: number; processados: number; atual: string; parando: boolean };

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

function mensagem(e: unknown): string {
  return e instanceof Error && e.message ? e.message : "Não foi possível concluir a ação.";
}

function corDaPasta(grupos: MapaDeGrupos, nome: string): CorPasta {
  const cor = grupos[nome]?.cor;
  return ehCorPasta(cor) ? cor : COR_PADRAO;
}

function configDaPasta(grupos: MapaDeGrupos, nome: string): PastaConfig {
  const cor = corDaPasta(grupos, nome);
  return { id: nome, nome, descricao: "", marcador: "bg-[var(--pc)]", cor, hex: hexDaCor(cor) };
}

export function TelaDeLinks() {
  const papel = usePapelCentral();
  const editavel = podeEditar(papel);
  const sb = useMemo(() => createSupabaseBrowserClient(), []);

  const [carga, setCarga] = useState<Carga>("carregando");
  const [erroDeCarga, setErroDeCarga] = useState("");
  const [links, setLinks] = useState<LinkDaCentral[]>([]);
  const [grupos, setGrupos] = useState<MapaDeGrupos>({});

  // Pasta aberta (uma por vez). Na busca, abrem sozinhas as que têm resultado.
  const [aberta, setAberta] = useState<string | null>(null);
  // Link escolhido na relação ao lado da pasta: depois que a pasta abre, a faixa rola até o cartão dele.
  const [alvo, setAlvo] = useState<{ id: string } | null>(null);
  const [termo, setTermo] = useState("");
  const [erroDaPagina, setErroDaPagina] = useState("");
  const [miniaturas, setMiniaturas] = useState<Record<string, string>>({});
  const miniaturasRef = useRef<Record<string, string>>({});
  useEffect(() => {
    miniaturasRef.current = miniaturas;
  }, [miniaturas]);

  const [dialogoLink, setDialogoLink] = useState<{ link: LinkDaCentral | null; grupoInicial: string } | null>(null);
  const [criarPasta, setCriarPasta] = useState(false);
  const [editarPasta, setEditarPasta] = useState<string | null>(null);
  const idBusca = useId();
  const idPainel = useId();
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [copiaAberta, setCopiaAberta] = useState<LinkDaCentral | null>(null);
  // Link criado por um envio que falhou na etapa do arquivo: a nova tentativa edita esse, não duplica.
  const idParcial = useRef<string | null>(null);

  const [arquivandoIds, setArquivandoIds] = useState<Set<string>>(new Set());
  const [fila, setFila] = useState<Fila | null>(null);
  const [resumoFila, setResumoFila] = useState("");
  const pararFila = useRef(false);
  const linksRef = useRef<LinkDaCentral[]>([]);
  useEffect(() => {
    linksRef.current = links;
  }, [links]);

  const baixar = useCallback((caminho: string) => baixarCopia(sb, caminho), [sb]);

  const carregar = useCallback(async () => {
    try {
      const dados = await lerTudo(sb);
      setLinks(dados.links);
      setGrupos(montarGrupos(dados.grupos, dados.links));
      setCarga("pronto");
    } catch (e) {
      setErroDeCarga(mensagem(e));
      setCarga("erro");
    }
  }, [sb]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const nomesOrdenados = useMemo(() => ordemDasPastas(grupos), [grupos]);

  // Miniaturas: pede os endereços só dos cartões que estão à vista (pasta aberta ou resultado da busca).
  const buscandoAgora = termo.trim() !== "";
  useEffect(() => {
    const visiveis = buscandoAgora ? buscarLinks(links, termo.trim()) : links.filter((l) => l.grupo === aberta);
    const faltam = visiveis.map((l) => l.miniatura_path).filter((c): c is string => !!c && !(c in miniaturasRef.current));
    if (!faltam.length) return;
    let ativo = true;
    void urlsDeMiniaturas(sb, faltam).then((novas) => {
      if (ativo && Object.keys(novas).length) setMiniaturas((m) => ({ ...m, ...novas }));
    });
    return () => {
      ativo = false;
    };
  }, [sb, links, aberta, termo, buscandoAgora]);
  useEffect(() => {
    if (!alvo) return;
    const cartao = document.getElementById(`cartao-${alvo.id}`);
    if (!cartao) return;
    const reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    cartao.scrollIntoView({ behavior: reduzido ? "auto" : "smooth", inline: "center", block: "nearest" });
    cartao.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });
  }, [alvo]);
  const buscando = termo.trim() !== "";
  const pendentes = useMemo(() => pendentesParaArquivar(links).length, [links]);

  /** Executa uma escrita, recarrega e mostra o erro inline se falhar. */
  async function escrever(acao: () => Promise<void>) {
    setErroDaPagina("");
    try {
      await acao();
    } catch (e) {
      setErroDaPagina(mensagem(e));
      return;
    }
    await carregar();
  }

  /** Arquiva um link no servidor e relê o cartão; nunca lança (o resultado diz se deu certo). */
  async function arquivarLink(id: string): Promise<ResultadoDoItem> {
    setArquivandoIds((s) => new Set(s).add(id));
    try {
      const r = await arquivarNoServidor(id);
      try {
        const atualizado = await lerLink(sb, id);
        setLinks((ls) => (atualizado ? ls.map((l) => (l.id === id ? atualizado : l)) : ls.filter((l) => l.id !== id)));
      } catch {
        // a releitura é cosmética; o próximo carregamento corrige o cartão
      }
      return r;
    } finally {
      setArquivandoIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }

  async function arquivarUm(l: LinkDaCentral) {
    setErroDaPagina("");
    setResumoFila("");
    const r = await arquivarLink(l.id);
    if (!r.ok) setErroDaPagina(`Não foi possível arquivar "${l.label}". ${r.erro ?? ""}`.trim());
  }

  function pedirFila() {
    const ids = pendentesParaArquivar(linksRef.current).map((l) => l.id);
    if (!ids.length) return;
    setConfirmacao({
      titulo: "Arquivar pendentes",
      descricao: `${plural(ids.length, "página será arquivada", "páginas serão arquivadas")}, uma por vez. Pode levar vários minutos; você pode parar a qualquer momento.`,
      rotulo: "Arquivar",
      // Não espera a fila: o diálogo fecha e o painel de progresso assume.
      acao: async () => void rodarFila(ids),
    });
  }

  async function rodarFila(ids: string[]) {
    pararFila.current = false;
    setResumoFila("");
    setErroDaPagina("");
    let processados = 0;
    const rotulo = (id: string) => linksRef.current.find((l) => l.id === id)?.label ?? "";
    setFila({ total: ids.length, processados: 0, atual: rotulo(ids[0]), parando: false });
    const r = await executarFila(
      ids,
      (id) => {
        setFila({ total: ids.length, processados, atual: rotulo(id), parando: pararFila.current });
        return arquivarLink(id);
      },
      {
        deveParar: () => pararFila.current,
        aoTerminarItem: () => void processados++,
      },
    );
    setFila(null);
    const arquivadas = plural(r.feitos, "página arquivada", "páginas arquivadas");
    const partes = [r.parou ? `Fila interrompida: ${arquivadas}` : arquivadas];
    if (r.falhas) partes.push(plural(r.falhas, "falhou", "falharam"));
    let texto = `${partes.join(", ")}.`;
    const restantes = ids.length - r.feitos - r.falhas;
    if (r.parou) texto += ` ${plural(restantes, "ficou pendente", "ficaram pendentes")}.`;
    if (navegadorIndisponivel(r.erros)) {
      texto += " O navegador de captura não está disponível neste ambiente, então a página não pôde ser capturada aqui.";
    } else if (r.erros.length) {
      texto += ` Último erro: ${r.erros[r.erros.length - 1].erro}`;
    }
    setResumoFila(texto);
  }

  async function moverPasta(nome: string, dir: -1 | 1) {
    const itens = nomesOrdenados.map((n, i) => ({ nome: n, position: i }));
    const novos = mover(itens, nome, dir);
    if (novos) {
      await escrever(() => reordenarGrupos(sb, novos.map((n) => ({ nome: n.nome, position: n.position, pasta: grupos[n.nome]?.pasta ?? null }))));
    }
  }

  function pedirExclusaoDePasta(nome: string) {
    if (linksDoGrupo(links, nome).length > 0) {
      setErroDaPagina("Mova ou exclua os links da pasta antes de excluí-la.");
      return;
    }
    setConfirmacao({
      titulo: "Excluir pasta",
      descricao: `A pasta "${nome}" está vazia e será removida.`,
      acao: async () => {
        await excluirGrupo(sb, nome, links);
        setAberta((a) => (a === nome ? null : a));
      },
    });
  }

  function pedirExclusaoDeLink(l: LinkDaCentral) {
    setConfirmacao({
      titulo: "Excluir link",
      descricao: `O link "${l.label}" será removido da Central.`,
      acao: () => excluirLink(sb, l.id),
    });
  }

  function pedirRemocaoDeArquivo(l: LinkDaCentral) {
    setConfirmacao({
      titulo: "Remover arquivo",
      descricao: `A cópia de "${l.label}" será apagada e a página pública sai do ar.`,
      rotulo: "Remover",
      acao: () => removerArquivo(sb, l.id, l.arquivo_path as string, l.miniatura_path),
    });
  }

  async function removerDoModal(l: LinkDaCentral) {
    await removerArquivo(sb, l.id, l.arquivo_path as string, l.miniatura_path);
    await carregar();
  }

  async function confirmar() {
    if (!confirmacao) return;
    setConfirmando(true);
    await escrever(confirmacao.acao);
    setConfirmando(false);
    setConfirmacao(null);
  }

  async function salvarDoLink(dados: DadosDoLink) {
    const { arquivo, paginaAtiva, ...campos } = dados;
    const idExistente = dados.id ?? idParcial.current ?? undefined;
    const atual = links.find((l) => l.id === idExistente) ?? null;
    // A publicação (pagina_ativa) é escrita só por definirPaginaAtiva, depois do envio do arquivo.
    const id = await salvarLink(sb, { ...campos, id: idExistente }, links);
    try {
      let caminho = atual?.arquivo_path ?? null;
      if (arquivo) caminho = (await enviarArquivo(sb, id, arquivo)).arquivo_path;
      if (arquivo || paginaAtiva !== (atual?.pagina_ativa ?? false)) await definirPaginaAtiva(sb, id, paginaAtiva, caminho);
    } catch (e) {
      idParcial.current = id;
      await carregar();
      throw new Error(`O link foi salvo, mas o arquivo ou a publicação falhou: ${mensagem(e)}`);
    }
    idParcial.current = null;
    await carregar();
    // A cópia nasce privada: o arquivamento nunca liga a página pública.
    if (!idExistente && dados.arquivoAutomatico) {
      void arquivarLink(id).then((r) => {
        if (!r.ok) setErroDaPagina(`O link foi salvo, mas o arquivamento falhou. ${r.erro ?? ""}`.trim());
      });
    }
  }

  async function resultado<T extends object>(acao: () => Promise<T>): Promise<ResultadoAcao<T>> {
    try {
      return { ok: true, ...(await acao()) };
    } catch (e) {
      return { ok: false, erro: mensagem(e) };
    }
  }

  function salvarNovaPasta(nome: string, cor: CorPasta) {
    return resultado(async () => {
      if (grupos[nome]) throw new Error("Já existe uma pasta com esse nome.");
      await criarGrupo(sb, nome, null, grupos, cor);
      await carregar();
      setAberta(nome);
      return { id: nome };
    });
  }

  function salvarEdicaoDaPasta(atual: string, nome: string, cor: CorPasta) {
    return resultado(async () => {
      let destino = atual;
      if (nome !== atual) {
        await renomearPasta(sb, atual, nome);
        destino = nome;
        setAberta((a) => (a === atual ? nome : a));
      }
      if (cor !== corDaPasta(grupos, atual)) await definirCorDaPasta(sb, destino, cor);
      await carregar();
      return {};
    });
  }

  if (carga === "carregando") {
    return (
      <p role="status" className="py-10 text-center text-sm text-v2-nevoa/65">
        Carregando links…
      </p>
    );
  }

  if (carga === "erro") {
    return (
      <Surface role="alert" className="flex flex-col items-start gap-3">
        <p className="m-0 text-sm text-v2-queda">Não foi possível carregar a Central de links. {erroDeCarga}</p>
        <Button
          variante="secundario"
          onClick={() => {
            setCarga("carregando");
            void carregar();
          }}
        >
          Tentar de novo
        </Button>
      </Surface>
    );
  }

  // Na busca só ficam as pastas com resultado, todas abertas; fora dela, uma pasta aberta por vez.
  const achados = buscando ? new Set(buscarLinks(links, termo.trim()).map((l) => l.id)) : null;
  const linhas = nomesOrdenados
    .map((nome) => ({ nome, lista: linksDoGrupo(links, nome).filter((l) => !achados || achados.has(l.id)) }))
    .filter(({ lista }) => !buscando || lista.length > 0);
  const estaAberta = (nome: string) => (buscando ? true : aberta === nome);

  const cartao = (l: LinkDaCentral, indice: number, cor: string) => (
    <CartaoDeLink
      key={l.id}
      link={l}
      mostrarPasta={buscando}
      cor={cor}
      miniaturaUrl={l.miniatura_path ? miniaturas[l.miniatura_path] : undefined}
      indice={indice}
      editavel={editavel}
      onEditar={(x) => setDialogoLink({ link: x, grupoInicial: x.grupo })}
      onExcluir={pedirExclusaoDeLink}
      onVerCopia={setCopiaAberta}
      onRemoverArquivo={pedirRemocaoDeArquivo}
      onArquivar={(x) => void arquivarUm(x)}
      arquivando={arquivandoIds.has(l.id)}
      filaAtiva={fila !== null}
    />
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-light tracking-tight">Central de links</h2>
          <p className="mt-1 text-sm text-v2-nevoa/60">Organizados por pasta.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 @md:w-auto">
          <div className="w-full @md:w-72">
            <label htmlFor={idBusca} className="sr-only">
              Buscar links
            </label>
            <Input
              id={idBusca}
              type="search"
              placeholder="Buscar por nome ou URL…"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              autoComplete="off"
            />
          </div>
          {editavel && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setDialogoLink({ link: null, grupoInicial: aberta ?? "" })}>+ Link</Button>
              <Button variante="secundario" onClick={() => setCriarPasta(true)}>
                + Pasta
              </Button>
              {(pendentes > 0 || fila) && (
                <Button variante="secundario" disabled={fila !== null} onClick={pedirFila}>
                  {`Arquivar pendentes (${pendentes})`}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {fila && (
        <Surface role="status" className="flex flex-wrap items-center gap-3 p-3 text-sm" data-testid="fila-arquivamento">
          <span className="min-w-0 flex-1">
            {`Arquivando ${Math.min(fila.processados + 1, fila.total)} de ${fila.total}: ${fila.atual}`}
            {fila.parando && " (parando depois deste item…)"}
          </span>
          <Button
            variante="secundario"
            className="h-8 px-3"
            disabled={fila.parando}
            onClick={() => {
              pararFila.current = true;
              setFila((f) => (f ? { ...f, parando: true } : f));
            }}
          >
            Parar
          </Button>
        </Surface>
      )}

      {resumoFila && !fila && (
        <div role="status" data-testid="resumo-fila" className="flex items-start gap-3 rounded-v2-sm bg-v2-nevoa/10 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">{resumoFila}</span>
          <Button variante="secundario" className="h-8 px-3" onClick={() => setResumoFila("")}>
            Fechar
          </Button>
        </div>
      )}

      {erroDaPagina && (
        <p role="alert" className="m-0 rounded-v2-sm bg-v2-queda/15 px-3 py-2 text-sm text-v2-queda">
          {erroDaPagina}
        </p>
      )}

      <main aria-label="Pastas" className="min-w-0">
        {linhas.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-6 p-0">
            {linhas.map(({ nome, lista }, posicao) => {
              const pasta = configDaPasta(grupos, nome);
              return (
                <LinhaDePasta
                  key={nome}
                  pasta={pasta}
                  links={lista}
                  aberta={estaAberta(nome)}
                  idPainel={`${idPainel}-${posicao}`}
                  onAlternar={() => setAberta((a) => (a === nome ? null : nome))}
                  onEscolherLink={(id) => {
                    setAberta(nome);
                    setAlvo({ id });
                  }}
                  organizar={
                    editavel
                      ? {
                          primeira: nomesOrdenados[0] === nome,
                          ultima: nomesOrdenados[nomesOrdenados.length - 1] === nome,
                          onEditar: () => setEditarPasta(nome),
                          onExcluir: () => pedirExclusaoDePasta(nome),
                          onMover: (dir) => void moverPasta(nome, dir),
                          onNovoLink: () => setDialogoLink({ link: null, grupoInicial: nome }),
                        }
                      : undefined
                  }
                >
                  {lista.length === 0 ? (
                    <p className="m-0 text-sm text-v2-nevoa/55">Nenhum link nesta pasta.</p>
                  ) : (
                    <div className="v2-cl-faixa" tabIndex={0} role="group" aria-label={`Links de ${pasta.nome}`}>{lista.map((l, i) => cartao(l, i, pasta.hex))}</div>
                  )}
                </LinhaDePasta>
              );
            })}
          </ul>
        ) : buscando ? (
          <p className="m-0 text-sm text-v2-nevoa/65">Nenhum link encontrado.</p>
        ) : (
          <Surface className="max-w-xl" role="status">
            <h3 className="text-lg font-semibold">Nenhuma pasta ainda</h3>
            <p className="mt-2 text-sm text-v2-nevoa/70">
              {editavel ? "Crie a primeira pasta para organizar seus links." : "Quando um administrador criar pastas, elas aparecem aqui."}
            </p>
          </Surface>
        )}
      </main>

      <DialogoDeLink
        alvo={dialogoLink}
        grupos={nomesOrdenados}
        onFechar={() => {
          idParcial.current = null;
          setDialogoLink(null);
        }}
        onSalvar={salvarDoLink}
        onRemoverArquivo={removerDoModal}
      />
      <DialogoDeCopia link={copiaAberta} baixar={baixar} onFechar={() => setCopiaAberta(null)} />
      <PastaDialogo
        aberto={criarPasta}
        onAbertoChange={setCriarPasta}
        modo="criar"
        descricao="Dê um nome e escolha a cor. Depois é só colocar links nela."
        nomesOutros={nomesOrdenados}
        onSalvar={salvarNovaPasta}
      />
      {editarPasta !== null && grupos[editarPasta] && (
        <PastaDialogo
          key={editarPasta}
          aberto
          onAbertoChange={(v) => !v && setEditarPasta(null)}
          modo="editar"
          descricao="Mude o nome ou a cor da pasta. Os links dela acompanham o novo nome."
          inicial={{ nome: editarPasta, cor: corDaPasta(grupos, editarPasta) }}
          nomesOutros={nomesOrdenados.filter((n) => n !== editarPasta)}
          onSalvar={(nome, cor) => salvarEdicaoDaPasta(editarPasta, nome, cor)}
        />
      )}
      <Confirmar
        aberto={confirmacao !== null}
        onFechar={() => setConfirmacao(null)}
        onConfirmar={() => void confirmar()}
        titulo={confirmacao?.titulo ?? ""}
        descricao={confirmacao?.descricao}
        rotuloConfirmar={confirmacao?.rotulo ?? "Excluir"}
        carregando={confirmando}
      />
    </div>
  );
}
