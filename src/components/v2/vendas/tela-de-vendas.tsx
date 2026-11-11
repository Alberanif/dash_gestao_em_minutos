"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserRole } from "@/types/auth";
import type { VendasFolderRecord, VendasViewRecord } from "@/types/vendas";
import { groupViewsByFolder, selectInitialViewId } from "@/lib/vendas/views";
import { Button, Surface } from "../ui";
import { PainelVisualizacoes } from "./painel-visualizacoes";
import type { CicloNaoMigrado, ProdutoHotmart } from "./tipos";

interface TelaDeVendasProps {
  role: UserRole;
  products: ProdutoHotmart[];
}

// Enquanto o histórico é coletado a tela relê a visualização neste intervalo.
const INTERVALO_BACKFILL_MS = 5000;

/**
 * Relatório de Vendas (PRD #303): painel de visualizações por pasta e o
 * dashboard da selecionada. Só vendas dos produtos Hotmart.
 */
export function TelaDeVendas({ role, products }: TelaDeVendasProps) {
  const canEdit = role === "gestor" || role === "analista";

  const [views, setViews] = useState<VendasViewRecord[] | null>(null);
  const [naoMigrados, setNaoMigrados] = useState<CicloNaoMigrado[]>([]);
  const [folders, setFolders] = useState<VendasFolderRecord[]>([]);
  const [erroDeCarga, setErroDeCarga] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [pastaAberta, setPastaAberta] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      setErroDeCarga(false);
      try {
        const [viewsRes, foldersRes] = await Promise.all([
          fetch("/api/vendas/views"),
          fetch("/api/vendas/folders").catch(() => null),
        ]);
        if (!viewsRes.ok) {
          if (!cancelado) setErroDeCarga(true);
          return;
        }
        const viewsData = await viewsRes.json();
        const lista: VendasViewRecord[] = Array.isArray(viewsData?.views) ? viewsData.views : [];
        const pendentes: CicloNaoMigrado[] = Array.isArray(viewsData?.unmigrated_cycles)
          ? viewsData.unmigrated_cycles
          : [];

        let pastas: VendasFolderRecord[] = [];
        if (foldersRes && foldersRes.ok) {
          const foldersData = await foldersRes.json();
          pastas = Array.isArray(foldersData?.folders) ? foldersData.folders : [];
        }

        if (cancelado) return;
        setViews(lista);
        setNaoMigrados(pendentes);
        setFolders(pastas);
        setSelectedId((prev) => (prev && lista.some((v) => v.id === prev) ? prev : selectInitialViewId(lista)));
      } catch {
        if (!cancelado) setErroDeCarga(true);
      }
    }
    carregar();
    return () => {
      cancelado = true;
    };
  }, [recarga]);

  const selecionada =
    views && views.length > 0 ? (views.find((v) => v.id === selectedId) ?? views[0]) : null;

  const substituirView = useCallback((atualizada: VendasViewRecord) => {
    setViews((prev) => (prev ?? []).map((v) => (v.id === atualizada.id ? atualizada : v)));
  }, []);

  // Relê só a visualização selecionada (estado de backfill, last_refresh_at).
  const reler = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/vendas/views/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.view) substituirView(data.view as VendasViewRecord);
      } catch {
        // Silencioso: a próxima leitura (poll ou ação da pessoa) tenta de novo.
      }
    },
    [substituirView],
  );

  const coletando = selecionada?.backfill_status === "pending" || selecionada?.backfill_status === "running";
  const selecionadaId = selecionada?.id ?? null;
  useEffect(() => {
    if (!coletando || !selecionadaId) return;
    const timer = setInterval(() => {
      void reler(selecionadaId);
    }, INTERVALO_BACKFILL_MS);
    return () => clearInterval(timer);
  }, [coletando, selecionadaId, reler]);

  const grupos = groupViewsByFolder(views ?? [], folders, selecionada?.id ?? null).map((g) => ({
    ...g,
    isExpanded: pastaAberta[g.id] ?? g.isExpanded,
  }));

  const temViews = Boolean(views && views.length > 0);
  const nomeDoProduto = (view: VendasViewRecord) =>
    products.find((p) => p.product_id === view.product_id)?.product_name ?? view.product_id;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-v2-nevoa">Relatório de vendas</h1>
        <p className="mt-1 text-sm text-v2-nevoa/65">Vendas da Hotmart por produto e oferta.</p>
      </header>

      {canEdit && naoMigrados.length > 0 && (
        <p
          role="status"
          data-testid="vendas-unmigrated-notice"
          title={naoMigrados.map((c) => c.name).join(", ")}
          className="rounded-v2-sm bg-v2-casco px-3 py-2.5 text-sm text-v2-nevoa/75 ring-1 ring-inset ring-v2-azul-luz/15"
        >
          {naoMigrados.length}{" "}
          {naoMigrados.length === 1 ? "ciclo antigo não foi migrado" : "ciclos antigos não foram migrados"} por falta de
          ofertas configuradas.
        </p>
      )}

      {erroDeCarga && (
        <Surface className="flex flex-col items-center gap-3 py-10 text-center" role="alert">
          <p className="text-sm text-v2-queda">Falha ao carregar os dados.</p>
          <Button variante="secundario" onClick={() => setRecarga((t) => t + 1)}>
            Tentar novamente
          </Button>
        </Surface>
      )}

      {!views && !erroDeCarga && (
        <div data-testid="vendas-loading" aria-busy="true" className="grid gap-5 md:grid-cols-[16rem_1fr]">
          <div className="h-40 rounded-v2-md bg-v2-casco" />
          <div className="h-64 rounded-v2-md bg-v2-casco" />
        </div>
      )}

      {views && !temViews && !erroDeCarga && (
        <Surface data-testid="vendas-empty-state" className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-base font-semibold text-v2-nevoa">Nenhuma visualização criada ainda</p>
          <p className="max-w-sm text-sm text-v2-nevoa/65">
            {canEdit
              ? "Crie a primeira visualização para acompanhar a quantidade de vendas de um produto e de suas ofertas."
              : "Assim que alguém criar a primeira visualização, ela aparecerá aqui."}
          </p>
        </Surface>
      )}

      {temViews && selecionada && (
        <div className="grid items-start gap-5 md:grid-cols-[16rem_1fr]">
          <PainelVisualizacoes
            grupos={grupos}
            selecionadaId={selecionada.id}
            onSelecionar={setSelectedId}
            onAlternarPasta={(id) =>
              setPastaAberta((prev) => ({ ...prev, [id]: !grupos.find((g) => g.id === id)?.isExpanded }))
            }
          />

          <Surface data-testid="view-dashboard" className="flex flex-col gap-1">
            <h2 data-testid="view-selected-name" className="text-lg font-bold text-v2-nevoa">
              {selecionada.name}
            </h2>
            <p data-testid="view-product" className="text-sm text-v2-nevoa/65">
              {nomeDoProduto(selecionada)}
            </p>
          </Surface>
        </div>
      )}
    </div>
  );
}
