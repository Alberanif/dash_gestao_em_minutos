"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, Input, Selo } from "../../ui";
import { cx, foco } from "../../ui/cx";
import { offersBadgeLabel } from "@/components/indicadores/filter-modal";
import { NO_OFFER_CODE, type HotmartOffer } from "@/components/indicadores/offers-drawer";

interface PropsOfertasPainel {
  productId: string;
  productName: string;
  selecionadas: string[];
  /** Cache por produto, mantido pela etapa entre aberturas. */
  emCache: HotmartOffer[] | undefined;
  onCarregadas: (productId: string, ofertas: HotmartOffer[]) => void;
  onMudar: (codigos: string[]) => void;
  onFechar: () => void;
}

interface Linha {
  codigo: string;
  rotulo: string;
  inativa?: boolean;
}

/** Seletor de ofertas de um produto principal. Nada marcado = todas as ofertas. */
export function OfertasPainel({
  productId,
  productName,
  selecionadas,
  emCache,
  onCarregadas,
  onMudar,
  onFechar,
}: PropsOfertasPainel) {
  const [falhou, setFalhou] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [busca, setBusca] = useState("");
  const temCache = !!emCache;

  useEffect(() => {
    if (temCache) return;
    let cancelado = false;
    fetch(`/api/hotmart/offers?product_id=${encodeURIComponent(productId)}&include_inactive=true`)
      .then(async (r) => {
        if (!r.ok) throw new Error("falha");
        const dados = await r.json();
        if (!Array.isArray(dados)) throw new Error("falha");
        if (!cancelado) onCarregadas(productId, dados as HotmartOffer[]);
      })
      .catch(() => {
        if (!cancelado) setFalhou(true);
      });
    return () => {
      cancelado = true;
    };
    // onCarregadas vem da etapa e muda a cada render; o gatilho real é produto, tentativa e cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, tentativa, temCache]);

  function alternar(codigo: string) {
    onMudar(selecionadas.includes(codigo) ? selecionadas.filter((c) => c !== codigo) : [...selecionadas, codigo]);
  }

  const ofertas = emCache ?? [];
  const conhecidas = new Set(ofertas.map((o) => o.offer_code));
  const orfas = selecionadas.filter((c) => c !== NO_OFFER_CODE && !conhecidas.has(c));
  const termo = busca.trim().toLowerCase();
  const linhas: Linha[] = [
    { codigo: NO_OFFER_CODE, rotulo: "Sem oferta" },
    ...orfas.map((c) => ({ codigo: c, rotulo: c })),
    ...ofertas.filter((o) => o.is_active !== false).map((o) => ({ codigo: o.offer_code, rotulo: o.offer_name || o.offer_code })),
    ...ofertas
      .filter((o) => o.is_active === false)
      .map((o) => ({ codigo: o.offer_code, rotulo: o.offer_name || o.offer_code, inativa: true })),
  ].filter((l) => !termo || l.rotulo.toLowerCase().includes(termo) || l.codigo.toLowerCase().includes(termo));

  const carregando = !emCache && !falhou;

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent aria-describedby="ofertas-painel-apoio" className="flex max-h-[85vh] flex-col gap-4">
        <div className="flex flex-col gap-1">
          <DialogTitle className="text-lg font-semibold">Ofertas de {productName}</DialogTitle>
          <DialogDescription id="ofertas-painel-apoio" className="text-sm text-v2-nevoa/70">
            Sem nenhuma oferta marcada, o Debriefing conta todas as ofertas do produto.
          </DialogDescription>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-v2-nevoa/55">#{productId}</span>
          <Selo tom={selecionadas.length === 0 ? "neutro" : "info"}>{offersBadgeLabel(selecionadas)}</Selo>
        </div>

        <Input
          className="h-11"
          aria-label="Buscar oferta"
          placeholder="Buscar oferta por nome ou código"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        <div className="min-h-24 flex-1 overflow-y-auto">
          {carregando && <p className="text-sm text-v2-nevoa/65">Carregando ofertas...</p>}
          {falhou && (
            <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-v2-queda">
              <span>Não foi possível carregar as ofertas.</span>
              <Button variante="secundario" className="h-11" onClick={() => {
                setFalhou(false);
                setTentativa((n) => n + 1);
              }}>
                Tentar de novo
              </Button>
            </div>
          )}
          {emCache && ofertas.length === 0 && (
            <p className="pb-2 text-sm text-v2-nevoa/65">Nenhuma oferta cadastrada para este produto.</p>
          )}
          {emCache && (
            <ul className="flex flex-col">
              {linhas.map((l) => (
                <li key={l.codigo}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 px-1 py-2 text-sm text-v2-nevoa">
                    <input
                      type="checkbox"
                      className={cx("h-5 w-5 shrink-0 accent-v2-azul-igt", foco)}
                      checked={selecionadas.includes(l.codigo)}
                      onChange={() => alternar(l.codigo)}
                    />
                    <span className="min-w-0 flex-1 break-words">{l.rotulo}</span>
                    {l.codigo !== NO_OFFER_CODE && l.codigo !== l.rotulo && (
                      <span className="shrink-0 text-xs text-v2-nevoa/55">{l.codigo}</span>
                    )}
                    {l.inativa && <Selo>inativa</Selo>}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variante="secundario" className="h-11" onClick={() => onMudar([])} disabled={selecionadas.length === 0}>
            Todas as ofertas
          </Button>
          <Button className="h-11" onClick={onFechar}>
            Concluir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
