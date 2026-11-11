"use client";

import { useEffect, useMemo, useState } from "react";
import type { VendasFolderRecord, VendasViewRecord } from "@/types/vendas";
import { parseDateRange } from "@/lib/vendas/date-range";
import { normalizeOfferCode } from "@/lib/vendas/views";
import { Button, Campo, Dialog, DialogClose, DialogContent, DialogTitle, Input, Select } from "../ui";
import { useRetornoDeFoco } from "./use-retorno-de-foco";
import type { ProdutoHotmart } from "./tipos";

export interface OpcaoDeOferta {
  offer_code: string;
  offer_name: string | null;
  sales_count?: number;
}

interface ModalDeVisualizacaoProps {
  products: ProdutoHotmart[];
  folders: VendasFolderRecord[];
  editTarget?: VendasViewRecord | null;
  onSaved: (view: VendasViewRecord, mode: "created" | "edited") => void;
  onCancel: () => void;
  // Só na edição: abre a confirmação de exclusão (que vive na tela, não aqui).
  onRequestDelete?: (view: VendasViewRecord) => void;
}

const SEM_PASTA = "__sem_pasta__";

const MENSAGEM_ULTIMA_OFERTA =
  "Uma visualização precisa de pelo menos uma oferta; para descartar, exclua a visualização.";

const rotulo = "text-[13px] font-medium text-v2-nevoa/70";

/**
 * Criar e editar visualização (PRD #185 RF-2/RF-3): nome, pasta, UM produto (travado na
 * edição), ofertas (lista + código manual, mínimo 1) e período. Sem meta, status, base
 * ou "incluir compras sem oferta".
 */
