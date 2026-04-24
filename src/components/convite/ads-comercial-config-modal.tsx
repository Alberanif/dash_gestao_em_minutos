"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Account } from "@/types/accounts";
import type { ConviteAdsComercialConfig, ConviteProject } from "@/types/convite";

interface HotmartProduct {
  product_id: string;
  product_name: string;
}

interface AdsComercialConfigFormData {
  hotmart_account_id: string | null;
  hotmart_product_ids: string[];
  meta_ads_account_ids: string[];
  campaign_terms: string[];
  organic_lead_events: string[];
}

interface ConviteAdsComercialConfigModalProps {
  open: boolean;
  project: ConviteProject | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

const EMPTY_FORM: AdsComercialConfigFormData = {
  hotmart_account_id: null,
  hotmart_product_ids: [],
  meta_ads_account_ids: [],
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

function mapConfigToForm(config: ConviteAdsComercialConfig | null): AdsComercialConfigFormData {
  if (!config) return EMPTY_FORM;

  return {
    hotmart_account_id: config.hotmart_account_id,
    hotmart_product_ids: config.hotmart_product_ids,
    meta_ads_account_ids: config.meta_ads_account_ids,
    campaign_terms: config.campaign_terms,
    organic_lead_events: config.organic_lead_events,
  };
}

export function ConviteAdsComercialConfigModal({
  open,
  project,
  onClose,
  onSaved,
}: ConviteAdsComercialConfigModalProps) {
  const [form, setForm] = useState<AdsComercialConfigFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hotmartAccounts, setHotmartAccounts] = useState<Account[]>([]);
  const [metaAccounts, setMetaAccounts] = useState<Account[]>([]);
  const [allProducts, setAllProducts] = useState<HotmartProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [termInput, setTermInput] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [showEventDropdown, setShowEventDropdown] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const eventDropdownRef = useRef<HTMLDivElement>(null);

  async function fetchProducts(accountId: string) {
    setLoadingProducts(true);
    setAllProducts([]);
    try {
      const response = await fetch(`/api/hotmart/products?account_id=${accountId}`);
      const data = await response.json();
      setAllProducts(Array.isArray(data) ? data : []);
    } catch {
      setAllProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    if (open) {
      document.addEventListener("keydown", handleKey);
    }

    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        productDropdownRef.current &&
        !productDropdownRef.current.contains(event.target as Node)
      ) {
        setShowProductDropdown(false);
      }
      if (
        eventDropdownRef.current &&
        !eventDropdownRef.current.contains(event.target as Node)
      ) {
        setShowEventDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open || !project || project.grupo !== "funil_ads_comercial") return;

    let active = true;
    setLoading(true);
    setError("");
    setTermInput("");
    setProductSearch("");
    setEventSearch("");
    setShowProductDropdown(false);
    setShowEventDropdown(false);

    Promise.all([
      fetch("/api/accounts?platform=hotmart").then(async (response) => {
        if (!response.ok) throw new Error("Erro ao carregar contas Hotmart");
        return response.json();
      }),
      fetch("/api/accounts?platform=meta-ads").then(async (response) => {
        if (!response.ok) throw new Error("Erro ao carregar contas Meta Ads");
        return response.json();
      }),
      fetch("/api/convite/leads/events").then(async (response) => {
        if (!response.ok) throw new Error("Erro ao carregar eventos orgânicos");
        return response.json();
      }),
      fetch(`/api/convite/ads-comercial/projects/${project.id}/config`).then(async (response) => {
        if (!response.ok) throw new Error("Erro ao carregar configuração do projeto");
        return response.json();
      }),
    ])
      .then(async ([hotmartData, metaData, eventData, configData]) => {
        if (!active) return;

        const hotmartList = Array.isArray(hotmartData) ? hotmartData.filter((account) => account.is_active) : [];
        const metaList = Array.isArray(metaData) ? metaData.filter((account) => account.is_active) : [];
        const events = Array.isArray(eventData) ? eventData : [];
        const config = (configData && typeof configData === "object" && "convite_project_id" in configData)
          ? (configData as ConviteAdsComercialConfig)
          : null;

        setHotmartAccounts(hotmartList);
        setMetaAccounts(metaList);
        setAvailableEvents(events);
        setForm(mapConfigToForm(config));

        if (config?.hotmart_account_id) {
          await fetchProducts(config.hotmart_account_id);
        } else {
          setAllProducts([]);
        }
      })
      .catch(() => {
        if (!active) return;
        setHotmartAccounts([]);
        setMetaAccounts([]);
        setAvailableEvents([]);
        setForm(EMPTY_FORM);
        setAllProducts([]);
        setError("Não foi possível carregar a configuração do projeto");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, project]);

  const filteredProducts = useMemo(
    () =>
      allProducts.filter(
        (product) =>
          !form.hotmart_product_ids.includes(product.product_id) &&
          (productSearch.length < 2 ||
            product.product_name.toLowerCase().includes(productSearch.toLowerCase()) ||
            product.product_id.includes(productSearch))
      ),
    [allProducts, form.hotmart_product_ids, productSearch]
  );

  const filteredEvents = useMemo(
    () =>
      availableEvents.filter(
        (event) =>
          event.toLowerCase().includes(eventSearch.toLowerCase()) &&
          !form.organic_lead_events.includes(event)
      ),
    [availableEvents, eventSearch, form.organic_lead_events]
  );

  function handleHotmartAccountChange(accountId: string) {
    setForm((prev) => ({
      ...prev,
      hotmart_account_id: accountId || null,
      hotmart_product_ids: [],
    }));
    setProductSearch("");
    if (accountId) {
      fetchProducts(accountId);
    } else {
      setAllProducts([]);
    }
  }

  function toggleMetaAccount(accountId: string) {
    setForm((prev) => ({
      ...prev,
      meta_ads_account_ids: prev.meta_ads_account_ids.includes(accountId)
        ? prev.meta_ads_account_ids.filter((value) => value !== accountId)
        : [...prev.meta_ads_account_ids, accountId],
    }));
  }

  function addProduct(product: HotmartProduct) {
    if (form.hotmart_product_ids.includes(product.product_id)) return;
    setForm((prev) => ({
      ...prev,
      hotmart_product_ids: [...prev.hotmart_product_ids, product.product_id],
    }));
    setProductSearch("");
    setShowProductDropdown(false);
  }

  function removeProduct(productId: string) {
    setForm((prev) => ({
      ...prev,
      hotmart_product_ids: prev.hotmart_product_ids.filter((value) => value !== productId),
    }));
  }

  function addTerm() {
    const value = termInput.trim();
    if (!value || form.campaign_terms.includes(value)) return;
    setForm((prev) => ({
      ...prev,
      campaign_terms: [...prev.campaign_terms, value],
    }));
    setTermInput("");
  }

  function removeTerm(term: string) {
    setForm((prev) => ({
      ...prev,
      campaign_terms: prev.campaign_terms.filter((value) => value !== term),
    }));
  }

  function addEvent(event: string) {
    if (form.organic_lead_events.includes(event)) return;
    setForm((prev) => ({
      ...prev,
      organic_lead_events: [...prev.organic_lead_events, event],
    }));
    setEventSearch("");
    setShowEventDropdown(false);
  }

  function removeEvent(event: string) {
    setForm((prev) => ({
      ...prev,
      organic_lead_events: prev.organic_lead_events.filter((value) => value !== event),
    }));
  }

  function getProductName(productId: string) {
    return allProducts.find((product) => product.product_id === productId)?.product_name ?? productId;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/convite/ads-comercial/projects/${project.id}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Erro ao salvar configuração");
      }

      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !project || project.grupo !== "funil_ads_comercial") {
    return null;
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          width: "100%",
          maxWidth: 560,
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
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: "var(--color-text)",
            paddingRight: 36,
          }}
        >
          Configurar Funil ADS Comercial
        </h2>
        <p
          style={{
            margin: "6px 0 20px",
            fontSize: 13,
            color: "var(--color-text-muted)",
          }}
        >
          {project.nome_projeto}
        </p>

