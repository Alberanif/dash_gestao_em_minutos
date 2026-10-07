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

// Modal enxuto de criar/editar Visualização (PRD #185 RF-2/RF-3): nome, pasta,
// UM produto (travado na edição), ofertas (lista + código manual, mínimo 1) e
// período. Sem meta, status, base ou "incluir compras sem oferta".
export function ViewFormModal({ products, folders, editTarget, onSaved, onCancel, onRequestDelete }: ViewFormModalProps) {
  const isEdit = Boolean(editTarget);

  const [name, setName] = useState(editTarget?.name ?? "");
  const [folderId, setFolderId] = useState(editTarget?.folder_id ?? "");
  const [productId, setProductId] = useState(editTarget?.product_id ?? "");
  const [selected, setSelected] = useState<string[]>(editTarget?.offer_codes ?? []);
  const [start, setStart] = useState(editTarget?.view_start_date ?? "");
  const [end, setEnd] = useState(editTarget?.view_end_date ?? "");

  const [options, setOptions] = useState<OfferOption[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [offersError, setOffersError] = useState(false);
  const [offersReload, setOffersReload] = useState(0);

  const [search, setSearch] = useState("");
  const [manual, setManual] = useState("");
  const [offerMessage, setOfferMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!productId) return;
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
    setError(null);
    if (selected.includes(code)) {
      if (selected.length === 1) {
        setOfferMessage(LAST_OFFER_MESSAGE);
        return;
      }
      setSelected(selected.filter((c) => c !== code));
    } else {
      setSelected([...selected, code]);
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
    setSelected([...selected, code]);
    setManual("");
    setOfferMessage(null);
  }

  function handleProductChange(next: string) {
    setProductId(next);
    setOptions([]);
    setSelected([]);
    setSearch("");
    setOfferMessage(null);
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return setError("Nome é obrigatório.");
    if (!productId) return setError("Selecione um produto.");
    if (selected.length === 0) return setError("Selecione ao menos uma oferta.");

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
        body: JSON.stringify(
          isEdit
            ? {
                name: trimmed,
                folder_id: folderId || null,
                offer_codes: selected,
                view_start_date: startDate,
                view_end_date: endDate,
              }
            : {
                name: trimmed,
                folder_id: folderId || null,
                product_id: productId,
                offer_codes: selected,
                view_start_date: startDate,
                view_end_date: endDate,
              }
        ),
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
  const productName = products.find((p) => p.product_id === productId)?.product_name ?? productId;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Editar visualização" : "Nova visualização"}
      className="ult-modal-overlay"
      data-testid="view-form-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onCancel();
      }}
    >
      <div className="ult-modal-panel" style={{ maxWidth: 480 }}>
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

        <div>
          <label htmlFor="view-product" style={label}>Produto</label>
          {isEdit ? (
            <>
              <select id="view-product" data-testid="view-form-product" className="field-control" value={productId} disabled>
                <option value={productId}>{productName}</option>
              </select>
              <p data-testid="view-form-product-locked" style={{ fontSize: 11, color: "var(--text-muted)", margin: "6px 0 0", lineHeight: 1.5 }}>
                O produto não pode ser alterado depois de criada a visualização, porque o histórico coletado
                pertence a ele. Para acompanhar outro produto, crie uma nova visualização.
              </p>
            </>
          ) : (
            <select
              id="view-product"
              data-testid="view-form-product"
              className="field-control"
              value={productId}
              onChange={(e) => handleProductChange(e.target.value)}
            >
              <option value="">Selecione um produto</option>
              {products.map((p) => (
                <option key={p.product_id} value={p.product_id}>{p.product_name}</option>
              ))}
            </select>
          )}
        </div>

        {productId && (
          <div data-testid="view-form-offers" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={label}>
              Ofertas ({selected.length} selecionada{selected.length === 1 ? "" : "s"})
            </span>

            {loadingOffers && <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>Carregando ofertas...</p>}
            {offersError && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <p data-testid="view-form-offers-error" style={{ fontSize: 11, color: "var(--color-danger)", margin: 0 }}>
                  Não foi possível carregar as ofertas. Você ainda pode adicionar códigos manualmente.
                </p>
                <button type="button" className="btn-secondary" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => setOffersReload((n) => n + 1)}>
                  Tentar novamente
                </button>
              </div>
            )}

            <input
              data-testid="view-form-offer-search"
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
                        data-testid={`view-form-offer-${o.offer_code}`}
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
                data-testid="view-form-manual-input"
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
              <button type="button" className="btn-secondary" data-testid="view-form-manual-add" onClick={addManual}>
                Adicionar
              </button>
            </div>

            {offerMessage && (
              <p role="alert" data-testid="view-form-offer-message" style={{ fontSize: 12, color: "var(--color-danger)", margin: 0 }}>
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

        <div className="ult-modal-actions">
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
