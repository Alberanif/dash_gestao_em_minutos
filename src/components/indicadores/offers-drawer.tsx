"use client";

import { useEffect, useState } from "react";

export const NO_OFFER_CODE = "Sem Oferta";

export interface HotmartOffer {
  offer_code: string;
  offer_name: string | null;
  price?: number | null;
  currency?: string | null;
  is_main_offer?: boolean | null;
  is_active?: boolean | null;
}

interface OffersDrawerProps {
  productId: string;
  productName: string;
  selected: string[];
  /** Cache por produto vivo no estado do modal. */
  cachedOffers: HotmartOffer[] | undefined;
  onOffersLoaded: (productId: string, offers: HotmartOffer[]) => void;
  onChange: (codes: string[]) => void;
  onClose: () => void;
}

export function OffersDrawer({
  productId,
  productName,
  selected,
  cachedOffers,
  onOffersLoaded,
  onChange,
  onClose,
}: OffersDrawerProps) {
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (cachedOffers) return;
    let cancelled = false;
    setLoadError(false);
    fetch(
      `/api/hotmart/offers?product_id=${encodeURIComponent(productId)}&include_inactive=true`
    )
      .then(async (r) => {
        if (!r.ok) throw new Error("fail");
        const data = await r.json();
        if (!Array.isArray(data)) throw new Error("fail");
        if (!cancelled) onOffersLoaded(productId, data as HotmartOffer[]);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      ;
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, attempt, !!cachedOffers]);

  // Esc fecha só o drawer; o modal ignora Esc enquanto o drawer está aberto.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function toggle(code: string) {
    onChange(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);
  }

  const offers = cachedOffers ?? [];
  const known = new Set(offers.map((o) => o.offer_code));
  const orphans = selected.filter((c) => c !== NO_OFFER_CODE && !known.has(c));
  const active = offers.filter((o) => o.is_active !== false);
  const inactive = offers.filter((o) => o.is_active === false);

  const q = search.trim().toLowerCase();
  const matches = (label: string, code: string) =>
    !q || label.toLowerCase().includes(q) || code.toLowerCase().includes(q);

  type Row = { code: string; label: string; inactive?: boolean; orphan?: boolean };
  const rows: Row[] = [
    { code: NO_OFFER_CODE, label: "Sem oferta" },
    ...orphans.map((c) => ({ code: c, label: c, orphan: true })),
    ...active.map((o) => ({ code: o.offer_code, label: o.offer_name || o.offer_code })),
    ...inactive.map((o) => ({ code: o.offer_code, label: o.offer_name || o.offer_code, inactive: true })),
  ].filter((r) => matches(r.label, r.code));

  const loading = !cachedOffers && !loadError;
  const showList = !loading;

  return (
    <aside
      role="dialog"
      aria-label={`Ofertas de ${productName}`}
      data-testid="offers-drawer"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 380,
        maxWidth: "100vw",
        background: "var(--surface)",
        borderLeft: "1px solid var(--border-vis)",
        boxShadow: "-16px 0 48px rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        zIndex: 400,
      }}
    >
      <div style={{ padding: 20, borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{productName}</p>
        <p style={{ margin: 0, fontSize: 11, color: "var(--text-3)" }}>#{productId}</p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar oferta por nome ou código..."
          style={{
            marginTop: 10,
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

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px" }}>
        {loading && <p style={{ fontSize: 12, color: "var(--text-3)" }}>Carregando ofertas...</p>}
        {!loading && loadError && (
          <div role="alert" style={{ fontSize: 12, color: "var(--red)", padding: "8px 0", display: "flex", gap: 8, alignItems: "center" }}>
            <span>Não foi possível carregar as ofertas.</span>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              style={{ fontSize: 12, fontWeight: 600, color: "var(--violet)", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
            >
              Tentar novamente
            </button>
          </div>
        )}
        {showList && !loadError && offers.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>Nenhuma oferta cadastrada para este produto.</p>
        )}
        {showList &&
          rows.map((r) => (
            <label
              key={r.code}
              data-testid={`offer-row-${r.code}`}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", fontSize: 13, color: "var(--text)", cursor: "pointer", borderBottom: "1px solid var(--border)" }}
            >
              <input
                type="checkbox"
                aria-label={r.label}
                checked={selected.includes(r.code)}
                onChange={() => toggle(r.code)}
                style={{ accentColor: "var(--violet)", width: 14, height: 14 }}
              />
              <span style={{ flex: 1 }}>{r.label}</span>
              {r.code !== NO_OFFER_CODE && r.code !== r.label && (
                <span style={{ fontSize: 10, color: "var(--text-3)" }}>{r.code}</span>
              )}
              {r.inactive && (
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", border: "1px solid var(--border-vis)", borderRadius: 10, padding: "1px 6px" }}>
                  inativa
                </span>
              )}
            </label>
          ))}
      </div>

      <div style={{ padding: 16, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button
          type="button"
          onClick={() => onChange([])}
          style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "1px solid var(--border-vis)", background: "transparent", color: "var(--text-2)", cursor: "pointer" }}
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, borderRadius: 8, border: "none", background: "var(--violet)", color: "#fff", cursor: "pointer" }}
        >
          Concluir
        </button>
      </div>
    </aside>
  );
}
