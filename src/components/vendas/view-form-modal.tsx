"use client";

import { useEffect, useMemo, useState } from "react";
import type { VendasFolderRecord, VendasViewRecord } from "@/types/vendas";
import { parseDateRange } from "@/lib/vendas/date-range";
import { normalizeOfferCode } from "@/lib/vendas/views";
import type { HotmartProductOption } from "./types";

export interface OfferOption {
  offer_code: string;
  offer_name: string | null;
  sales_count?: number;
}

interface ViewFormModalProps {
  products: HotmartProductOption[];
  folders: VendasFolderRecord[];
  editTarget?: VendasViewRecord | null;
  onSaved: (view: VendasViewRecord, mode: "created" | "edited") => void;
  onCancel: () => void;
  // Só na edição: abre o diálogo de exclusão (que vive na tela, não aqui).
  onRequestDelete?: (view: VendasViewRecord) => void;
}

const LAST_OFFER_MESSAGE =
  "Uma visualização precisa de pelo menos uma oferta; para descartar, exclua a visualização.";
const LAST_PRODUCT_MESSAGE =
  "Uma visualização precisa de pelo menos um produto; para descartar, exclua a visualização.";

interface ProductBlockState {
  product_id: string;
  offer_codes: string[];
  open: boolean;
}

interface ProductBlockProps {
  productId: string;
  productName: string;
  selected: string[];
  open: boolean;
  isEdit: boolean;
  onToggleOpen: () => void;
  onRemove: () => void;
  onChange: (next: string[]) => void;
}

