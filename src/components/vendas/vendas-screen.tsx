"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { UserRole } from "@/types/auth";
import type { VendasFolderRecord, VendasViewRecord } from "@/types/vendas";
import type { DateRange } from "@/lib/vendas/date-range";
import { groupViewsByFolder, selectInitialViewId } from "@/lib/vendas/views";
import { FolderSection } from "./folder-section";
import { FolderFormModal } from "./folder-form-modal";
import { ConfirmDialog } from "./confirm-dialog";
import { ViewFormModal } from "./view-form-modal";
import { VendasViewDashboard } from "./vendas-view-dashboard";
import type { HotmartProductOption } from "./types";

interface VendasScreenProps {
  role: UserRole;
  products: HotmartProductOption[];
}

interface UnmigratedCycle {
  id: string;
  name: string;
}

// Enquanto o histórico é coletado a tela relê a visualização neste intervalo.
const BACKFILL_POLL_MS = 5000;

type DeleteTarget =
  | { kind: "view"; view: VendasViewRecord }
  | { kind: "folder"; folder: VendasFolderRecord };

// Tela do Relatório de Vendas (PRD #185): lista de Visualizações por pasta e o
// dashboard enxuto da selecionada. Só vendas dos produtos Hotmart.
export function VendasScreen({ role, products }: VendasScreenProps) {
  const isGestor = role === "gestor";

  const [views, setViews] = useState<VendasViewRecord[] | null>(null);
  const [unmigrated, setUnmigrated] = useState<UnmigratedCycle[]>([]);
  const [folders, setFolders] = useState<VendasFolderRecord[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<VendasViewRecord | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [editFolderTarget, setEditFolderTarget] = useState<VendasFolderRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [expandedOverride, setExpandedOverride] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadError(false);
      try {
        const [viewsRes, foldersRes] = await Promise.all([
          fetch("/api/vendas/views"),
          fetch("/api/vendas/folders").catch(() => null),
        ]);
        if (!viewsRes.ok) {
          if (!cancelled) setLoadError(true);
          return;
        }
        const viewsData = await viewsRes.json();
        const list: VendasViewRecord[] = Array.isArray(viewsData?.views) ? viewsData.views : [];
        const pending: UnmigratedCycle[] = Array.isArray(viewsData?.unmigrated_cycles) ? viewsData.unmigrated_cycles : [];

        let fetchedFolders: VendasFolderRecord[] = [];
        if (foldersRes && foldersRes.ok) {
          const foldersData = await foldersRes.json();
          fetchedFolders = Array.isArray(foldersData?.folders) ? foldersData.folders : [];
        }

        if (cancelled) return;
        setViews(list);
        setUnmigrated(pending);
        setFolders(fetchedFolders);
        setSelectedId((prev) => (prev && list.some((v) => v.id === prev) ? prev : selectInitialViewId(list)));
      } catch {
        if (!cancelled) setLoadError(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const selectedView =
    views && views.length > 0 ? views.find((v) => v.id === selectedId) ?? views[0] : null;

  const replaceView = useCallback((updated: VendasViewRecord) => {
    setViews((prev) => (prev ?? []).map((v) => (v.id === updated.id ? updated : v)));
  }, []);

  // Relê só a visualização selecionada (estado de backfill, last_refresh_at).
  const refetchView = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/vendas/views/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.view) replaceView(data.view as VendasViewRecord);
      } catch {
        // Silencioso: a próxima leitura (poll ou ação do usuário) tenta de novo.
      }
    },
    [replaceView]
  );

  const backfillActive = selectedView?.backfill_status === "pending" || selectedView?.backfill_status === "running";
  const selectedViewId = selectedView?.id ?? null;
  useEffect(() => {
    if (!backfillActive || !selectedViewId) return;
    const timer = setInterval(() => {
      void refetchView(selectedViewId);
    }, BACKFILL_POLL_MS);
    return () => clearInterval(timer);
  }, [backfillActive, selectedViewId, refetchView]);

  function handleSaved(view: VendasViewRecord, mode: "created" | "edited") {
    if (mode === "created") {
      setViews((prev) => [view, ...(prev ?? [])]);
      setSelectedId(view.id);
      setCreateOpen(false);
    } else {
      replaceView(view);
      setEditTarget(null);
    }
  }

  async function handleRangeChange(range: DateRange | null): Promise<boolean> {
    if (!selectedView) return false;
    try {
      const res = await fetch(`/api/vendas/views/${selectedView.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          view_start_date: range?.start ?? null,
          view_end_date: range?.end ?? null,
        }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (!data?.view) return false;
      replaceView(data.view as VendasViewRecord);
      return true;
    } catch {
      return false;
    }
  }

  async function handleCreateFolder(name: string) {
    const res = await fetch("/api/vendas/folders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "Erro ao criar pasta");
    setFolders((prev) => [...prev, data.folder as VendasFolderRecord]);
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
    if (!res.ok) throw new Error(data?.error ?? "Erro ao renomear pasta");
    const updated: VendasFolderRecord = data.folder;
    setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    setEditFolderTarget(null);
  }

  // Exclusão confirmada no diálogo próprio. Lança Error para o diálogo exibir
  // a mensagem da API e permanecer aberto.
  async function confirmDelete() {
    if (!deleteTarget) return;

    if (deleteTarget.kind === "view") {
      const { view } = deleteTarget;
      const res = await fetch(`/api/vendas/views/${view.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Erro ao excluir a visualização");
      }
      const next = (views ?? []).filter((v) => v.id !== view.id);
      setViews(next);
      setSelectedId((cur) => (cur && next.some((v) => v.id === cur) ? cur : selectInitialViewId(next)));
      setEditTarget(null);
    } else {
      const { folder } = deleteTarget;
      const res = await fetch(`/api/vendas/folders/${folder.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Erro ao deletar pasta");
      }
      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
      setViews((prev) => (prev ?? []).map((v) => (v.folder_id === folder.id ? { ...v, folder_id: null } : v)));
    }
    setDeleteTarget(null);
  }

  const groups = groupViewsByFolder(views ?? [], folders, selectedView?.id ?? null).map((g) => ({
    ...g,
    isExpanded: expandedOverride[g.id] ?? g.isExpanded,
  }));

  const hasViews = Boolean(views && views.length > 0);
  const productName = (view: VendasViewRecord) =>
    products.find((p) => p.product_id === view.product_id)?.product_name ?? view.product_id;

  return (
    <div className="dash-dark vendas-container">
      <header className="vendas-header">
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn-secondary" onClick={() => setCreateFolderOpen(true)} data-testid="vendas-new-folder-btn">
              + Nova pasta
            </button>
            <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)} data-testid="vendas-new-view-btn">
              + Nova visualização
            </button>
          </div>
        )}
      </header>

      {createOpen && isGestor && (
        <ViewFormModal products={products} folders={folders} onSaved={handleSaved} onCancel={() => setCreateOpen(false)} />
      )}

      {editTarget && isGestor && (
        <ViewFormModal
          products={products}
          folders={folders}
          editTarget={editTarget}
          onSaved={handleSaved}
          onCancel={() => setEditTarget(null)}
          onRequestDelete={(view) => setDeleteTarget({ kind: "view", view })}
        />
      )}

      {createFolderOpen && isGestor && (
        <FolderFormModal onSave={handleCreateFolder} onCancel={() => setCreateFolderOpen(false)} />
      )}

      {editFolderTarget && isGestor && (
        <FolderFormModal folderTarget={editFolderTarget} onSave={handleRenameFolder} onCancel={() => setEditFolderTarget(null)} />
      )}

      {deleteTarget && isGestor && (
        <ConfirmDialog
          title={deleteTarget.kind === "view" ? "Excluir visualização" : "Deletar pasta"}
          message={
            deleteTarget.kind === "view"
              ? `Excluir a visualização "${deleteTarget.view.name}"? As vendas coletadas da Hotmart não são apagadas, mas esta configuração será removida e não pode ser desfeita.`
              : `Deletar a pasta "${deleteTarget.folder.name}"? As visualizações desta pasta voltarão para "Sem pasta".`
          }
          confirmLabel={deleteTarget.kind === "view" ? "Excluir" : "Deletar"}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {isGestor && unmigrated.length > 0 && (
        <div
          role="status"
          data-testid="vendas-unmigrated-notice"
          title={unmigrated.map((c) => c.name).join(", ")}
          style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-vis)", background: "var(--surface)", lineHeight: 1.5 }}
        >
          {unmigrated.length} {unmigrated.length === 1 ? "ciclo antigo não foi migrado" : "ciclos antigos não foram migrados"} por falta de ofertas configuradas.
        </div>
      )}

      {loadError && (
        <div style={{ textAlign: "center", padding: 48, color: "#ef4444" }}>
          <p style={{ margin: 0, fontSize: 14 }}>Falha ao carregar os dados.</p>
          <button type="button" className="btn-secondary" onClick={() => setReloadToken((t) => t + 1)} style={{ marginTop: 12 }}>
            Tentar novamente
          </button>
        </div>
      )}

      {views && !hasViews && !loadError && (
        <div
          data-testid="vendas-empty-state"
          style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "72px 24px", gap: 16, textAlign: "center" }}
        >
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
            Nenhuma visualização criada ainda
          </p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, maxWidth: 380, lineHeight: 1.6 }}>
            {isGestor
              ? "Crie a primeira visualização para acompanhar a quantidade de vendas de um produto e de suas ofertas."
              : "Assim que um gestor criar a primeira visualização, ela aparecerá aqui."}
          </p>
          {isGestor && (
            <button type="button" onClick={() => setCreateOpen(true)} className="btn-primary" data-testid="vendas-create-cta">
              Criar visualização
            </button>
          )}
        </div>
      )}

      {hasViews && (
        <>
          <div data-testid="vendas-view-selector" style={{ marginBottom: 24 }}>
            {groups.map((group) => (
              <FolderSection
                key={group.id}
                group={group}
                selectedId={selectedView?.id ?? null}
                isGestor={isGestor}
                onSelect={(id) => setSelectedId(id)}
                onEdit={(view) => setEditTarget(view)}
                onToggleExpand={(groupId) =>
                  setExpandedOverride((prev) => ({
                    ...prev,
                    [groupId]: !groups.find((g) => g.id === groupId)?.isExpanded,
                  }))
                }
                onRenameFolder={(folder) => setEditFolderTarget(folder)}
                onDeleteFolder={(folder) => setDeleteTarget({ kind: "folder", folder })}
              />
            ))}
          </div>

          {selectedView && (
            <VendasViewDashboard
              key={selectedView.id}
              view={selectedView}
              productName={productName(selectedView)}
              role={role}
              onRangeChange={handleRangeChange}
              onViewChanged={() => void refetchView(selectedView.id)}
            />
          )}
        </>
      )}
    </div>
  );
}
