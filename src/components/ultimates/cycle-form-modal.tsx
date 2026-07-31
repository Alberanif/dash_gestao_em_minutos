"use client";

import { useEffect, useMemo, useState } from "react";
import type { UltimatesCycleStatus } from "@/types/ultimates";
import type { CycleWithProducts, HotmartProductOption } from "./types";

interface CycleFormModalProps {
  products: HotmartProductOption[];
  editTarget?: CycleWithProducts | null;
  onSave: (cycle: CycleWithProducts) => void;
  onCancel: () => void;
}

// Cria ou edita um ciclo (só gestor — validado nos endpoints, e a tela só
// monta este modal para role gestor). Espelha o padrão de
// src/components/indicadores/filter-modal.tsx: form + confirmação em duas
// etapas para a ação sensível (aqui, encerrar o ciclo).
// A escolha de produto usa busca + lista (padrão de link-buyer-modal.tsx),
// com seleção explícita — sem pré-seleção.
export function CycleFormModal({ products, editTarget, onSave, onCancel }: CycleFormModalProps) {
  const isEdit = !!editTarget;
  const [name, setName] = useState(editTarget?.name ?? "");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [goalPercentInput, setGoalPercentInput] = useState(
    editTarget?.goal_percent != null ? String(editTarget.goal_percent) : ""
  );
  const [status, setStatus] = useState<UltimatesCycleStatus>(editTarget?.status ?? "ativo");
  const [confirmEncerrar, setConfirmEncerrar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Filtro local (nome ou ID, case-insensitive) — a lista completa de produtos
  // ativos já chega via props, então não há round-trip de API na busca.
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (q === "") return products;
    return products.filter(
      (p) => p.product_name.toLowerCase().includes(q) || p.product_id.toLowerCase().includes(q)
    );
  }, [products, productSearch]);

  // Derivada, não guardada em estado: zerar a seleção destrava sozinho, sem
  // um segundo setState que pudesse ficar dessincronizado da lista.
  const lockedAccountId =
    products.find((p) => p.product_id === productIds[0])?.account_id ?? null;

  function toggleProduct(productId: string) {
    setProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  }

  useEffect(() => {
    setConfirmEncerrar(false);
  }, [name, productIds, goalPercentInput, status]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  function parseGoalPercent(): number | null | "invalid" {
    const trimmed = goalPercentInput.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    if (Number.isNaN(n) || n < 0 || n > 100) return "invalid";
    return n;
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Nome é obrigatório.");
      return;
    }
    if (!isEdit && productIds.length === 0) {
      setError("Selecione ao menos um produto.");
      return;
    }
    const goalPercent = parseGoalPercent();
    if (goalPercent === "invalid") {
      setError("Meta deve ser um número entre 0 e 100, ou vazia.");
      return;
    }

    // Encerrar congela a operação do ciclo — exige confirmação explícita
    // (segundo clique), mesmo padrão de aviso-de-duas-etapas do filter-modal.
    if (isEdit && status === "encerrado" && editTarget!.status !== "encerrado" && !confirmEncerrar) {
      setConfirmEncerrar(true);
      return;
    }

    setError("");
    setSaving(true);
    try {
      const url = isEdit ? `/api/ultimates/cycles/${editTarget!.id}` : "/api/ultimates/cycles";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? { name: name.trim(), goalPercent, status }
        : { name: name.trim(), productIds, goalPercent };

      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Erro ao salvar ciclo.");
        return;
      }

      const savedRaw = data?.cycle as CycleWithProducts | undefined;
      if (!savedRaw) {
        setError("Erro ao salvar ciclo.");
        return;
      }
      // A rota devolve só a linha do ciclo; os nomes dos produtos já estão
      // aqui na prop, então montamos o formato da tela sem um GET extra.
      const savedProducts = isEdit
        ? editTarget!.products
        : productIds.map((id) => ({
            product_id: id,
            product_name: products.find((p) => p.product_id === id)?.product_name ?? null,
          }));
      onSave({ ...savedRaw, products: savedProducts });
    } catch {
      setError("Falha de rede ao salvar o ciclo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="ult-modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="ult-modal-panel" style={{ maxWidth: 440 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
          {isEdit ? "Editar ciclo" : "Novo ciclo"}
        </h3>

        <div>
          <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
            Nome
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Renovação Julho/2026"
            className="field-control"
            data-testid="cycle-form-name"
          />
        </div>

        {!isEdit && (
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
              Produtos Hotmart (1 ou mais)
            </label>
            {products.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
                Nenhum produto disponível
              </p>
            ) : (
              <>
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar por nome ou ID..."
                  className="field-control"
                  data-testid="cycle-form-product-search"
                />
                <ul
                  style={{
                    listStyle: "none",
                    margin: "8px 0 0",
                    padding: 0,
                    maxHeight: 200,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {filteredProducts.length === 0 && (
                    <li style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                      Nenhum produto encontrado.
                    </li>
                  )}
                  {filteredProducts.map((p) => {
                    const selected = productIds.includes(p.product_id);
                    const blocked = lockedAccountId !== null && p.account_id !== lockedAccountId;
                    return (
                      <li key={p.product_id}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          disabled={blocked}
                          title={
                            blocked
                              ? "Produto de outra conta Hotmart. Um ciclo acompanha produtos de uma conta só."
                              : undefined
                          }
                          className={selected ? "btn-primary" : "btn-secondary"}
                          data-testid={`cycle-form-product-option-${p.product_id}`}
                          onClick={() => toggleProduct(p.product_id)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            fontSize: 13,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                            opacity: blocked ? 0.45 : 1,
                            cursor: blocked ? "not-allowed" : "pointer",
                          }}
                        >
                          <span>{p.product_name}</span>
                          <span style={{ opacity: 0.7 }}>{p.product_id}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {productIds.length > 0 && (
                  <p
                    data-testid="cycle-form-product-selected"
                    style={{ fontSize: 12, color: "var(--color-text)", margin: "6px 0 0" }}
                  >
                    Selecionados:{" "}
                    <strong>
                      {productIds
                        .map((id) => products.find((p) => p.product_id === id)?.product_name ?? id)
                        .join(", ")}
                    </strong>{" "}
                    ({productIds.length})
                  </p>
                )}
                {lockedAccountId !== null && (
                  <p
                    data-testid="cycle-form-account-lock"
                    style={{ fontSize: 11, color: "var(--color-warning)", margin: "4px 0 0" }}
                  >
                    Conta travada pelo 1º produto selecionado — um ciclo acompanha produtos de uma conta só.
                  </p>
                )}
              </>
            )}
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "4px 0 0" }}>
              Produto recém-criado não aparece? Rode o sync em{" "}
              <code>/api/hotmart/sync-products</code> e tente novamente.
            </p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
            Meta de renovação (%) — opcional
          </label>
          <input
            value={goalPercentInput}
            onChange={(e) => setGoalPercentInput(e.target.value)}
            placeholder="Ex: 60"
            inputMode="decimal"
            className="field-control"
            data-testid="cycle-form-goal"
          />
        </div>

        {isEdit && (
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
              Status
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["ativo", "encerrado"] as UltimatesCycleStatus[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={status === opt}
                  onClick={() => setStatus(opt)}
                  data-testid={`cycle-form-status-${opt}`}
                  className={status === opt ? "btn-primary" : "btn-secondary"}
                  style={{ flex: 1 }}
                >
                  {opt === "ativo" ? "Ativo" : "Encerrado"}
                </button>
              ))}
            </div>
          </div>
        )}

        {confirmEncerrar && (
          <p
            role="status"
            data-testid="cycle-form-confirm-encerrar"
            style={{
              fontSize: 12,
              color: "var(--color-warning)",
              margin: 0,
              padding: "8px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)",
              background: "color-mix(in srgb, var(--color-warning) 10%, transparent)",
              lineHeight: 1.5,
            }}
          >
            Encerrar congela a operação deste ciclo — o dashboard continua acessível, só upload/vínculo/atualização ficam bloqueados. Clique em Salvar novamente para confirmar.
          </p>
        )}

        {error && <p style={{ fontSize: 12, color: "var(--color-danger)", margin: 0 }}>{error}</p>}

        <div className="ult-modal-actions">
          <button type="button" onClick={onCancel} className="btn-secondary" data-testid="cycle-form-cancel">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
            data-testid="cycle-form-save"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