        {loading ? (
          <div
            style={{
              borderRadius: "var(--radius-sm)",
              border: "1px dashed var(--color-border)",
              background: "var(--color-bg)",
              padding: "18px 16px",
              fontSize: 13,
              color: "var(--color-text-muted)",
            }}
          >
            Carregando configuração...
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={labelStyle}>Conta Hotmart</label>
              <select
                style={inputStyle}
                value={form.hotmart_account_id ?? ""}
                onChange={(event) => handleHotmartAccountChange(event.target.value)}
              >
                <option value="">Selecionar conta...</option>
                {hotmartAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Produtos Hotmart</label>
              <div ref={productDropdownRef} style={{ position: "relative" }}>
                <input
                  style={{
                    ...inputStyle,
                    background: !form.hotmart_account_id ? "var(--color-border)" : "var(--color-bg)",
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
                  onChange={(event) => {
                    setProductSearch(event.target.value);
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                />
                {showProductDropdown && filteredProducts.length > 0 ? (
                  <DropdownList>
                    {filteredProducts.map((product) => (
                      <DropdownItem key={product.product_id} onClick={() => addProduct(product)}>
                        <span style={{ fontWeight: 600 }}>{product.product_name}</span>
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 11,
                            color: "var(--color-text-muted)",
                          }}
                        >
                          {product.product_id}
                        </span>
                      </DropdownItem>
                    ))}
                  </DropdownList>
                ) : null}
              </div>
              {form.hotmart_product_ids.length > 0 ? (
                <ChipRow
                  items={form.hotmart_product_ids.map((productId) => ({
                    key: productId,
                    label: getProductName(productId),
                    onRemove: () => removeProduct(productId),
                    tone: "orange",
                  }))}
                />
              ) : null}
            </div>

            <div>
              <label style={labelStyle}>Contas Meta Ads</label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 10,
                }}
              >
                {metaAccounts.map((account) => {
                  const checked = form.meta_ads_account_ids.includes(account.id);
                  return (
                    <label
                      key={account.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        border: "1px solid var(--color-border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "10px 12px",
                        background: checked ? "color-mix(in srgb, var(--color-primary) 10%, transparent)" : "var(--color-bg)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleMetaAccount(account.id)}
                      />
                      <span style={{ fontSize: 13, color: "var(--color-text)" }}>{account.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Termos em comum (Meta Ads)</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  type="text"
                  placeholder="Ex.: destrave, comercial, black"
                  value={termInput}
                  onChange={(event) => setTermInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTerm();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addTerm}
                  disabled={!termInput.trim()}
                  style={secondaryButtonStyle(!termInput.trim())}
                >
                  +
                </button>
              </div>
              {form.campaign_terms.length > 0 ? (
                <ChipRow
                  items={form.campaign_terms.map((term) => ({
                    key: term,
                    label: term,
                    onRemove: () => removeTerm(term),
                    tone: "primary",
                  }))}
                />
              ) : null}
            </div>

            <div>
              <label style={labelStyle}>Eventos de leads orgânicos</label>
              <div ref={eventDropdownRef} style={{ position: "relative" }}>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="Buscar evento..."
                  value={eventSearch}
                  onChange={(event) => {
                    setEventSearch(event.target.value);
                    setShowEventDropdown(true);
                  }}
                  onFocus={() => setShowEventDropdown(true)}
                />
                {showEventDropdown && filteredEvents.length > 0 ? (
                  <DropdownList>
                    {filteredEvents.map((eventName) => (
                      <DropdownItem key={eventName} onClick={() => addEvent(eventName)}>
                        {eventName}
                      </DropdownItem>
                    ))}
                  </DropdownList>
                ) : null}
              </div>
              {form.organic_lead_events.length > 0 ? (
                <ChipRow
                  items={form.organic_lead_events.map((eventName) => ({
                    key: eventName,
                    label: eventName,
                    onRemove: () => removeEvent(eventName),
                    tone: "primary",
                  }))}
                />
              ) : null}
            </div>

            {error ? (
              <div
                style={{
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid color-mix(in srgb, var(--color-danger) 22%, transparent)",
                  background: "color-mix(in srgb, var(--color-danger) 8%, transparent)",
                  color: "var(--color-danger)",
                  fontSize: 13,
                  padding: "10px 12px",
                }}
              >
                {error}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
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
                  padding: "8px 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: saving ? "var(--color-border)" : "var(--color-primary)",
                  color: saving ? "var(--color-text-muted)" : "#fff",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Salvando..." : "Salvar configuração"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function DropdownList({ children }: { children: React.ReactNode }) {
  return (
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
        maxHeight: 220,
        overflowY: "auto",
      }}
    >
      {children}
    </div>
  );
}

function DropdownItem({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
      onMouseEnter={(event) => {
        (event.currentTarget as HTMLElement).style.background = "var(--color-bg)";
      }}
      onMouseLeave={(event) => {
        (event.currentTarget as HTMLElement).style.background = "none";
      }}
    >
      {children}
    </button>
  );
}

function ChipRow({
  items,
}: {
  items: Array<{
    key: string;
    label: string;
    onRemove: () => void;
    tone: "primary" | "orange";
  }>;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
      {items.map((item) => {
        const styles = item.tone === "orange"
          ? {
              background: "#fff7ed",
              color: "#f97316",
              border: "#f97316",
            }
          : {
              background: "var(--color-primary-light)",
              color: "var(--color-primary)",
              border: "var(--color-primary)",
            };

        return (
          <span
            key={item.key}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 10px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 99,
              background: styles.background,
              color: styles.color,
              border: `1px solid ${styles.border}`,
            }}
          >
            {item.label}
            <button
              type="button"
              onClick={item.onRemove}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: styles.color,
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </span>
        );
      })}
    </div>
  );
}

function secondaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 14px",
    fontSize: 16,
    fontWeight: 700,
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-primary)",
    background: disabled ? "var(--color-border)" : "var(--color-primary)",
    color: disabled ? "var(--color-text-muted)" : "#fff",
    cursor: disabled ? "not-allowed" : "pointer",
    flexShrink: 0,
  };
}
