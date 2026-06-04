"use client";

import { useState, useEffect, useRef } from "react";
import type { FilterRecord } from "@/types/indicadores";

interface HotmartProduct {
  product_id: string;
  product_name: string;
}

/**
 * Returns a warning message when only one data source is configured, or null
 * when both are configured (no warning needed) or both are empty (the existing
 * required-field validation already handles that case).
 */
export function getPartialFilterWarning(
  hotmartProducts: HotmartProduct[],
  cleanTerms: string[]
): string | null {
  const hasHotmart = hotmartProducts.length > 0;
  const hasMeta = cleanTerms.length > 0;
  if (hasHotmart && !hasMeta) {
    return "Sem termos do Meta Ads configurados — dados de Meta Ads serão zerados no dashboard.";
  }
  if (!hasHotmart && hasMeta) {
    return "Sem produtos Hotmart configurados — dados de Hotmart serão zerados no dashboard.";
  }
  return null;
}

interface FilterModalProps {
  accountId: string;
  editTarget?: FilterRecord | null;
  onSave: (filter: FilterRecord) => void;
  onCancel: () => void;
}

export function FilterModal({ accountId, editTarget, onSave, onCancel }: FilterModalProps) {
  const [name, setName] = useState(editTarget?.name ?? "");
  const [hotmartProducts, setHotmartProducts] = useState<HotmartProduct[]>(
    editTarget?.hotmart_products ?? []
  );
  const [metaTerms, setMetaTerms] = useState<string[]>(
    editTarget?.meta_ads_terms?.length ? editTarget.meta_ads_terms : [""]
  );
  const [productOptions, setProductOptions] = useState<HotmartProduct[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productDropOpen, setProductDropOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [partialWarning, setPartialWarning] = useState("");
  const [partialWarningShown, setPartialWarningShown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Server-side search: fires on every keystroke (debounced 300ms).
  // Uses /api/funnels/products which searches by both name and product_id
  // without requiring account_id — fixing the cross-platform account mismatch bug.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const q = productSearch.trim();
        const res = await fetch(`/api/funnels/products?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setProductOptions(data);
        }
      } catch {
        // network error — keep previous results
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [productSearch]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  // Reset the "already warned" flag whenever the user edits either source,
  // so the two-step save protection fires correctly after subsequent changes.
  useEffect(() => {
    setPartialWarning("");
    setPartialWarningShown(false);
  }, [hotmartProducts, metaTerms]);

  const selectedIds = new Set(hotmartProducts.map((p) => p.product_id));
  const filteredOptions = productOptions.filter((p) => !selectedIds.has(p.product_id));

  function toggleProduct(p: HotmartProduct) {
    setHotmartProducts((prev) =>
      prev.some((x) => x.product_id === p.product_id)
        ? prev.filter((x) => x.product_id !== p.product_id)
        : [...prev, p]
    );
  }

  function addTerm() {
    setMetaTerms((prev) => [...prev, ""]);
  }

  function setTerm(i: number, v: string) {
    setMetaTerms((prev) => prev.map((t, idx) => (idx === i ? v : t)));
  }

  function removeTerm(i: number) {
    setMetaTerms((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    const cleanTerms = metaTerms.map((t) => t.trim()).filter(Boolean);
    if (!name.trim()) {
      setError("Nome é obrigatório.");
      return;
    }
    if (hotmartProducts.length === 0 && cleanTerms.length === 0) {
      setError("Selecione pelo menos um produto ou adicione um termo de campanha.");
      return;
    }
    // Show partial-source warning once before proceeding; second click confirms
    if (!partialWarningShown) {
      const warning = getPartialFilterWarning(hotmartProducts, cleanTerms);
      if (warning) {
        setPartialWarning(warning);
        setPartialWarningShown(true);
        return;
      }
    }
    setPartialWarning("");
    setError("");
    setSaving(true);
    try {
      const url = editTarget
        ? `/api/indicadores/filters/${editTarget.id}`
        : "/api/indicadores/filters";
      const method = editTarget ? "PUT" : "POST";
      const body = editTarget
        ? { name: name.trim(), hotmart_products: hotmartProducts, meta_ads_terms: cleanTerms }
        : { account_id: accountId, name: name.trim(), hotmart_products: hotmartProducts, meta_ads_terms: cleanTerms };

      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Erro ao salvar.");
        return;
      }
      const saved: FilterRecord = await res.json();
      onSave(saved);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-vis)",
          borderRadius: 12,
          padding: 24,
          width: 420,
          maxHeight: "80vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        }}
      >
        <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>
          {editTarget ? "Editar filtro" : "Novo filtro"}
        </p>

        {/* Name */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Nome
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Produto Principal"
            style={{
              padding: "8px 12px",
              fontSize: 13,
              borderRadius: 8,
              border: "1px solid var(--border-vis)",
              background: "var(--surface-2)",
              color: "var(--text)",
              outline: "none",
              width: "100%",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Hotmart products */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Produtos Hotmart
          </label>
          <div style={{ position: "relative" }}>
            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              onFocus={() => setProductDropOpen(true)}
              onBlur={() => setTimeout(() => setProductDropOpen(false), 150)}
              placeholder="Buscar produto..."
              style={{
                padding: "8px 12px",
                fontSize: 13,
                borderRadius: 8,
                border: "1px solid var(--border-vis)",
                background: "var(--surface-2)",
                color: "var(--text)",
                outline: "none",
                width: "100%",
                boxSizing: "border-box",
              }}
            />
            {productDropOpen && (searching || filteredOptions.length > 0 || productSearch.trim().length > 0) && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  left: 0,
                  right: 0,
                  background: "var(--surface)",
                  border: "1px solid var(--border-vis)",
                  borderRadius: 8,
                  maxHeight: 160,
                  overflowY: "auto",
                  zIndex: 300,
                }}
              >
                {searching && (
                  <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-3)" }}>
                    Buscando...
                  </div>
                )}
                {!searching && filteredOptions.length === 0 && (
                  <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--text-3)" }}>
                    {productSearch.trim() ? "Nenhum produto encontrado." : "Digite para buscar um produto."}
                  </div>
                )}
                {!searching && filteredOptions.map((p) => (
                  <button
                    key={p.product_id}
                    onMouseDown={() => { toggleProduct(p); setProductSearch(""); }}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      fontSize: 12,
                      color: "var(--text)",
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                    }}
                  >
                    <span>{p.product_name}</span>
                    <span style={{ marginLeft: 6, fontSize: 10, color: "var(--text-3)" }}>#{p.product_id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {hotmartProducts.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {hotmartProducts.map((p) => (
                <span
                  key={p.product_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 20,
                    border: "1px solid var(--border-vis)",
                    background: "var(--surface-2)",
                    color: "var(--text)",
                  }}
                >
                  {p.product_name}
                  <button
                    onClick={() => toggleProduct(p)}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-3)", padding: 0, fontSize: 12, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Meta Ads terms */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Termos de campanha Meta Ads
          </label>
          {metaTerms.map((term, i) => (
            <div key={i} style={{ display: "flex", gap: 6 }}>
              <input
                value={term}
                onChange={(e) => setTerm(i, e.target.value)}
                placeholder="Ex: lançamento"
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  fontSize: 13,
                  borderRadius: 8,
                  border: "1px solid var(--border-vis)",
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  outline: "none",
                }}
              />
              {metaTerms.length > 1 && (
                <button
                  onClick={() => removeTerm(i)}
                  style={{
                    padding: "0 10px",
                    fontSize: 16,
                    color: "var(--text-3)",
                    background: "transparent",
                    border: "1px solid var(--border-vis)",
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addTerm}
            style={{
              alignSelf: "flex-start",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--violet)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            + Adicionar termo
          </button>
        </div>

        {partialWarning && (
          <p
            role="status"
            style={{
              fontSize: 12,
              color: "var(--orange)",
              margin: 0,
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px solid color-mix(in srgb, var(--orange) 30%, transparent)",
              background: "color-mix(in srgb, var(--orange) 8%, transparent)",
              lineHeight: 1.5,
            }}
          >
            ⚠ {partialWarning} Clique em Salvar novamente para confirmar.
          </p>
        )}

        {error && (
          <p style={{ fontSize: 12, color: "var(--red)", margin: 0 }}>{error}</p>
        )}

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              border: "1px solid var(--border-vis)",
              background: "transparent",
              color: "var(--text-2)",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              border: "none",
              background: "var(--violet)",
              color: "#fff",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
