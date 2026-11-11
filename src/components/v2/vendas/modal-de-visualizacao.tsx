"use client";

import { useMemo, useState } from "react";
import type { VendasFolderRecord, VendasViewRecord } from "@/types/vendas";
import { parseDateRange } from "@/lib/vendas/date-range";
import { Button, Campo, Dialog, DialogClose, DialogContent, DialogTitle, Input, Select } from "../ui";
import { BlocoDoProduto } from "./bloco-do-produto";
import { EscolhaDeProduto } from "./escolha-de-produto";
import { useRetornoDeFoco } from "./use-retorno-de-foco";
import type { ProdutoHotmart } from "./tipos";

interface ModalDeVisualizacaoProps {
  products: ProdutoHotmart[];
  folders: VendasFolderRecord[];
  editTarget?: VendasViewRecord | null;
  onSaved: (view: VendasViewRecord, mode: "created" | "edited") => void;
  onCancel: () => void;
  // Só na edição: abre a confirmação de exclusão (que vive na tela, não aqui).
  onRequestDelete?: (view: VendasViewRecord) => void;
}

interface BlocoState {
  product_id: string;
  offer_codes: string[];
  aberto: boolean;
}

const SEM_PASTA = "__sem_pasta__";

const MENSAGEM_ULTIMO_PRODUTO =
  "Uma visualização precisa de pelo menos um produto; para descartar, exclua a visualização.";

const rotulo = "text-[13px] font-medium text-v2-nevoa/70";

/**
 * Criar e editar visualização (PRD #185 RF-2/RF-3, PRD #213): nome, pasta, N produtos da mesma
 * conta Hotmart (cada um com a sua lista de ofertas, mínimo 1 produto e 1 oferta por produto)
 * e período. Na edição dá para adicionar e remover produtos. Sem meta, status, base ou
 * "incluir compras sem oferta".
 */
export function ModalDeVisualizacao({ products, folders, editTarget, onSaved, onCancel, onRequestDelete }: ModalDeVisualizacaoProps) {
  const edicao = Boolean(editTarget);
  const devolverFoco = useRetornoDeFoco();

  const [name, setName] = useState(editTarget?.name ?? "");
  const [folderId, setFolderId] = useState(editTarget?.folder_id ?? "");
  const [blocos, setBlocos] = useState<BlocoState[]>(() =>
    (editTarget?.products ?? []).map((p, i) => ({ product_id: p.product_id, offer_codes: [...p.offer_codes], aberto: i === 0 })),
  );
  const [inicio, setInicio] = useState(editTarget?.view_start_date ?? "");
  const [fim, setFim] = useState(editTarget?.view_end_date ?? "");

  const [mensagemDeProduto, setMensagemDeProduto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const nomeDe = (id: string) => products.find((p) => p.product_id === id)?.product_name ?? id;

  // Candidatos a adicionar: ainda não escolhidos e da mesma conta dos já escolhidos.
  const candidatos = useMemo(() => {
    const escolhidos = new Set(blocos.map((b) => b.product_id));
    const conta = blocos.length > 0 ? products.find((p) => p.product_id === blocos[0].product_id)?.account_id : null;
    return products.filter((p) => !escolhidos.has(p.product_id) && (conta == null || p.account_id === conta));
  }, [products, blocos]);

  function adicionarProduto(id: string) {
    setErro(null);
    setMensagemDeProduto(null);
    setBlocos((atual) => (atual.some((b) => b.product_id === id) ? atual : [...atual, { product_id: id, offer_codes: [], aberto: true }]));
  }

  function removerProduto(id: string) {
    if (blocos.length === 1) {
      setMensagemDeProduto(MENSAGEM_ULTIMO_PRODUTO);
      return;
    }
    setMensagemDeProduto(null);
    setBlocos((atual) => atual.filter((b) => b.product_id !== id));
  }

  function ajustarBloco(id: string, patch: Partial<BlocoState>) {
    setErro(null);
    setBlocos((atual) => atual.map((b) => (b.product_id === id ? { ...b, ...patch } : b)));
  }

  async function salvar() {
    const aparado = name.trim();
    if (!aparado) return setErro("Nome é obrigatório.");
    if (blocos.length === 0) return setErro("Selecione ao menos um produto.");
    const vazio = blocos.find((b) => b.offer_codes.length === 0);
    if (vazio) {
      ajustarBloco(vazio.product_id, { aberto: true });
      return setErro(`Selecione ao menos uma oferta de ${nomeDe(vazio.product_id)}.`);
    }

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
        body: JSON.stringify({
          name: aparado,
          folder_id: folderId || null,
          products: blocos.map((b) => ({ product_id: b.product_id, offer_codes: b.offer_codes })),
          view_start_date: dataInicial,
          view_end_date: dataFinal,
        }),
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

          <div data-testid="view-form-products" className="flex flex-col gap-2">
            <span className={rotulo}>
              Produtos ({blocos.length} selecionado{blocos.length === 1 ? "" : "s"})
            </span>

            {blocos.map((b) => (
              <BlocoDoProduto
                key={b.product_id}
                productId={b.product_id}
                nome={nomeDe(b.product_id)}
                selecionadas={b.offer_codes}
                aberto={b.aberto}
                edicao={edicao}
                onAlternar={() => ajustarBloco(b.product_id, { aberto: !b.aberto })}
                onRemover={() => removerProduto(b.product_id)}
                onChange={(proximas) => ajustarBloco(b.product_id, { offer_codes: proximas })}
              />
            ))}

            {mensagemDeProduto && (
              <p role="alert" data-testid="view-form-product-message" className="text-xs text-v2-queda">
                {mensagemDeProduto}
              </p>
            )}

            {candidatos.length > 0 ? (
              <EscolhaDeProduto
                produtos={candidatos}
                valor=""
                onEscolher={adicionarProduto}
                rotulo="Adicionar produto"
                placeholder={blocos.length === 0 ? "Buscar por nome ou ID do produto" : "Adicionar outro produto: buscar por nome ou ID"}
              />
            ) : (
              blocos.length > 0 && (
                <p data-testid="view-form-no-more-products" className="text-xs text-v2-nevoa/65">
                  Não há mais produtos da mesma conta Hotmart para adicionar.
                </p>
              )
            )}
          </div>

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
