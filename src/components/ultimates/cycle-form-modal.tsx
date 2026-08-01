"use client";

import { useEffect, useMemo, useState } from "react";
import type { UltimatesCycleStatus, SetProductsResult } from "@/types/ultimates";
import type { CycleWithProducts, HotmartProductOption } from "./types";

interface CycleFormModalProps {
  products: HotmartProductOption[];
  editTarget?: CycleWithProducts | null;
  // O 2º argumento só vem quando o conjunto de produtos mudou: são as contagens
  // da RPC de troca. A tela usa buyers_removed para dizer quantas linhas de
  // roster sumiram — o modal já fechou quando isso precisa aparecer.
  onSave: (cycle: CycleWithProducts, products?: SetProductsResult | null) => void;
  onCancel: () => void;
  onDelete?: (cycleId: string) => void;
}

// Cria ou edita um ciclo (só gestor — validado nos endpoints, e a tela só
// monta este modal para role gestor). Espelha o padrão de
// src/components/indicadores/filter-modal.tsx: form + confirmação em duas
// etapas para a ação sensível (aqui, encerrar o ciclo).
// A escolha de produto usa busca + lista (padrão de link-buyer-modal.tsx),
// com seleção explícita — sem pré-seleção.
export function CycleFormModal({ products, editTarget, onSave, onCancel, onDelete }: CycleFormModalProps) {
  const isEdit = !!editTarget;
  const [name, setName] = useState(editTarget?.name ?? "");
  // Na edição, a seleção começa no conjunto ATUAL do ciclo — o modal é aberto
  // por rotina (mudar nome, mudar meta) e uma lista vazia aqui pareceria que o
  // ciclo perdeu os produtos.
  const [productIds, setProductIds] = useState<string[]>(
    editTarget?.products.map((p) => p.product_id) ?? []
  );
  const [productSearch, setProductSearch] = useState("");
  const [goalPercentInput, setGoalPercentInput] = useState(
    editTarget?.goal_percent != null ? String(editTarget.goal_percent) : ""
  );
  const [status, setStatus] = useState<UltimatesCycleStatus>(editTarget?.status ?? "ativo");
  // "Apenas Compras" só é escolhido na criação e é imutável depois (PRD). Na
  // edição o valor vem fixo do ciclo; no create é o estado deste interruptor.
  const [purchasesOnly, setPurchasesOnly] = useState(false);
  const isPurchasesOnly = isEdit ? !!editTarget?.purchases_only : purchasesOnly;
  const [confirmEncerrar, setConfirmEncerrar] = useState(false);
  // Segundo clique exigido quando algum produto SAI do conjunto. Adicionar é
  // inofensivo (só traz venda); remover apaga linha de roster.
  const [confirmRemoveProducts, setConfirmRemoveProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Zona de perigo: recolhida por padrão. Este modal é aberto por rotina (mudar
  // nome, mudar meta), então o alvo de clique destrutivo não fica exposto nem
  // na mesma faixa de Cancelar/Salvar.
  const [dangerOpen, setDangerOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Confere contra o nome PERSISTIDO (editTarget.name), nunca contra o campo
  // Nome do formulário — senão bastaria digitar qualquer coisa nos dois lugares
  // para destravar a exclusão, e a confirmação viraria enfeite.
  const deleteConfirmed = isEdit && deleteConfirmText.trim() === editTarget!.name;

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

  // Ciclo encerrado é histórico: trocar o produto reescreveria todos os números
  // dele de uma vez. O mesmo gate de canWrite que já bloqueia upload, vínculo e
  // refresh (a RPC repete a regra — esta checagem é só pela tela).
  const canEditProducts = !isEdit || editTarget!.status === "ativo";

  // Produtos que estavam no ciclo e não estão mais na seleção. Derivado do
  // editTarget PERSISTIDO, não de um snapshot em estado, para não descolar da
  // realidade se o ciclo for recarregado por baixo.
  const removedProducts = isEdit
    ? editTarget!.products.filter((p) => !productIds.includes(p.product_id))
    : [];

  const productsChanged =
    isEdit &&
    (removedProducts.length > 0 || productIds.length !== editTarget!.products.length);

  // Mexer no formulário derruba as duas confirmações: elas valem para o
  // conjunto de mudanças que estava na tela quando o gestor as leu, não para
  // qualquer estado futuro.
  useEffect(() => {
    setConfirmEncerrar(false);
    setConfirmRemoveProducts(false);
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
    // Vale na criação E na edição: um ciclo sem produto nenhum não dá erro em
    // lugar nenhum, só carrega o dashboard zerado.
    if (canEditProducts && productIds.length === 0) {
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

    // Remover produto apaga do roster os compradores que só existiam por causa
    // dele. Os nomes dos removidos ficam na tela junto do segundo clique — sem
    // isso o gestor confirmaria uma perda sem saber de qual produto ela vem.
    if (removedProducts.length > 0 && !confirmRemoveProducts) {
      setConfirmRemoveProducts(true);
      return;
    }

    setError("");
    setSaving(true);
    try {
      const url = isEdit ? `/api/ultimates/cycles/${editTarget!.id}` : "/api/ultimates/cycles";
      const method = isEdit ? "PATCH" : "POST";
      // productIds só entra no PATCH se o conjunto mudou: a RPC de troca apaga
      // e materializa comprador, e mandá-la a cada renomeação de ciclo seria
      // pagar esse trabalho — e esse risco — à toa.
      const body = isEdit
        ? productsChanged
          ? { name: name.trim(), goalPercent, status, productIds }
          : { name: name.trim(), goalPercent, status }
        : { name: name.trim(), productIds, goalPercent, purchasesOnly };

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
      // aqui na prop, então montamos o formato da tela sem um GET extra. Na
      // edição SEM troca de produtos o conjunto é o de antes; com troca, é o
      // que acabou de ser enviado.
      const savedProducts =
        isEdit && !productsChanged
          ? editTarget!.products
          : productIds.map((id) => ({
              product_id: id,
              product_name: products.find((p) => p.product_id === id)?.product_name ?? null,
            }));
      onSave(
        { ...savedRaw, products: savedProducts },
        (data?.products as SetProductsResult | null | undefined) ?? null
      );
    } catch {
      setError("Falha de rede ao salvar o ciclo.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEdit || !deleteConfirmed) return;

    setDeleteError("");
    setDeleting(true);
    try {
      const res = await fetch(`/api/ultimates/cycles/${editTarget!.id}`, { method: "DELETE" });

      // 404 conta como sucesso: o objetivo era "este ciclo não existir mais".
      // Se outra aba (ou outro gestor) já o excluiu, insistir em erro só deixaria
      // a tela presa exibindo um fantasma.
      if (res.ok || res.status === 404) {
        onDelete?.(editTarget!.id);
        return;
      }

      const data = await res.json().catch(() => null);
      setDeleteError(data?.error ?? "Erro ao excluir ciclo.");
    } catch {
      setDeleteError("Falha de rede ao excluir o ciclo.");
    } finally {
      setDeleting(false);
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

        {!isEdit && (
          <div>
            <button
              type="button"
              aria-pressed={purchasesOnly}
              onClick={() => setPurchasesOnly((v) => !v)}
              data-testid="cycle-form-purchases-only"
              className={purchasesOnly ? "btn-primary" : "btn-secondary"}
              style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
            >
              <span>Apenas Compras</span>
              <span style={{ opacity: 0.7, fontSize: 12 }}>{purchasesOnly ? "Ligado" : "Desligado"}</span>
            </button>
            <p style={{ fontSize: 11, color: "var(--color-text-muted)", margin: "4px 0 0", lineHeight: 1.4 }}>
              Sem base de renovação: toda compra aprovada do produto entra no Roster automaticamente. Definido só na criação — não muda depois.
            </p>
          </div>
        )}

        {isEdit && editTarget?.purchases_only && (
          <p
            data-testid="cycle-form-purchases-only-readonly"
            style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}
          >
            Modo: <strong>Apenas Compras</strong> (definido na criação, imutável)
          </p>
        )}

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

        {/* Ciclo encerrado mostra o conjunto, mas não deixa mexer: trocar o
            produto reescreveria todos os números de um histórico fechado. */}
        {isEdit && !canEditProducts && (
          <div>
            <label className="mb-1 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>
              Produtos Hotmart
            </label>
            <p
              data-testid="cycle-form-products-readonly"
              style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0, lineHeight: 1.5 }}
            >
              {editTarget!.products.map((p) => p.product_name ?? p.product_id).join(" · ")}
              <br />
              Ciclo encerrado — reative o ciclo para alterar os produtos.
            </p>
          </div>
        )}

        {canEditProducts && (
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

        {!isPurchasesOnly && (
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
        )}

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

        {/* Nomeia os produtos que SAEM, não só a quantidade: o gestor precisa
            reconhecer o que está prestes a perder, e "1 produto será removido"
            não permite isso. A contagem de compradores apagados não cabe aqui —
            ela só existe depois que a RPC roda. */}
        {confirmRemoveProducts && (
          <p
            role="status"
            data-testid="cycle-form-confirm-remove-products"
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
            Sai do ciclo:{" "}
            <strong>
              {removedProducts.map((p) => p.product_name ?? p.product_id).join(" · ")}
            </strong>
            . As compras desse produto deixam de contar, e os compradores que só existiam por
            causa dele saem do roster. Vínculos manuais e ofertas excluídas são preservados —
            readicionar o produto devolve tudo. Clique em Salvar novamente para confirmar.
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
            disabled={saving || deleting}
            className="btn-primary"
            data-testid="cycle-form-save"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>

        {isEdit && onDelete && (
          <div
            style={{
              marginTop: 4,
              paddingTop: 12,
              borderTop: "1px solid var(--color-border, var(--border-vis))",
            }}
          >
            {!dangerOpen ? (
              <button
                type="button"
                onClick={() => setDangerOpen(true)}
                data-testid="cycle-form-delete-open"
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: 12,
                  fontFamily: "inherit",
                  color: "var(--color-danger)",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Excluir ciclo
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p
                  data-testid="cycle-form-delete-warning"
                  style={{
                    fontSize: 12,
                    color: "var(--color-danger)",
                    margin: 0,
                    padding: "8px 10px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid color-mix(in srgb, var(--color-danger) 35%, transparent)",
                    background: "color-mix(in srgb, var(--color-danger) 10%, transparent)",
                    lineHeight: 1.5,
                  }}
                >
                  Excluir apaga o ciclo <strong>para sempre</strong>, junto com a base de
                  compradores, os vínculos manuais, as ofertas excluídas e os compradores
                  excluídos. Não há como desfazer. Para só congelar a operação sem perder nada,
                  use o status <strong>Encerrado</strong>.
                </p>
                <label className="block text-sm font-medium" style={{ color: "var(--color-text-muted)", fontSize: 12 }}>
                  Digite <strong>{editTarget!.name}</strong> para confirmar
                </label>
                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={editTarget!.name}
                  className="field-control"
                  data-testid="cycle-form-delete-confirm-input"
                />
                {deleteError && (
                  <p
                    data-testid="cycle-form-delete-error"
                    style={{ fontSize: 12, color: "var(--color-danger)", margin: 0 }}
                  >
                    {deleteError}
                  </p>
                )}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setDangerOpen(false);
                      setDeleteConfirmText("");
                      setDeleteError("");
                    }}
                    className="btn-secondary"
                    data-testid="cycle-form-delete-cancel"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={!deleteConfirmed || deleting}
                    data-testid="cycle-form-delete-confirm"
                    style={{
                      padding: "8px 14px",
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-danger)",
                      background: "var(--color-danger)",
                      color: "#fff",
                      cursor: !deleteConfirmed || deleting ? "not-allowed" : "pointer",
                      opacity: !deleteConfirmed || deleting ? 0.5 : 1,
                    }}
                  >
                    {deleting ? "Excluindo..." : "Excluir definitivamente"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
