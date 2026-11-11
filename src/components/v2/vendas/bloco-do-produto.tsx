"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeOfferCode } from "@/lib/vendas/views";
import { Button, Input } from "../ui";
import { cx, foco } from "../ui/cx";

export interface OpcaoDeOferta {
  offer_code: string;
  offer_name: string | null;
  sales_count?: number;
}

interface BlocoDoProdutoProps {
  productId: string;
  nome: string;
  selecionadas: string[];
  aberto: boolean;
  edicao: boolean;
  onAlternar: () => void;
  onRemover: () => void;
  onChange: (proximas: string[]) => void;
}

export const MENSAGEM_ULTIMA_OFERTA =
  "Cada produto precisa de pelo menos uma oferta; para tirar o produto, use Remover.";

/**
 * Bloco recolhível de UM produto da visualização: carrega as ofertas dele e guarda busca e código
 * manual próprios. O modal monta com key = product_id, então trocar de produto nunca reaproveita
 * opções ou seleção de outro.
 */
export function BlocoDoProduto({ productId, nome, selecionadas, aberto, edicao, onAlternar, onRemover, onChange }: BlocoDoProdutoProps) {
  const [opcoes, setOpcoes] = useState<OpcaoDeOferta[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erroDeOfertas, setErroDeOfertas] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [busca, setBusca] = useState("");
  const [manual, setManual] = useState("");
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      setCarregando(true);
      setErroDeOfertas(false);
      try {
        const res = await fetch(`/api/vendas/offer-options?product_id=${encodeURIComponent(productId)}`);
        if (!res.ok) throw new Error("offer-options");
        const data = await res.json();
        if (!cancelado) setOpcoes(Array.isArray(data?.offers) ? data.offers : []);
      } catch {
        if (!cancelado) setErroDeOfertas(true);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }
    void carregar();
    return () => {
      cancelado = true;
    };
  }, [productId, recarga]);

  // Lista = ofertas sincronizadas + selecionadas que a Hotmart não conhece (código manual).
  // Estas últimas nunca podem sumir da tela: contam na venda.
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
    if (selecionadas.includes(code)) {
      if (selecionadas.length === 1) {
        setMensagem(MENSAGEM_ULTIMA_OFERTA);
        return;
      }
      onChange(selecionadas.filter((c) => c !== code));
    } else {
      onChange([...selecionadas, code]);
    }
    setMensagem(null);
  }

  function adicionarManual() {
    const code = normalizeOfferCode(manual);
    if (!code) {
      setMensagem("Informe um código de oferta.");
      return;
    }
    if (selecionadas.includes(code)) {
      setMensagem(`A oferta ${code} já está na lista.`);
      return;
    }
    onChange([...selecionadas, code]);
    setManual("");
    setMensagem(null);
  }

  const idPainel = `bloco-${productId}`;

  return (
    <div data-testid={`view-form-product-${productId}`} className="rounded-v2-sm bg-v2-casco/60 ring-1 ring-inset ring-v2-azul-luz/15">
      <div className="flex items-center gap-1 pr-2">
        <button
          type="button"
          data-testid={`view-form-product-${productId}-toggle`}
          aria-expanded={aberto}
          aria-controls={idPainel}
          onClick={onAlternar}
          className={cx("flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-v2-sm px-3 py-2 text-left", foco)}
        >
          <span aria-hidden className={cx("shrink-0 text-[10px] text-v2-nevoa/60 transition-transform duration-[120ms]", aberto && "rotate-90")}>
            ▶
          </span>
          <span className="min-w-0 text-sm font-medium text-v2-nevoa [overflow-wrap:anywhere]">
            {nome}
            <span className="ml-2 text-xs font-normal text-v2-nevoa/60">
              {selecionadas.length} oferta{selecionadas.length === 1 ? "" : "s"}
            </span>
          </span>
        </button>
        <Button
          variante="fantasma"
          data-testid={`view-form-product-${productId}-remove`}
          aria-label={`Remover produto ${nome}`}
          className="h-9 shrink-0 px-2 text-xs text-v2-queda"
          onClick={onRemover}
        >
          Remover
        </Button>
      </div>

      {aberto && (
        <div id={idPainel} data-testid={`view-form-offers-${productId}`} className="flex flex-col gap-2 px-3 pb-3">
          {carregando && <p className="text-xs text-v2-nevoa/65">Carregando ofertas…</p>}
          {erroDeOfertas && (
            <div className="flex flex-wrap items-center gap-2">
              <p data-testid={`view-form-offers-error-${productId}`} className="text-xs text-v2-queda">
                Não foi possível carregar as ofertas. Você ainda pode adicionar códigos manualmente.
              </p>
              <Button variante="fantasma" className="h-8 px-2 text-xs" onClick={() => setRecarga((n) => n + 1)}>
                Tentar novamente
              </Button>
            </div>
          )}

          <Input
            data-testid={`view-form-offer-search-${productId}`}
            aria-label={`Buscar oferta de ${nome}`}
            placeholder="Buscar por nome ou código"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />

          <ul className="flex max-h-52 flex-col gap-0.5 overflow-y-auto rounded-v2-sm bg-v2-abismo/40 p-1">
            {visiveis.map((o) => (
              <li key={o.offer_code}>
                <label className="flex min-h-9 min-w-0 cursor-pointer items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-sm text-v2-nevoa hover:bg-v2-nevoa/5">
                  <input
                    type="checkbox"
                    data-testid={`view-form-offer-${o.offer_code}`}
                    checked={selecionadas.includes(o.offer_code)}
                    onChange={() => alternarOferta(o.offer_code)}
                    className="size-4 shrink-0 accent-[var(--v2-azul-igt)]"
                  />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {o.offer_name ? `${o.offer_name}, ` : ""}
                    <code className="text-v2-nevoa/70">{o.offer_code}</code>
                    {typeof o.sales_count === "number" && <span className="text-v2-nevoa/60">, {o.sales_count} vendas</span>}
                    {o.offer_name === null && !carregando && <span className="text-v2-nevoa/60">, manual</span>}
                  </span>
                </label>
              </li>
            ))}
            {!carregando && visiveis.length === 0 && <li className="px-2 py-1.5 text-sm text-v2-nevoa/65">Nenhuma oferta encontrada.</li>}
          </ul>

          <div className="flex gap-2">
            <Input
              data-testid={`view-form-manual-input-${productId}`}
              aria-label={`Código da oferta de ${nome}`}
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
            <Button variante="secundario" data-testid={`view-form-manual-add-${productId}`} onClick={adicionarManual}>
              Adicionar
            </Button>
          </div>

          {mensagem && (
            <p role="alert" data-testid={`view-form-offer-message-${productId}`} className="text-xs text-v2-queda">
              {mensagem}
            </p>
          )}
          {edicao && (
            <p className="text-xs text-v2-nevoa/65">
              Ofertas adicionadas disparam a coleta do histórico delas. Remover uma oferta não apaga vendas coletadas.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
