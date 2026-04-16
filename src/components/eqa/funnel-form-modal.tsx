"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Funnel, HotmartProduct } from "@/types/funnels";
import type { Account } from "@/types/accounts";

interface FunnelFormData {
  name: string;
  type: "destrave";
  start_date: string;
  end_date: string;
  goal_sales: string;
  product_ids: string[];
  ad_account_ids: string[];
  campaign_ids: string[];
}

interface FunnelFormModalProps {
  funnel?: Funnel;
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<Funnel, "id" | "created_at" | "updated_at">) => Promise<void>;
}

const EMPTY_FORM: FunnelFormData = {
  name: "",
  type: "destrave",
  start_date: "",
  end_date: "",
  goal_sales: "",
  product_ids: [],
  ad_account_ids: [],
  campaign_ids: [],
};

function funnelToForm(f: Funnel): FunnelFormData {
  return {
    name: f.name,
    type: f.type,
    start_date: f.start_date,
    end_date: f.end_date,
    goal_sales: String(f.goal_sales),
    product_ids: f.config.product_ids ?? [],
    ad_account_ids: f.config.ad_account_ids ?? [],
    campaign_ids: f.config.campaign_ids ?? [],
  };
}

export function FunnelFormModal({ funnel, open, onClose, onSave }: FunnelFormModalProps) {
  const [form, setForm] = useState<FunnelFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Produtos Hotmart
  const [productSearch, setProductSearch] = useState("");
  const [products, setProducts] = useState<HotmartProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Contas Meta Ads
  const [metaAccounts, setMetaAccounts] = useState<Account[]>([]);

  // Preencher form ao abrir
  useEffect(() => {
    if (open) {
      setForm(funnel ? funnelToForm(funnel) : EMPTY_FORM);
      setError("");
      setProductSearch("");
      setProducts([]);
    }
  }, [open, funnel]);

  // Fechar com Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Buscar contas Meta Ads ao abrir
  useEffect(() => {
    if (!open) return;
    fetch("/api/accounts?platform=meta-ads")
      .then((r) => r.json())
      .then((data) => setMetaAccounts(Array.isArray(data) ? data : []))
      .catch(() => setMetaAccounts([]));
  }, [open]);

  // Buscar produtos com debounce
  const fetchProducts = useCallback((q: string) => {
    setLoadingProducts(true);
    fetch(`/api/funnels/products?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .catch(() => setProducts([]))
      .finally(() => setLoadingProducts(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchProducts(productSearch), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [productSearch, open, fetchProducts]);

  function toggleProductId(pid: string) {
    setForm((prev) => ({
      ...prev,
      product_ids: prev.product_ids.includes(pid)
        ? prev.product_ids.filter((id) => id !== pid)
        : [...prev.product_ids, pid],
    }));
  }

  function toggleAdAccountId(aid: string) {
    setForm((prev) => ({
      ...prev,
      ad_account_ids: prev.ad_account_ids.includes(aid)
        ? prev.ad_account_ids.filter((id) => id !== aid)
        : [...prev.ad_account_ids, aid],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Nome é obrigatório");
      return;
    }
    if (!form.start_date || !form.end_date) {
      setError("Período é obrigatório");
      return;
    }
    if (new Date(form.end_date) <= new Date(form.start_date)) {
      setError("Data de fim deve ser posterior à data de início");
      return;
    }
    const goalNum = parseInt(form.goal_sales, 10);
    if (!goalNum || goalNum < 1) {
      setError("Objetivo de vendas deve ser maior que zero");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        type: form.type,
        start_date: form.start_date,
        end_date: form.end_date,
        goal_sales: goalNum,
        config: {
          product_ids: form.product_ids,
          ad_account_ids: form.ad_account_ids,
          campaign_ids: form.campaign_ids,
        },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar funil");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  // Lista de produtos para exibir: selecionados no topo + resultado da busca
  const selectedProducts = products.filter((p) => form.product_ids.includes(p.product_id));
  const otherProducts = products.filter((p) => !form.product_ids.includes(p.product_id));
  const displayProducts = [...selectedProducts, ...otherProducts];

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    fontSize: 13,
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-border)",
    background: "var(--color-bg)",
    color: "var(--color-text)",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-text-muted)",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          width: "100%",
          maxWidth: 520,
          padding: 24,
          position: "relative",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Fechar */}
        <button
          onClick={onClose}
          type="button"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text-muted)",
            fontSize: 20,
            lineHeight: 1,
            padding: 4,
          }}
        >
          ✕
        </button>

        <h2
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: 20,
            paddingRight: 32,
          }}
        >
          {funnel ? "Editar Funil" : "Novo Funil"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Nome */}
          <div>
            <label style={labelStyle}>Nome do funil</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="Ex: Destrave Abril 2026"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          {/* Tipo */}
          <div>
            <label style={labelStyle}>Tipo</label>
            <select
              style={inputStyle}
              value={form.type}
              onChange={(e) =>
                setForm((p) => ({ ...p, type: e.target.value as "destrave" }))
              }
            >
              <option value="destrave">Destrave</option>
            </select>
          </div>

          {/* Período */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Data de início</label>
              <input
                style={inputStyle}
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Data de fim</label>
              <input
                style={inputStyle}
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
              />
            </div>
          </div>

          {/* Objetivo */}
          <div>
            <label style={labelStyle}>Objetivo de vendas</label>
            <input
              style={inputStyle}
              type="number"
              min={1}
              placeholder="Ex: 120"
              value={form.goal_sales}
              onChange={(e) => setForm((p) => ({ ...p, goal_sales: e.target.value }))}
            />
          </div>

          {/* Produtos Hotmart */}
          <div>
            <label style={labelStyle}>
              Produtos Hotmart{" "}
              {form.product_ids.length > 0 && (
                <span style={{ color: "var(--color-primary)", fontWeight: 400, textTransform: "none" }}>
                  ({form.product_ids.length} selecionado{form.product_ids.length > 1 ? "s" : ""})
                </span>
              )}
            </label>
            <input
              style={{ ...inputStyle, marginBottom: 8 }}
              type="text"
              placeholder="Buscar por nome ou ID..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
            <div
              style={{
                maxHeight: 180,
                overflowY: "auto",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--color-bg)",
              }}
            >
              {loadingProducts ? (
                <p style={{ padding: "10px 12px", fontSize: 12, color: "var(--color-text-muted)" }}>
                  Buscando...
                </p>
              ) : displayProducts.length === 0 ? (
                <p style={{ padding: "10px 12px", fontSize: 12, color: "var(--color-text-muted)" }}>
                  {productSearch ? "Nenhum produto encontrado" : "Digite para buscar produtos"}
                </p>
              ) : (
                displayProducts.map((p) => {
                  const checked = form.product_ids.includes(p.product_id);
                  return (
                    <label
                      key={p.product_id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px",
                        cursor: "pointer",
                        background: checked ? "var(--color-primary-light)" : "transparent",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProductId(p.product_id)}
                        style={{ accentColor: "var(--color-primary)", flexShrink: 0 }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <p
                          className="truncate"
                          style={{ fontSize: 12, color: "var(--color-text)", fontWeight: checked ? 600 : 400 }}
                        >
                          {p.product_name}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                          ID: {p.product_id}
                        </p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Contas Meta Ads */}
          <div>
            <label style={labelStyle}>
              Contas de Anúncios (Meta Ads){" "}
              {form.ad_account_ids.length > 0 && (
                <span style={{ color: "var(--color-primary)", fontWeight: 400, textTransform: "none" }}>
                  ({form.ad_account_ids.length} selecionada{form.ad_account_ids.length > 1 ? "s" : ""})
                </span>
              )}
            </label>
            {metaAccounts.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                Nenhuma conta Meta Ads configurada
              </p>
            ) : (
              <div
                style={{
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--color-bg)",
                  overflow: "hidden",
                }}
              >
                {metaAccounts.map((acc) => {
                  const checked = form.ad_account_ids.includes(acc.id);
                  return (
                    <label
                      key={acc.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        cursor: "pointer",
                        background: checked ? "var(--color-primary-light)" : "transparent",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAdAccountId(acc.id)}
                        style={{ accentColor: "var(--color-primary)", flexShrink: 0 }}
                      />
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--color-text)",
                          fontWeight: checked ? 600 : 400,
                        }}
                      >
                        {acc.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Erro */}
          {error && (
            <p style={{ fontSize: 13, color: "var(--color-danger)" }}>{error}</p>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "8px 20px",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: saving ? "var(--color-border)" : "var(--color-primary)",
                color: saving ? "var(--color-text-muted)" : "#fff",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "Salvando..." : funnel ? "Salvar alterações" : "Criar funil"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
