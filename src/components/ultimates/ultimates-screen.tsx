"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { UserRole } from "@/types/auth";
import { selectInitialCycleId } from "@/lib/ultimates/select-initial-cycle";
import { UltimatesDashboard } from "./ultimates-dashboard";
import { CycleFormModal } from "./cycle-form-modal";
import type { SetProductsResult } from "@/types/ultimates";
import type { DateRange } from "@/lib/ultimates/date-range";
import type { CycleWithProducts, HotmartProductOption } from "./types";

interface UltimatesScreenProps {
  role: UserRole;
  products: HotmartProductOption[];
}

// Client raiz da tela /ultimates (PRD issue #114, seções 3.1–3.3). Carrega
// ciclos via GET /api/ultimates/cycles, decide o estado (vazio / seletor +
// dashboard) e monta os modais de gestão de ciclo — só para role gestor,
// espelhando o gate real dos endpoints (analista só lê).
// Identidade visual: tema escuro compartilhado (src/app/dash-theme.css) +
// layout do módulo (src/app/ultimates/ultimates.css), no padrão do Indicadores.
export function UltimatesScreen({ role, products }: UltimatesScreenProps) {
  const isGestor = role === "gestor";

  const [cycles, setCycles] = useState<CycleWithProducts[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CycleWithProducts | null>(null);
  // Recibo da última troca de produtos. Null = nenhuma troca desde a última vez
  // que o gestor dispensou o aviso.
  const [productsNotice, setProductsNotice] = useState<SetProductsResult | null>(null);
  // Incrementado pelo botão "Tentar novamente" para reexecutar o efeito de
  // carga abaixo — mesmo padrão de EventosPage (fetch inline no efeito, com
  // flag de cancelamento), evitado setState fora do corpo do efeito.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadError(false);
      try {
        const res = await fetch("/api/ultimates/cycles");
        if (!res.ok) {
          if (!cancelled) setLoadError(true);
          return;
        }
        const data = await res.json();
        const list: CycleWithProducts[] = Array.isArray(data?.cycles) ? data.cycles : [];
        if (cancelled) return;
        setCycles(list);
        setSelectedId((prev) => (prev && list.some((c) => c.id === prev) ? prev : selectInitialCycleId(list)));
      } catch {
        if (!cancelled) setLoadError(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  function handleCreated(cycle: CycleWithProducts) {
    setCycles((prev) => [cycle, ...(prev ?? [])]);
    setSelectedId(cycle.id);
    setCreateOpen(false);
  }

  // O resultado da troca de produtos é informado AQUI e não no modal, que já
  // fechou. Só aparece quando houve troca (products != null) e não é erro — é
  // recibo: quantas linhas de roster sumiram e quantas entraram, números que o
  // gestor não teria como conferir sozinho depois do fato.
  function handleEdited(cycle: CycleWithProducts, products?: SetProductsResult | null) {
    setCycles((prev) => (prev ?? []).map((c) => (c.id === cycle.id ? cycle : c)));
    setEditTarget(null);
    setProductsNotice(products ?? null);
    // Força a recarga do dashboard: roster, KPIs e curva mudaram de universo.
    if (products) setReloadToken((t) => t + 1);
  }

  // Após excluir, a seleção é recalculada pela MESMA regra da carga inicial
  // (selectInitialCycleId), para que "excluí um ciclo" e "recarreguei a página"
  // terminem no mesmo lugar. Sem isso, selectedId ficaria apontando para um id
  // morto. A lista já vem ordenada por created_at desc do GET e as operações
  // acima preservam essa ordem — contrato de que selectInitialCycleId depende.
  function handleDeleted(cycleId: string) {
    const next = (cycles ?? []).filter((c) => c.id !== cycleId);
    setCycles(next);
    setSelectedId((current) =>
      current && next.some((c) => c.id === current) ? current : selectInitialCycleId(next)
    );
    setEditTarget(null);
  }

  // Aplicação OTIMISTA: a reclassificação é client-side e leva microssegundos,
  // então esperar a rede seria inventar latência. Devolve se deu certo — o
  // toggle usa isso para decidir se mostra o feedback de erro.
  //
  // O valor de verdade mora aqui, na lista de ciclos, e chega ao dashboard por
  // prop. NÃO replique em useState lá dentro: UltimatesDashboard é renderizado
  // sem key (de propósito, para o switch de séries sobreviver à troca de
  // ciclo), então uma cópia local carregaria a configuração do ciclo anterior.
  async function handleCountsNewBuyersChange(cycleId: string, value: boolean): Promise<boolean> {
    const previous = (cycles ?? []).find((c) => c.id === cycleId)?.counts_new_buyers ?? true;

    setCycles((prev) =>
      (prev ?? []).map((c) => (c.id === cycleId ? { ...c, counts_new_buyers: value } : c))
    );

    try {
      const res = await fetch(`/api/ultimates/cycles/${cycleId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ countsNewBuyers: value }),
      });
      if (!res.ok) throw new Error("patch falhou");
      return true;
    } catch {
      setCycles((prev) =>
        (prev ?? []).map((c) => (c.id === cycleId ? { ...c, counts_new_buyers: previous } : c))
      );
      return false;
    }
  }

  // Janela de visualização do ciclo (migration 063). NÃO é otimista, ao
  // contrário do handler acima: aqui a escrita muda o que TODOS os usuários
  // veem, e uma aplicação otimista dispararia a carga do roster recortado antes
  // da confirmação — se o PATCH falhasse, o rollback dispararia uma segunda
  // carga e o dashboard piscaria entre dois recortes, um deles inexistente no
  // banco. Esperar o ida-e-volta de um botão "Salvar" é a latência que o
  // usuário já espera.
  //
  // A resposta traz o ciclo autoritativo (com as datas normalizadas pelo
  // Postgres), e é ela que entra na lista — não o que mandamos.
  async function handleViewRangeChange(
    cycleId: string,
    range: DateRange | null
  ): Promise<boolean> {
    try {
      const res = await fetch(`/api/ultimates/cycles/${cycleId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          viewStartDate: range?.start ?? null,
          viewEndDate: range?.end ?? null,
        }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      const updated = data?.cycle as CycleWithProducts | undefined;
      if (!updated) return false;
      // O PATCH devolve a linha da tabela, SEM os produtos (o join só existe no
      // GET da lista). Preservamos os que já temos em vez de aceitar o
      // `products: undefined` da resposta — senão o header do dashboard perderia
      // os nomes dos produtos a cada período salvo.
      setCycles((prev) =>
        (prev ?? []).map((c) =>
          c.id === cycleId ? { ...updated, products: c.products } : c
        )
      );
      return true;
    } catch {
      return false;
    }
  }

  const selectedCycle =
    cycles && cycles.length > 0
      ? cycles.find((c) => c.id === selectedId) ?? cycles[0]
      : null;

  return (
    <div className="dash-dark ult-container">
      <header className="ult-header">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link
            href="/"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Módulos
          </Link>
          <div style={{ width: 1, height: 18, background: "var(--border-strong)" }} />
          <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-strong)", margin: 0 }}>
            Dash Ultimates
          </h1>
        </div>

        {isGestor && cycles && cycles.length > 0 && (
          <button
            onClick={() => setCreateOpen(true)}
            className="btn-primary"
            data-testid="ultimates-new-cycle-btn"
          >
            + Novo ciclo
          </button>
        )}
      </header>

      {createOpen && isGestor && (
        <CycleFormModal products={products} onSave={handleCreated} onCancel={() => setCreateOpen(false)} />
      )}
      {editTarget && isGestor && (
        <CycleFormModal
          products={products}
          editTarget={editTarget}
          onSave={handleEdited}
          onCancel={() => setEditTarget(null)}
          onDelete={handleDeleted}
        />
      )}

      {/* Recibo da troca de produtos. Fica fora do modal de propósito: o modal
          fecha no salvar, e é justamente depois dele que a contagem existe.
          Dispensável no clique — não é erro, é informação de uma vez só. */}
      {productsNotice && (
        <div
          role="status"
          data-testid="ultimates-products-notice"
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 12,
            color: "var(--text-muted)",
            margin: "0 0 16px",
            padding: "10px 12px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-vis)",
            background: "var(--surface)",
            lineHeight: 1.5,
          }}
        >
          <span>
            Produtos do ciclo atualizados: {productsNotice.products_added} adicionado(s),{" "}
            {productsNotice.products_removed} removido(s).
            {productsNotice.buyers_removed > 0 &&
              ` ${productsNotice.buyers_removed} comprador(es) saíram do roster por não terem mais compra nos produtos do ciclo.`}
            {productsNotice.buyers_materialized > 0 &&
              ` ${productsNotice.buyers_materialized} comprador(es) entraram a partir das compras já coletadas.`}
            {productsNotice.products_added > 0 &&
              " Compras ainda não coletadas entram no próximo Atualizar agora."}
          </span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setProductsNotice(null)}
            data-testid="ultimates-products-notice-dismiss"
            style={{ fontSize: 12, flexShrink: 0 }}
          >
            Ok
          </button>
        </div>
      )}

      {cycles === null && !loadError && (
        <p
          data-testid="ultimates-loading"
          style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "72px 24px", margin: 0 }}
        >
          Carregando ciclos...
        </p>
      )}

      {loadError && (
        <div
          data-testid="ultimates-error"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: "72px 24px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 13, color: "var(--red)", margin: 0 }}>
            Não foi possível carregar os ciclos.
          </p>
          <button onClick={() => setReloadToken((t) => t + 1)} className="btn-secondary">
            Tentar novamente
          </button>
        </div>
      )}

      {cycles !== null && !loadError && cycles.length === 0 && (
        <div
          data-testid="ultimates-empty-state"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "72px 24px",
            gap: 16,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
            Nenhum ciclo criado ainda
          </p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, maxWidth: 380, lineHeight: 1.6 }}>
            {isGestor
              ? "Crie o primeiro ciclo de renovação para acompanhar recompra, receita e roster de compradores."
              : "Assim que um gestor criar o primeiro ciclo de renovação, ele aparecerá aqui."}
          </p>
          {isGestor && (
            <button onClick={() => setCreateOpen(true)} className="btn-primary" data-testid="ultimates-create-cta">
              Criar ciclo
            </button>
          )}
        </div>
      )}

      {selectedCycle && cycles && cycles.length > 0 && (
        <>
          <div
            data-testid="ultimates-cycle-selector"
            style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 24 }}
          >
            {cycles.map((cycle) => {
              const selected = cycle.id === selectedCycle.id;
              return (
                <button
                  key={cycle.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedId(cycle.id)}
                  data-testid={`ultimates-cycle-option-${cycle.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    borderRadius: 20,
                    border: selected ? "1px solid rgba(76, 141, 255, 0.55)" : "1px solid var(--border-vis)",
                    background: selected ? "rgba(76, 141, 255, 0.14)" : "var(--surface)",
                    color: selected ? "#a8c4ff" : "var(--text-muted)",
                    cursor: "pointer",
                    transition: "background 150ms ease, color 150ms ease, border-color 150ms ease",
                  }}
                >
                  {cycle.name}
                  {cycle.status === "encerrado" && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: "1px 6px",
                        borderRadius: 10,
                        background: "var(--surface-2)",
                        color: "var(--text-3)",
                      }}
                    >
                      Encerrado
                    </span>
                  )}
                </button>
              );
            })}

            {isGestor && (
              <button
                type="button"
                onClick={() => setEditTarget(selectedCycle)}
                data-testid="ultimates-edit-cycle-btn"
                title="Editar ciclo"
                aria-label="Editar ciclo"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: "1px solid var(--border-vis)",
                  background: "var(--surface)",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            )}
          </div>

          <UltimatesDashboard
            cycle={selectedCycle}
            role={role}
            onCountsNewBuyersChange={handleCountsNewBuyersChange}
            onViewRangeChange={handleViewRangeChange}
          />
        </>
      )}
    </div>
  );
}