// Bloco de um produto: carrega as ofertas dele e mantém busca/código manual
// próprios. Montado com key = product_id, então trocar de produto nunca
// reaproveita opções ou seleção de outro.
function ProductBlock({ productId, productName, selected, open, isEdit, onToggleOpen, onRemove, onChange }: ProductBlockProps) {
  const [options, setOptions] = useState<OfferOption[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [offersError, setOffersError] = useState(false);
  const [offersReload, setOffersReload] = useState(0);
  const [search, setSearch] = useState("");
  const [manual, setManual] = useState("");
  const [offerMessage, setOfferMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingOffers(true);
    setOffersError(false);
    fetch(`/api/vendas/offer-options?product_id=${encodeURIComponent(productId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("offer-options");
        const data = await res.json();
        if (!cancelled) setOptions(Array.isArray(data?.offers) ? data.offers : []);
      })
      .catch(() => {
        if (!cancelled) setOffersError(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingOffers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId, offersReload]);

  // Lista = ofertas sincronizadas + selecionadas que a Hotmart não conhece
  // (código manual). Estas últimas nunca podem sumir da tela: contam na venda.
  const rows: OfferOption[] = useMemo(() => {
    const known = new Set(options.map((o) => o.offer_code));
    const extras: OfferOption[] = selected
      .filter((code) => !known.has(code))
      .map((code) => ({ offer_code: code, offer_name: null }));
    return [...extras, ...options];
  }, [options, selected]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (o) =>
        selected.includes(o.offer_code) ||
        o.offer_code.toLowerCase().includes(term) ||
        (o.offer_name ?? "").toLowerCase().includes(term)
    );
  }, [rows, search, selected]);

  function toggleOffer(code: string) {
    if (selected.includes(code)) {
      if (selected.length === 1) {
        setOfferMessage(LAST_OFFER_MESSAGE);
        return;
      }
      onChange(selected.filter((c) => c !== code));
    } else {
      onChange([...selected, code]);
    }
    setOfferMessage(null);
  }

  function addManual() {
    const code = normalizeOfferCode(manual);
    if (!code) {
      setOfferMessage("Informe um código de oferta.");
      return;
    }
    if (selected.includes(code)) {
      setOfferMessage(`A oferta ${code} já está na lista.`);
      return;
    }
    onChange([...selected, code]);
    setManual("");
    setOfferMessage(null);
  }

  const tid = (suffix: string) => `view-form-${suffix}-${productId}`;
  const count = `${selected.length} oferta${selected.length === 1 ? "" : "s"} selecionada${selected.length === 1 ? "" : "s"}`;

  return (
    <div
      data-testid={tid("product-block")}
      style={{ border: "1px solid var(--border-vis)", borderRadius: 10, background: "var(--surface-2)", minWidth: 0 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px" }}>
        <button
          type="button"
          data-testid={tid("product-toggle")}
          aria-expanded={open}
          aria-controls={`view-form-product-body-${productId}`}
          onClick={onToggleOpen}
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            padding: 0,
            border: "none",
            background: "transparent",
            font: "inherit",
            textAlign: "left",
            cursor: "pointer",
            color: "var(--text-strong)",
          }}
        >
          <span aria-hidden="true">{open ? "▾" : "▸"}</span>
          <span style={{ fontSize: 13, fontWeight: 600, overflowWrap: "anywhere" }}>{productName}</span>
          <span data-testid={tid("product-count")} style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {count}
          </span>
        </button>
        <button
          type="button"
          className="btn-secondary"
          data-testid={tid("product-remove")}
          aria-label={`Remover produto ${productName}`}
          onClick={onRemove}
          style={{ fontSize: 11, padding: "3px 8px" }}
        >
          Remover
        </button>
      </div>

      {open && (
        <div
          id={`view-form-product-body-${productId}`}
          data-testid={tid("offers")}
          style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 10px 10px" }}
        >
          {loadingOffers && <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>Carregando ofertas...</p>}
          {offersError && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <p data-testid={tid("offers-error")} style={{ fontSize: 11, color: "var(--color-danger)", margin: 0 }}>
                Não foi possível carregar as ofertas. Você ainda pode adicionar códigos manualmente.
              </p>
              <button type="button" className="btn-secondary" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => setOffersReload((n) => n + 1)}>
                Tentar novamente
              </button>
            </div>
          )}

          <input
            data-testid={tid("offer-search")}
            className="field-control"
            placeholder="Buscar por nome ou código"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {visible.map((o) => {
              const checked = selected.includes(o.offer_code);
              return (
                <li key={o.offer_code}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text)", padding: "4px 2px", cursor: "pointer", minWidth: 0 }}>
                    <input
                      type="checkbox"
                      data-testid={`view-form-offer-${productId}-${o.offer_code}`}
                      checked={checked}
                      onChange={() => toggleOffer(o.offer_code)}
                    />
                    <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                      {o.offer_name ? `${o.offer_name} · ` : ""}
                      <code>{o.offer_code}</code>
                      {typeof o.sales_count === "number" && (
                        <span style={{ color: "var(--text-3)" }}> · {o.sales_count} vendas</span>
                      )}
                      {o.offer_name === null && !loadingOffers && <span style={{ color: "var(--text-3)" }}> · manual</span>}
                    </span>
                  </label>
                </li>
              );
            })}
            {!loadingOffers && visible.length === 0 && (
              <li style={{ fontSize: 12, color: "var(--text-muted)" }}>Nenhuma oferta encontrada.</li>
            )}
          </ul>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              data-testid={tid("manual-input")}
              className="field-control"
              placeholder="Adicionar código manualmente"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addManual();
                }
              }}
            />
            <button type="button" className="btn-secondary" data-testid={tid("manual-add")} onClick={addManual}>
              Adicionar
            </button>
          </div>

          {offerMessage && (
            <p role="alert" data-testid={tid("offer-message")} style={{ fontSize: 12, color: "var(--color-danger)", margin: 0 }}>
              {offerMessage}
            </p>
          )}
          {isEdit && (
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
              Ofertas adicionadas disparam a coleta do histórico delas. Remover uma oferta não apaga vendas coletadas.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Modal de criar/editar Visualização (PRD #213 RF-6): nome, pasta, produtos
// (blocos recolhíveis, cada um com a sua allowlist de ofertas, mínimo 1 produto
// e 1 oferta por produto, todos da mesma conta Hotmart) e período.
export function ViewFormModal({ products, folders, editTarget, onSaved, onCancel, onRequestDelete }: ViewFormModalProps) {
  const isEdit = Boolean(editTarget);

  const [name, setName] = useState(editTarget?.name ?? "");
  const [folderId, setFolderId] = useState(editTarget?.folder_id ?? "");
  const [blocks, setBlocks] = useState<ProductBlockState[]>(() =>
    (editTarget?.products ?? []).map((p, i) => ({ product_id: p.product_id, offer_codes: [...p.offer_codes], open: i === 0 }))
  );
  const [start, setStart] = useState(editTarget?.view_start_date ?? "");
  const [end, setEnd] = useState(editTarget?.view_end_date ?? "");
  const [productMessage, setProductMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const nameOf = (id: string) => products.find((p) => p.product_id === id)?.product_name ?? id;

  // Seletor de "Adicionar produto": exclui os já escolhidos e, a partir do
  // primeiro, só oferece produtos da mesma conta Hotmart.
  const candidates = useMemo(() => {
    const chosen = new Set(blocks.map((b) => b.product_id));
    const accountId = blocks.length > 0 ? products.find((p) => p.product_id === blocks[0].product_id)?.account_id : null;
    return products.filter((p) => !chosen.has(p.product_id) && (accountId == null || p.account_id === accountId));
  }, [products, blocks]);

  function addProduct(id: string) {
    if (!id) return;
    setError(null);
    setProductMessage(null);
    setBlocks((cur) => (cur.some((b) => b.product_id === id) ? cur : [...cur, { product_id: id, offer_codes: [], open: true }]));
  }

  function removeProduct(id: string) {
    if (blocks.length === 1) {
      setProductMessage(LAST_PRODUCT_MESSAGE);
      return;
    }
    setProductMessage(null);
    setBlocks((cur) => cur.filter((b) => b.product_id !== id));
  }

  function patchBlock(id: string, patch: Partial<ProductBlockState>) {
    setError(null);
    setBlocks((cur) => cur.map((b) => (b.product_id === id ? { ...b, ...patch } : b)));
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return setError("Nome é obrigatório.");
    if (blocks.length === 0) return setError("Selecione ao menos um produto.");
    const empty = blocks.find((b) => b.offer_codes.length === 0);
    if (empty) {
      setBlocks((cur) => cur.map((b) => (b.product_id === empty.product_id ? { ...b, open: true } : b)));
      return setError(`Selecione ao menos uma oferta em ${nameOf(empty.product_id)}.`);
    }

    let startDate: string | null = null;
    let endDate: string | null = null;
    if (start || end) {
      if (!start || !end) return setError("Preencha as duas datas do período ou deixe ambas vazias.");
      const range = parseDateRange(start, end);
      if (!range) return setError("A data final não pode ser anterior à inicial.");
      startDate = range.start;
      endDate = range.end;
    }

    setError(null);
    setSaving(true);
    try {
      const res = await fetch(isEdit ? `/api/vendas/views/${editTarget!.id}` : "/api/vendas/views", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          folder_id: folderId || null,
          products: blocks.map((b) => ({ product_id: b.product_id, offer_codes: b.offer_codes })),
          view_start_date: startDate,
          view_end_date: endDate,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.view) {
        setError(data?.error ?? "Erro ao salvar a visualização.");
        return;
      }
      onSaved(data.view as VendasViewRecord, isEdit ? "edited" : "created");
    } catch {
      setError("Erro de conexão ao salvar a visualização.");
    } finally {
      setSaving(false);
    }
  }

  const label = { fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)", display: "block", marginBottom: 4 } as const;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Editar visualização" : "Nova visualização"}
      className="vendas-modal-overlay"
      data-testid="view-form-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel();
      }}
    >
      {/* O painel já rola por dentro (max-height + overflow-y em .vendas-modal-panel). */}
      <div className="vendas-modal-panel" style={{ maxWidth: 480 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
          {isEdit ? "Editar visualização" : "Nova visualização"}
        </h3>

        <div>
          <label htmlFor="view-name" style={label}>Nome</label>
          <input
            id="view-name"
            data-testid="view-form-name"
            className="field-control"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Pitch PC Ao Vivo"
          />
        </div>

        <div>
          <label htmlFor="view-folder" style={label}>Pasta (opcional)</label>
          <select
            id="view-folder"
            data-testid="view-form-folder"
            className="field-control"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
          >
            <option value="">Sem pasta</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        <div data-testid="view-form-products" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={label}>
            Produtos ({blocks.length} selecionado{blocks.length === 1 ? "" : "s"})
          </span>

          {blocks.map((b) => (
            <ProductBlock
              key={b.product_id}
              productId={b.product_id}
              productName={nameOf(b.product_id)}
              selected={b.offer_codes}
              open={b.open}
              isEdit={isEdit}
              onToggleOpen={() => patchBlock(b.product_id, { open: !b.open })}
              onRemove={() => removeProduct(b.product_id)}
              onChange={(next) => patchBlock(b.product_id, { offer_codes: next })}
            />
          ))}

          {productMessage && (
            <p role="alert" data-testid="view-form-product-message" style={{ fontSize: 12, color: "var(--color-danger)", margin: 0 }}>
              {productMessage}
            </p>
          )}

          {candidates.length > 0 ? (
            <select
              aria-label="Adicionar produto"
              data-testid="view-form-add-product"
              className="field-control"
              value=""
              onChange={(e) => addProduct(e.target.value)}
            >
              <option value="">{blocks.length === 0 ? "Selecione um produto" : "+ Adicionar produto"}</option>
              {candidates.map((p) => (
                <option key={p.product_id} value={p.product_id}>{p.product_name}</option>
              ))}
            </select>
          ) : (
            blocks.length > 0 && (
              <p data-testid="view-form-no-more-products" style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
                Não há outros produtos da mesma conta Hotmart para adicionar.
              </p>
            )
          )}
        </div>

        <div>
          <span style={label}>Período (opcional)</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="date" aria-label="Data inicial" data-testid="view-form-start" className="field-control" style={{ flex: "1 1 140px" }} value={start} onChange={(e) => setStart(e.target.value)} />
            <input type="date" aria-label="Data final" data-testid="view-form-end" className="field-control" style={{ flex: "1 1 140px" }} value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "6px 0 0" }}>
            Sem período, o histórico coletado cobre os últimos 90 dias.
          </p>
        </div>

        {error && (
          <p role="alert" data-testid="view-form-error" style={{ fontSize: 12, color: "var(--color-danger)", margin: 0 }}>
            {error}
          </p>
        )}

        <div className="vendas-modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving} data-testid="view-form-cancel">
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={saving} data-testid="view-form-save">
            {saving ? "Salvando..." : isEdit ? "Salvar" : "Criar visualização"}
          </button>
        </div>

        {isEdit && onRequestDelete && editTarget && (
          <div style={{ paddingTop: 12, borderTop: "1px solid var(--color-border, var(--border-vis))" }}>
            <button
              type="button"
              data-testid="view-form-delete-open"
              onClick={() => onRequestDelete(editTarget)}
              disabled={saving}
              style={{ background: "none", border: "none", padding: 0, fontSize: 12, color: "#ef4444", cursor: "pointer" }}
            >
              Excluir visualização
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
