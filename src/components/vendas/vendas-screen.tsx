"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { UserRole } from "@/types/auth";
import { selectInitialCycleId } from "@/lib/vendas/select-initial-cycle";
import { groupCyclesByFolder } from "@/lib/vendas/group-cycles";
import { FolderSection } from "./folder-section";
import { FolderFormModal } from "./folder-form-modal";
import { VendasDashboard } from "./vendas-dashboard";
import { CycleFormModal } from "./cycle-form-modal";
import type { SetProductsResult, VendasFolderRecord } from "@/types/vendas";
import type { DateRange } from "@/lib/vendas/date-range";
import type { CycleWithProducts, HotmartProductOption } from "./types";

interface VendasScreenProps {
  role: UserRole;
  products: HotmartProductOption[];
}

export function VendasScreen({ role, products }: VendasScreenProps) {
  const isGestor = role === "gestor";

  const [cycles, setCycles] = useState<CycleWithProducts[] | null>(null);
  const [folders, setFolders] = useState<VendasFolderRecord[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CycleWithProducts | null>(null);

  // Estados de gestão de pasta
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [editFolderTarget, setEditFolderTarget] = useState<VendasFolderRecord | null>(null);
  const [expandedOverride, setExpandedOverride] = useState<Record<string, boolean>>({});

  const [productsNotice, setProductsNotice] = useState<SetProductsResult | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadError(false);
      try {
        const [cyclesRes, foldersRes] = await Promise.all([
          fetch("/api/vendas/cycles"),
          fetch("/api/vendas/folders").catch(() => null),
        ]);

        if (!cyclesRes.ok) {
          if (!cancelled) setLoadError(true);
          return;
        }

        const cyclesData = await cyclesRes.json();
        const list: CycleWithProducts[] = Array.isArray(cyclesData?.cycles) ? cyclesData.cycles : [];

        let fetchedFolders: VendasFolderRecord[] = [];
        if (foldersRes && foldersRes.ok) {
          const foldersData = await foldersRes.json();
          fetchedFolders = Array.isArray(foldersData?.folders) ? foldersData.folders : [];
        }

        if (cancelled) return;
        setCycles(list);
        setFolders(fetchedFolders);
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

  async function handleCreated(created: CycleWithProducts) {
    setCycles((prev) => [created, ...(prev ?? [])]);
    setSelectedId(created.id);
    setCreateOpen(false);
  }

  async function handleEdited(updated: CycleWithProducts, notice?: SetProductsResult | null) {
    setCycles((prev) => (prev ?? []).map((c) => (c.id === updated.id ? updated : c)));
    setEditTarget(null);
    if (notice) setProductsNotice(notice);
    if (notice) setReloadToken((t) => t + 1);
  }

  async function handleDeleted(deletedId: string) {
    const next = (cycles ?? []).filter((c) => c.id !== deletedId);
    setCycles(next);
    setSelectedId((current) =>
      current && next.some((c) => c.id === current) ? current : selectInitialCycleId(next)
    );
    setEditTarget(null);
  }

  // Handlers do CRUD de Pastas
  async function handleCreateFolder(name: string) {
    const res = await fetch("/api/vendas/folders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error ?? "Erro ao criar pasta");
    }

    const created: VendasFolderRecord = data.folder;
    setFolders((prev) => [...prev, created]);
    setCreateFolderOpen(false);
  }

  async function handleRenameFolder(name: string) {
    if (!editFolderTarget) return;

    const res = await fetch(`/api/vendas/folders/${editFolderTarget.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error ?? "Erro ao renomear pasta");
    }

    const updated: VendasFolderRecord = data.folder;
    setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    setEditFolderTarget(null);
  }

  async function handleDeleteFolder(folder: VendasFolderRecord) {
    if (!confirm(`Deseja realmente deletar a pasta "${folder.name}"? Os ciclos desta pasta retornarão para "Sem pasta".`)) {
      return;
    }

    const res = await fetch(`/api/vendas/folders/${folder.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Erro ao deletar pasta");
      return;
    }

    setFolders((prev) => prev.filter((f) => f.id !== folder.id));
    setCycles((prev) =>
      (prev ?? []).map((c) => (c.folder_id === folder.id ? { ...c, folder_id: null } : c))
    );
  }

  async function handleCountsNewBuyersChange(cycleId: string, value: boolean): Promise<boolean> {
    const previous = (cycles ?? []).find((c) => c.id === cycleId)?.counts_new_buyers ?? true;

    setCycles((prev) =>
      (prev ?? []).map((c) => (c.id === cycleId ? { ...c, counts_new_buyers: value } : c))
    );

    try {
      const res = await fetch(`/api/vendas/cycles/${cycleId}`, {
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

  async function handleViewRangeChange(
    cycleId: string,
    range: DateRange | null
  ): Promise<boolean> {
    try {
      const res = await fetch(`/api/vendas/cycles/${cycleId}`, {
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

  // Calcula os grupos de ciclo por pasta
  const rawGroups = groupCyclesByFolder(cycles ?? [], folders, selectedCycle?.id ?? null);
  const groups = rawGroups.map((g) => ({
    ...g,
    isExpanded: expandedOverride[g.id] ?? g.isExpanded,
  }));

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
            Relatório de Vendas
          </h1>
        </div>

        {isGestor && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => setCreateFolderOpen(true)}
              data-testid="vendas-new-folder-btn"
              style={{
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 500,
                borderRadius: "var(--radius-sm, 6px)",
                border: "1px solid var(--border-vis, rgba(255,255,255,0.15))",
                background: "var(--surface, rgba(255,255,255,0.05))",
                color: "var(--text-strong, #fff)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              + Nova pasta
            </button>

            {cycles && cycles.length > 0 && (
              <button
                onClick={() => setCreateOpen(true)}
                className="btn-primary"
                data-testid="ultimates-new-cycle-btn"
              >
                + Novo ciclo
              </button>
            )}
          </div>
        )}
      </header>

      {/* Modais de ciclo e pasta */}
      {createOpen && isGestor && (
        <CycleFormModal
          products={products}
          folders={folders}
          onSave={handleCreated}
          onCancel={() => setCreateOpen(false)}
        />
      )}

      {editTarget && isGestor && (
        <CycleFormModal
          products={products}
          folders={folders}
          editTarget={editTarget}
          onSave={handleEdited}
          onCancel={() => setEditTarget(null)}
          onDelete={handleDeleted}
        />
      )}

      {createFolderOpen && isGestor && (
        <FolderFormModal
          onSave={handleCreateFolder}
          onCancel={() => setCreateFolderOpen(false)}
        />
      )}

      {editFolderTarget && isGestor && (
        <FolderFormModal
          folderTarget={editFolderTarget}
          onSave={handleRenameFolder}
          onCancel={() => setEditFolderTarget(null)}
        />
      )}

      {/* Notice de alteração de produtos */}
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
            data-testid="ultimates-products-notice-dismiss"
            onClick={() => setProductsNotice(null)}
            style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Conteúdo de Erro ou Vazio */}
      {loadError && (
        <div style={{ textAlign: "center", padding: 48, color: "#ef4444" }}>
          <p style={{ margin: 0, fontSize: 14 }}>Falha ao carregar os dados.</p>
          <button
            onClick={() => setReloadToken((t) => t + 1)}
            style={{ marginTop: 12, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {cycles && cycles.length === 0 && !loadError && (
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

      {/* Lista de seções por pasta com a fileira de ciclo */}
      {cycles && cycles.length > 0 && (
        <>
          <div data-testid="ultimates-cycle-selector" style={{ marginBottom: 24 }}>
            {groups.map((group) => (
              <FolderSection
                key={group.id}
                group={group}
                selectedCycleId={selectedCycle?.id ?? null}
                isGestor={isGestor}
                onSelectCycle={(cycleId) => setSelectedId(cycleId)}
                onEditCycle={(cycle) => setEditTarget(cycle)}
                onToggleExpand={(groupId) =>
                  setExpandedOverride((prev) => ({
                    ...prev,
                    [groupId]: !groups.find((g) => g.id === groupId)?.isExpanded,
                  }))
                }
                onRenameFolder={(folder) => setEditFolderTarget(folder)}
                onDeleteFolder={handleDeleteFolder}
              />
            ))}
          </div>

          {selectedCycle && (
            <VendasDashboard
              cycle={selectedCycle}
              role={role}
              onCountsNewBuyersChange={handleCountsNewBuyersChange}
              onViewRangeChange={handleViewRangeChange}
              onConfigureOffers={isGestor ? () => setEditTarget(selectedCycle) : undefined}
            />
          )}
        </>
      )}
    </div>
  );
}

export { VendasScreen as UltimatesScreen };
