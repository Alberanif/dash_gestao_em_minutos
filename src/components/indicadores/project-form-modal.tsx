"use client";

import { useState, useEffect, useRef } from "react";
import type { IndicadoresProject } from "@/types/indicadores";
import type { Account } from "@/types/accounts";

interface HotmartProduct {
  product_id: string;
  product_name: string;
}

interface ProjectFormData {
  name: string;
  hotmart_account_id: string | null;
  hotmart_product_ids: string[];
  campaign_terms: string[];
  organic_lead_events: string[];
}

interface ProjectFormModalProps {
  project?: IndicadoresProject;
  open: boolean;
  onClose: () => void;
  onSave: (data: ProjectFormData) => Promise<void>;
}

const EMPTY: ProjectFormData = {
  name: "",
  hotmart_account_id: null,
  hotmart_product_ids: [],
  campaign_terms: [],
  organic_lead_events: [],
};

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

export function ProjectFormModal({ project, open, onClose, onSave }: ProjectFormModalProps) {
  const [form, setForm] = useState<ProjectFormData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Hotmart account + product state
  const [hotmartAccounts, setHotmartAccounts] = useState<Account[]>([]);
  const [allProducts, setAllProducts] = useState<HotmartProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  // Campaign terms state
  const [termInput, setTermInput] = useState("");

  // Organic lead events state
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [eventSearch, setEventSearch] = useState("");
  const [showEventDropdown, setShowEventDropdown] = useState(false);
  const eventDropdownRef = useRef<HTMLDivElement>(null);

  async function fetchProducts(accountId: string) {
    setLoadingProducts(true);
    setAllProducts([]);
    try {
      const res = await fetch(`/api/hotmart/products?account_id=${accountId}`);
      const data = await res.json();
      setAllProducts(Array.isArray(data) ? data : []);
    } catch {
      setAllProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    if (open) {
      if (project) {
        setForm({
          name: project.name,
          hotmart_account_id: project.hotmart_account_id ?? null,
          hotmart_product_ids: project.hotmart_product_ids ?? [],
          campaign_terms: project.campaign_terms,
          organic_lead_events: project.organic_lead_events ?? [],
        });
        if (project.hotmart_account_id) {
          fetchProducts(project.hotmart_account_id);
        }
      } else {
        setForm(EMPTY);
        setAllProducts([]);
      }
      setTermInput("");
      setProductSearch("");
      setEventSearch("");
      setError("");

      fetch("/api/accounts?platform=hotmart")
        .then((r) => r.json())
        .then((data: Account[]) =>
          setHotmartAccounts(Array.isArray(data) ? data.filter((a) => a.is_active) : [])
        )
        .catch(() => setHotmartAccounts([]));

      fetch("/api/indicadores/leads/events")
        .then((r) => r.json())
        .then((data: string[]) => setAvailableEvents(Array.isArray(data) ? data : []))
        .catch(() => setAvailableEvents([]));
    }
  }, [open, project]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        productDropdownRef.current &&
        !productDropdownRef.current.contains(e.target as Node)
      ) {
        setShowProductDropdown(false);
      }
      if (
        eventDropdownRef.current &&
        !eventDropdownRef.current.contains(e.target as Node)
      ) {
        setShowEventDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleAccountChange(accountId: string) {
    setForm((p) => ({
      ...p,
      hotmart_account_id: accountId || null,
      hotmart_product_ids: [],
    }));
    setAllProducts([]);
    setProductSearch("");
    if (accountId) fetchProducts(accountId);
  }

  function addProduct(product: HotmartProduct) {
    if (form.hotmart_product_ids.includes(product.product_id)) return;
    setForm((p) => ({
      ...p,
      hotmart_product_ids: [...p.hotmart_product_ids, product.product_id],
    }));
    setProductSearch("");
    setShowProductDropdown(false);
  }

  function removeProduct(productId: string) {
    setForm((p) => ({
      ...p,
      hotmart_product_ids: p.hotmart_product_ids.filter((id) => id !== productId),
    }));
  }

  function getProductName(productId: string): string {
    return allProducts.find((p) => p.product_id === productId)?.product_name ?? productId;
  }

  const filteredProducts = allProducts.filter(
    (p) =>
      !form.hotmart_product_ids.includes(p.product_id) &&
      (productSearch.length < 2 ||
        p.product_name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.product_id.includes(productSearch))
  );

  // Campaign terms helpers
  function addTerm() {
    const t = termInput.trim();
    if (!t || form.campaign_terms.includes(t)) return;
    setForm((p) => ({ ...p, campaign_terms: [...p.campaign_terms, t] }));
    setTermInput("");
  }

  function removeTerm(term: string) {
    setForm((p) => ({ ...p, campaign_terms: p.campaign_terms.filter((t) => t !== term) }));
  }

  // Organic lead events helpers
  function addEvent(evt: string) {
    if (form.organic_lead_events.includes(evt)) return;
    setForm((p) => ({ ...p, organic_lead_events: [...p.organic_lead_events, evt] }));
    setEventSearch("");
    setShowEventDropdown(false);
  }

  function removeEvent(evt: string) {
    setForm((p) => ({
      ...p,
      organic_lead_events: p.organic_lead_events.filter((e) => e !== evt),
    }));
  }

  const filteredEvents = availableEvents.filter(
    (e) =>
      e.toLowerCase().includes(eventSearch.toLowerCase()) &&
      !form.organic_lead_events.includes(e)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Nome é obrigatório");
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

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
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          width: "100%",
          maxWidth: 480,
          padding: 24,
          position: "relative",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
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
          {project ? "Editar Projeto" : "Novo Projeto"}
        </h2>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
        >
          {/* Project name */}
          <div>
            <label style={labelStyle}>Nome do projeto</label>
            <input
              style={inputStyle}
              type="text"
              placeholder="Ex: Destrave, Perpétuo, MH"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          {/* Hotmart account */}
          <div>
            <label style={labelStyle}>Conta Hotmart</label>
            <select
              style={{ ...inputStyle, cursor: "pointer" }}
              value={form.hotmart_account_id ?? ""}
              onChange={(e) => handleAccountChange(e.target.value)}
            >
              <option value="">Selecionar conta...</option>
              {hotmartAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Hotmart products */}
          <div>
            <label style={labelStyle}>Produtos Hotmart</label>
            <div ref={productDropdownRef} style={{ position: "relative" }}>
              <input
                style={{
                  ...inputStyle,
                  background:
                    !form.hotmart_account_id ? "var(--color-border)" : "var(--color-bg)",
                  cursor: !form.hotmart_account_id ? "not-allowed" : "text",
                }}
                type="text"
                placeholder={
                  !form.hotmart_account_id
                    ? "Selecione uma conta primeiro..."
                    : loadingProducts
                    ? "Carregando produtos..."
                    : "Buscar produto por nome ou ID..."
                }
                disabled={!form.hotmart_account_id || loadingProducts}
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setShowProductDropdown(true);
                }}
                onFocus={() => setShowProductDropdown(true)}
              />
              {showProductDropdown && filteredProducts.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    boxShadow: "var(--shadow-md)",
                    zIndex: 10,
                    maxHeight: 200,
                    overflowY: "auto",
                  }}
                >
                  {filteredProducts.map((p) => (
                    <button
                      key={p.product_id}
                      type="button"
                      onClick={() => addProduct(p)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 12px",
                        fontSize: 13,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--color-text)",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background =
                          "var(--color-bg)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "none";
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{p.product_name}</span>
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {p.product_id}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {form.hotmart_product_ids.length > 0 && (
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}
              >
                {form.hotmart_product_ids.map((pid) => (
                  <span
                    key={pid}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 99,
                      background: "#fff7ed",
                      color: "#f97316",
                      border: "1px solid #f97316",
                    }}
                  >
                    {getProductName(pid)}
                    <button
                      type="button"
                      onClick={() => removeProduct(pid)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#f97316",
                        fontSize: 14,
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Campaign terms */}
          <div>
            <label style={labelStyle}>Termos de campanha (Meta Ads)</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                type="text"
                placeholder="Termo para buscar campanhas..."
                value={termInput}
                onChange={(e) => setTermInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTerm();
                  }
                }}
              />
              <button
                type="button"
                onClick={addTerm}
                disabled={!termInput.trim()}
                style={{
                  padding: "8px 14px",
                  fontSize: 16,
                  fontWeight: 700,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-primary)",
                  background: termInput.trim()
                    ? "var(--color-primary)"
                    : "var(--color-border)",
                  color: termInput.trim() ? "#fff" : "var(--color-text-muted)",
                  cursor: termInput.trim() ? "pointer" : "not-allowed",
                  flexShrink: 0,
                }}
              >
                +
              </button>
            </div>
            {form.campaign_terms.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {form.campaign_terms.map((term) => (
                  <span
                    key={term}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 99,
                      background: "var(--color-primary-light)",
                      color: "var(--color-primary)",
                      border: "1px solid var(--color-primary)",
                    }}
                  >
                    {term}
                    <button
                      type="button"
                      onClick={() => removeTerm(term)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--color-primary)",
                        fontSize: 14,
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Organic lead events */}
          <div>
            <label style={labelStyle}>Eventos de Leads Orgânicos</label>
            <div ref={eventDropdownRef} style={{ position: "relative" }}>
              <input
                style={inputStyle}
                type="text"
                placeholder="Buscar evento..."
                value={eventSearch}
                onChange={(e) => {
                  setEventSearch(e.target.value);
                  setShowEventDropdown(true);
                }}
                onFocus={() => setShowEventDropdown(true)}
              />
              {showEventDropdown && filteredEvents.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    boxShadow: "var(--shadow-md)",
                    zIndex: 10,
                    maxHeight: 200,
                    overflowY: "auto",
                  }}
                >
                  {filteredEvents.map((evt) => (
                    <button
                      key={evt}
                      type="button"
                      onClick={() => addEvent(evt)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "8px 12px",
                        fontSize: 13,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--color-text)",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background =
                          "var(--color-bg)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "none";
                      }}
                    >
                      {evt}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {form.organic_lead_events.length > 0 && (
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}
              >
                {form.organic_lead_events.map((evt) => (
                  <span
                    key={evt}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 10px",
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 99,
                      background: "var(--color-primary-light)",
                      color: "var(--color-primary)",
                      border: "1px solid var(--color-primary)",
                    }}
                  >
                    {evt}
                    <button
                      type="button"
                      onClick={() => removeEvent(evt)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--color-primary)",
                        fontSize: 14,
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p style={{ fontSize: 13, color: "var(--color-danger)" }}>{error}</p>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              paddingTop: 4,
            }}
          >
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
              {saving ? "Salvando..." : project ? "Salvar alterações" : "Criar projeto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