export function ModalDeVisualizacao({ products, folders, editTarget, onSaved, onCancel, onRequestDelete }: ModalDeVisualizacaoProps) {
  const edicao = Boolean(editTarget);
  const devolverFoco = useRetornoDeFoco();

  const [name, setName] = useState(editTarget?.name ?? "");
  const [folderId, setFolderId] = useState(editTarget?.folder_id ?? "");
  const [productId, setProductId] = useState(editTarget?.product_id ?? "");
  const [selecionadas, setSelecionadas] = useState<string[]>(editTarget?.offer_codes ?? []);
  const [inicio, setInicio] = useState(editTarget?.view_start_date ?? "");
  const [fim, setFim] = useState(editTarget?.view_end_date ?? "");

  const [opcoes, setOpcoes] = useState<OpcaoDeOferta[]>([]);
  const [carregandoOfertas, setCarregandoOfertas] = useState(false);
  const [erroDeOfertas, setErroDeOfertas] = useState(false);
  const [recargaDeOfertas, setRecargaDeOfertas] = useState(0);

  const [busca, setBusca] = useState("");
  const [manual, setManual] = useState("");
  const [mensagemDeOferta, setMensagemDeOferta] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!productId) return;
    let cancelado = false;
    async function carregar() {
      setCarregandoOfertas(true);
      setErroDeOfertas(false);
      try {
        const res = await fetch(`/api/vendas/offer-options?product_id=${encodeURIComponent(productId)}`);
        if (!res.ok) throw new Error("offer-options");
        const data = await res.json();
        if (!cancelado) setOpcoes(Array.isArray(data?.offers) ? data.offers : []);
      } catch {
        if (!cancelado) setErroDeOfertas(true);
      } finally {
        if (!cancelado) setCarregandoOfertas(false);
      }
    }
    void carregar();
    return () => {
      cancelado = true;
    };
  }, [productId, recargaDeOfertas]);

  // Lista = ofertas sincronizadas + selecionadas que a Hotmart não conhece (código
  // manual). Estas últimas nunca podem sumir da tela: contam na venda.
  const linhas: OpcaoDeOferta[] = useMemo(() => {
    const conhecidas = new Set(opcoes.map((o) => o.offer_code));
    const extras: OpcaoDeOferta[] = selecionadas
      .filter((code) => !conhecidas.has(code))
      .map((code) => ({ offer_code: code, offer_name: null }));
    return [...extras, ...opcoes];
  }, [opcoes, selecionadas]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return linhas;
    return linhas.filter(
      (o) =>
        selecionadas.includes(o.offer_code) ||
        o.offer_code.toLowerCase().includes(termo) ||
        (o.offer_name ?? "").toLowerCase().includes(termo),
    );
  }, [linhas, busca, selecionadas]);

  function alternarOferta(code: string) {
    setErro(null);
    if (selecionadas.includes(code)) {
      if (selecionadas.length === 1) {
        setMensagemDeOferta(MENSAGEM_ULTIMA_OFERTA);
        return;
      }
      setSelecionadas(selecionadas.filter((c) => c !== code));
    } else {
      setSelecionadas([...selecionadas, code]);
    }
    setMensagemDeOferta(null);
  }

  function adicionarManual() {
    const code = normalizeOfferCode(manual);
    if (!code) {
      setMensagemDeOferta("Informe um código de oferta.");
      return;
    }
    if (selecionadas.includes(code)) {
      setMensagemDeOferta(`A oferta ${code} já está na lista.`);
      return;
    }
    setSelecionadas([...selecionadas, code]);
    setManual("");
    setMensagemDeOferta(null);
  }

  function trocarProduto(proximo: string) {
    setProductId(proximo);
    setOpcoes([]);
    setSelecionadas([]);
    setBusca("");
    setMensagemDeOferta(null);
  }

  async function salvar() {
    const aparado = name.trim();
    if (!aparado) return setErro("Nome é obrigatório.");
    if (!productId) return setErro("Selecione um produto.");
    if (selecionadas.length === 0) return setErro("Selecione ao menos uma oferta.");

    let dataInicial: string | null = null;
    let dataFinal: string | null = null;
    if (inicio || fim) {
      if (!inicio || !fim) return setErro("Preencha as duas datas do período ou deixe ambas vazias.");
      const periodo = parseDateRange(inicio, fim);
      if (!periodo) return setErro("A data final não pode ser anterior à inicial.");
      dataInicial = periodo.start;
      dataFinal = periodo.end;
    }

    setErro(null);
    setSalvando(true);
    try {
      const res = await fetch(edicao ? `/api/vendas/views/${editTarget!.id}` : "/api/vendas/views", {
        method: edicao ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          edicao
            ? {
                name: aparado,
                folder_id: folderId || null,
                offer_codes: selecionadas,
                view_start_date: dataInicial,
                view_end_date: dataFinal,
              }
            : {
                name: aparado,
                folder_id: folderId || null,
                product_id: productId,
                offer_codes: selecionadas,
                view_start_date: dataInicial,
                view_end_date: dataFinal,
              },
        ),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.view) {
        setErro(data?.error ?? "Erro ao salvar a visualização.");
        return;
      }
      onSaved(data.view as VendasViewRecord, edicao ? "edited" : "created");
    } catch {
      setErro("Erro de conexão ao salvar a visualização.");
    } finally {
      setSalvando(false);
    }
  }

  const nomeDoProduto = products.find((p) => p.product_id === productId)?.product_name ?? productId;
  const titulo = edicao ? "Editar visualização" : "Nova visualização";

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && !salvando && onCancel()}>
      <DialogContent
        data-testid="view-form-modal"
        aria-describedby={undefined}
        onCloseAutoFocus={devolverFoco}
        className="max-h-[90vh] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto"
      >
        <DialogTitle className="text-lg font-bold">{titulo}</DialogTitle>

        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
        >
          <Campo rotulo="Nome">
            {(p) => (
              <Input
                {...p}
                data-testid="view-form-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Pitch PC Ao Vivo"
              />
            )}
          </Campo>

          <div className="flex flex-col gap-1.5">
            <span className={rotulo}>Pasta (opcional)</span>
            <Select
              aria-label="Pasta"
              value={folderId || SEM_PASTA}
              onValueChange={(v) => setFolderId(v === SEM_PASTA ? "" : v)}
              opcoes={[{ value: SEM_PASTA, label: "Sem pasta" }, ...folders.map((f) => ({ value: f.id, label: f.name }))]}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={rotulo}>Produto</span>
            {edicao ? (
              <>
                <Select
                  aria-label="Produto"
                  value={productId}
                  disabled
                  opcoes={[{ value: productId, label: nomeDoProduto }]}
                />
                <p data-testid="view-form-product-locked" className="text-xs text-v2-nevoa/65">
                  O produto não pode ser alterado depois de criada a visualização, porque o histórico coletado pertence a
                  ele. Para acompanhar outro produto, crie uma nova visualização.
                </p>
              </>
            ) : (
              <Select
                aria-label="Produto"
                value={productId || undefined}
                onValueChange={trocarProduto}
                placeholder="Selecione um produto"
                opcoes={products.map((p) => ({ value: p.product_id, label: p.product_name }))}
              />
            )}
          </div>

          {productId && (
            <div data-testid="view-form-offers" className="flex flex-col gap-2">
              <span className={rotulo}>
                Ofertas ({selecionadas.length} selecionada{selecionadas.length === 1 ? "" : "s"})
              </span>

              {carregandoOfertas && <p className="text-xs text-v2-nevoa/65">Carregando ofertas…</p>}
              {erroDeOfertas && (
                <div className="flex flex-wrap items-center gap-2">
                  <p data-testid="view-form-offers-error" className="text-xs text-v2-queda">
                    Não foi possível carregar as ofertas. Você ainda pode adicionar códigos manualmente.
                  </p>
                  <Button variante="fantasma" className="h-8 px-2 text-xs" onClick={() => setRecargaDeOfertas((n) => n + 1)}>
                    Tentar novamente
                  </Button>
                </div>
              )}

              <Input
                data-testid="view-form-offer-search"
                aria-label="Buscar oferta"
                placeholder="Buscar por nome ou código"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />

              <ul className="flex max-h-52 flex-col gap-0.5 overflow-y-auto rounded-v2-sm bg-v2-abismo/40 p-1">
                {visiveis.map((o) => {
                  const marcada = selecionadas.includes(o.offer_code);
                  return (
                    <li key={o.offer_code}>
                      <label className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-sm text-v2-nevoa hover:bg-v2-nevoa/5">
                        <input
                          type="checkbox"
                          data-testid={`view-form-offer-${o.offer_code}`}
                          checked={marcada}
                          onChange={() => alternarOferta(o.offer_code)}
                          className="size-4 shrink-0 accent-[var(--v2-azul-igt)]"
                        />
                        <span className="min-w-0 [overflow-wrap:anywhere]">
                          {o.offer_name ? `${o.offer_name}, ` : ""}
                          <code className="text-v2-nevoa/70">{o.offer_code}</code>
                          {typeof o.sales_count === "number" && (
                            <span className="text-v2-nevoa/60">, {o.sales_count} vendas</span>
                          )}
                          {o.offer_name === null && !carregandoOfertas && <span className="text-v2-nevoa/60">, manual</span>}
                        </span>
                      </label>
                    </li>
                  );
                })}
                {!carregandoOfertas && visiveis.length === 0 && (
                  <li className="px-2 py-1.5 text-sm text-v2-nevoa/65">Nenhuma oferta encontrada.</li>
                )}
              </ul>

              <div className="flex gap-2">
                <Input
                  data-testid="view-form-manual-input"
                  aria-label="Código da oferta"
                  placeholder="Adicionar código manualmente"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      adicionarManual();
                    }
                  }}
                />
                <Button variante="secundario" data-testid="view-form-manual-add" onClick={adicionarManual}>
                  Adicionar
                </Button>
              </div>

              {mensagemDeOferta && (
                <p role="alert" data-testid="view-form-offer-message" className="text-xs text-v2-queda">
                  {mensagemDeOferta}
                </p>
              )}
              {edicao && (
                <p className="text-xs text-v2-nevoa/65">
                  Ofertas adicionadas disparam a coleta do histórico delas. Remover uma oferta não apaga vendas coletadas.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className={rotulo}>Período (opcional)</span>
            <div className="flex flex-wrap gap-2">
              <Input
                type="date"
                aria-label="Data inicial"
                data-testid="view-form-start"
                className="flex-1 basis-36"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
              <Input
                type="date"
                aria-label="Data final"
                data-testid="view-form-end"
                className="flex-1 basis-36"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
              />
            </div>
            <p className="text-xs text-v2-nevoa/65">Sem período, o histórico coletado cobre os últimos 90 dias.</p>
          </div>

          {erro && (
            <p role="alert" data-testid="view-form-error" className="rounded-v2-sm bg-v2-queda/10 px-3 py-2 text-sm text-v2-queda">
              {erro}
            </p>
          )}

          <div className="flex items-center justify-end gap-3">
            {edicao && onRequestDelete && editTarget && (
              <Button
                variante="fantasma"
                data-testid="view-form-delete-open"
                className="mr-auto text-v2-queda"
                onClick={() => onRequestDelete(editTarget)}
                disabled={salvando}
              >
                Excluir visualização
              </Button>
            )}
            <DialogClose asChild>
              <Button variante="secundario" data-testid="view-form-cancel" disabled={salvando}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" data-testid="view-form-save" disabled={salvando}>
              {salvando ? "Salvando…" : edicao ? "Salvar alterações" : "Criar visualização"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
