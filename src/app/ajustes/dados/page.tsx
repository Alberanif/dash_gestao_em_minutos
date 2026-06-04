"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SectionTabs } from "@/components/dashboard/section-tabs";
import { DataTable } from "@/components/ui/data-table";
import { SkeletonTable } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";

type Platform = "youtube" | "instagram" | "hotmart" | "meta-ads";

interface LogEntry extends Record<string, unknown> {
  id: string;
  status: "success" | "error";
  account_name: string | null;
  started_at: string;
  finished_at: string | null;
  duration_s: number | null;
  records_collected: number | null;
  error_message: string | null;
}

interface HotmartAccount {
  id: string;
  name: string;
}

const PLATFORM_TABS: Platform[] = ["youtube", "instagram", "hotmart", "meta-ads"];
const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  hotmart: "Hotmart",
  "meta-ads": "Meta Ads",
};

const COLUMNS = [
  { key: "status" as keyof LogEntry, label: "Status", render: (value: LogEntry[keyof LogEntry]) => <StatusBadge tone={(value as "success" | "error") === "success" ? "success" : "error"} /> },
  { key: "account_name" as keyof LogEntry, label: "Conta", render: (value: LogEntry[keyof LogEntry]) => (value as string | null) ?? "—" },
  { key: "started_at" as keyof LogEntry, label: "Início", render: (value: LogEntry[keyof LogEntry]) => value ? new Date(value as string).toLocaleString("pt-BR") : "—" },
  { key: "duration_s" as keyof LogEntry, label: "Duração", render: (value: LogEntry[keyof LogEntry]) => value != null ? `${value}s` : "—" },
  { key: "records_collected" as keyof LogEntry, label: "Registros", render: (value: LogEntry[keyof LogEntry]) => value != null ? (value as number).toLocaleString("pt-BR") : "—" },
  {
    key: "error_message" as keyof LogEntry,
    label: "Erro",
    render: (value: LogEntry[keyof LogEntry]) => {
      const msg = value as string | null;
      if (!msg) return "—";
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span title={msg} style={{ color: "var(--color-danger)" }}>
            {msg.length > 60 ? `${msg.slice(0, 60)}…` : msg}
          </span>
          <button
            type="button"
            title="Copiar mensagem de erro"
            onClick={() => navigator.clipboard.writeText(msg)}
            style={{
              flexShrink: 0,
              background: "none",
              border: "none",
              padding: "2px 4px",
              cursor: "pointer",
              color: "var(--color-text-muted)",
              lineHeight: 1,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6z"/>
              <path d="M2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h-1v1H2V6h1V5H2z"/>
            </svg>
          </button>
        </span>
      );
    },
  },
];

export default function DadosPage() {
  const [activeTab, setActiveTab] = useState<Platform>("youtube");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [hotmartAccounts, setHotmartAccounts] = useState<HotmartAccount[]>([]);
  const [batchAccountId, setBatchAccountId] = useState("");
  const [batchStart, setBatchStart] = useState("");
  const [batchEnd, setBatchEnd] = useState("");
  const [batchStatus, setBatchStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [batchResult, setBatchResult] = useState<{ salesRecords: number } | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchChunks, setBatchChunks] = useState<Array<{
    start: string; end: string;
    status: "pending" | "loading" | "success" | "error";
    records?: number; error?: string;
  }> | null>(null);
  const [batchTotalRecords, setBatchTotalRecords] = useState(0);

  // Hotmart sync products state
  const [syncProductsAccountId, setSyncProductsAccountId] = useState("");
  const [syncProductsStatus, setSyncProductsStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [syncProductsResult, setSyncProductsResult] = useState<{ productsRecords: number; offersRecords: number } | null>(null);
  const [syncProductsError, setSyncProductsError] = useState<string | null>(null);

  // Meta Ads batch collect state
  const [metaAccounts, setMetaAccounts] = useState<HotmartAccount[]>([]);
  const [metaBatchAccountId, setMetaBatchAccountId] = useState("");
  const [metaBatchStart, setMetaBatchStart] = useState("");
  const [metaBatchEnd, setMetaBatchEnd] = useState("");
  const [metaBatchStatus, setMetaBatchStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [metaBatchResult, setMetaBatchResult] = useState<{ dailyRecords: number; campaignDailyRecords: number } | null>(null);
  const [metaBatchError, setMetaBatchError] = useState<string | null>(null);

  // Instagram batch collect state
  const [igAccounts, setIgAccounts] = useState<HotmartAccount[]>([]);
  const [igBatchAccountId, setIgBatchAccountId] = useState("");
  const [igBatchStart, setIgBatchStart] = useState("");
  const [igBatchEnd, setIgBatchEnd] = useState("");
  const [igBatchStatus, setIgBatchStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [igBatchResult, setIgBatchResult] = useState<{ profileRecords: number; mediaRecords: number } | null>(null);
  const [igBatchError, setIgBatchError] = useState<string | null>(null);

  // YouTube batch collect state
  const [youtubeAccounts, setYoutubeAccounts] = useState<HotmartAccount[]>([]);
  const [ytBatchAccountId, setYtBatchAccountId] = useState("");
  const [ytBatchStart, setYtBatchStart] = useState("");
  const [ytBatchEnd, setYtBatchEnd] = useState("");
  const [ytBatchStatus, setYtBatchStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [ytBatchResult, setYtBatchResult] = useState<{ channelRecords: number; videoRecords: number } | null>(null);
  const [ytBatchError, setYtBatchError] = useState<string | null>(null);

  const fetchLogs = useCallback(async (platform: Platform) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/logs?platform=${platform}`);
      const json = await res.json();
      setLogs(json.logs ?? []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSyncError(null);
    setSyncSuccess(false);
    fetchLogs(activeTab);
  }, [activeTab, fetchLogs]);

  useEffect(() => {
    if (activeTab !== "youtube") return;
    fetch("/api/accounts?platform=youtube")
      .then((r) => r.json())
      .then((accs: HotmartAccount[]) => {
        setYoutubeAccounts(Array.isArray(accs) ? accs : []);
        if (accs.length > 0 && !ytBatchAccountId) setYtBatchAccountId(accs[0].id);
      })
      .catch(() => setYoutubeAccounts([]));
  }, [activeTab, ytBatchAccountId]);

  useEffect(() => {
    if (activeTab !== "hotmart") return;
    fetch("/api/accounts?platform=hotmart")
      .then((r) => r.json())
      .then((accs: HotmartAccount[]) => {
        setHotmartAccounts(Array.isArray(accs) ? accs : []);
        if (accs.length > 0 && !batchAccountId) setBatchAccountId(accs[0].id);
        if (accs.length > 0 && !syncProductsAccountId) setSyncProductsAccountId(accs[0].id);
      })
      .catch(() => setHotmartAccounts([]));
  }, [activeTab, batchAccountId, syncProductsAccountId]);

  useEffect(() => {
    if (activeTab !== "meta-ads") return;
    fetch("/api/accounts?platform=meta-ads")
      .then((r) => r.json())
      .then((accs: HotmartAccount[]) => {
        setMetaAccounts(Array.isArray(accs) ? accs : []);
        if (accs.length > 0 && !metaBatchAccountId) setMetaBatchAccountId(accs[0].id);
      })
      .catch(() => setMetaAccounts([]));
  }, [activeTab, metaBatchAccountId]);

  useEffect(() => {
    if (activeTab !== "instagram") return;
    fetch("/api/accounts?platform=instagram")
      .then((r) => r.json())
      .then((accs: HotmartAccount[]) => {
        setIgAccounts(Array.isArray(accs) ? accs : []);
        if (accs.length > 0 && !igBatchAccountId) setIgBatchAccountId(accs[0].id);
      })
      .catch(() => setIgAccounts([]));
  }, [activeTab, igBatchAccountId]);

  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    setSyncSuccess(false);

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: activeTab }),
      });
      const json = await res.json();

      if (!res.ok) {
        setSyncError(json.error ?? "Erro desconhecido ao sincronizar");
      } else {
        setSyncSuccess(true);
        await fetchLogs(activeTab);
      }
    } catch {
      setSyncError("Falha na comunicação com o servidor");
    } finally {
      setSyncing(false);
    }
  }

  function splitIntoMonthlyChunks(start: string, end: string) {
    const chunks: Array<{ start: string; end: string }> = [];
    const cur = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);

    while (cur <= endDate) {
      const chunkStart = cur.toISOString().slice(0, 10);
      const lastOfMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const chunkEnd = lastOfMonth <= endDate
        ? lastOfMonth.toISOString().slice(0, 10)
        : end;
      chunks.push({ start: chunkStart, end: chunkEnd });
      cur.setMonth(cur.getMonth() + 1);
      cur.setDate(1);
    }
    return chunks;
  }

  async function handleBatchCollect() {
    setBatchStatus("loading");
    setBatchResult(null);
    setBatchError(null);
    setBatchTotalRecords(0);

    const chunks = splitIntoMonthlyChunks(batchStart, batchEnd).map((c) => ({
      ...c, status: "pending" as const,
    }));
    setBatchChunks(chunks);

    let total = 0;

    for (let i = 0; i < chunks.length; i++) {
      setBatchChunks((prev) =>
        prev ? prev.map((c, idx) => idx === i ? { ...c, status: "loading" } : c) : prev
      );

      try {
        const res = await fetch("/api/hotmart/batch-collect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account_id: batchAccountId,
            start_date: chunks[i].start,
            end_date: chunks[i].end,
          }),
        });
        const json = await res.json();

        if (!res.ok) {
          setBatchChunks((prev) =>
            prev ? prev.map((c, idx) => idx === i ? { ...c, status: "error", error: json.error ?? "Erro" } : c) : prev
          );
          setBatchStatus("error");
          setBatchError(`Falha no chunk ${chunks[i].start}→${chunks[i].end}: ${json.error ?? "Erro desconhecido"}`);
          return;
        }

        total += json.salesRecords ?? 0;
        setBatchTotalRecords(total);
        setBatchChunks((prev) =>
          prev ? prev.map((c, idx) => idx === i ? { ...c, status: "success", records: json.salesRecords } : c) : prev
        );

        if (i < chunks.length - 1) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      } catch {
        setBatchChunks((prev) =>
          prev ? prev.map((c, idx) => idx === i ? { ...c, status: "error", error: "Falha de rede" } : c) : prev
        );
        setBatchStatus("error");
        setBatchError("Falha na comunicação com o servidor");
        return;
      }
    }

    setBatchStatus("success");
    setBatchResult({ salesRecords: total });
    await fetchLogs(activeTab);
  }

  async function handleYouTubeBatchCollect() {
    setYtBatchStatus("loading");
    setYtBatchResult(null);
    setYtBatchError(null);

    try {
      const res = await fetch("/api/youtube/batch-collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: ytBatchAccountId,
          start_date: ytBatchStart,
          end_date: ytBatchEnd,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setYtBatchStatus("error");
        setYtBatchError(json.error ?? "Erro desconhecido");
      } else {
        setYtBatchStatus("success");
        setYtBatchResult({ channelRecords: json.channelRecords, videoRecords: json.videoRecords });
        await fetchLogs(activeTab);
      }
    } catch {
      setYtBatchStatus("error");
      setYtBatchError("Falha na comunicação com o servidor");
    }
  }

  async function handleMetaBatchCollect() {
    setMetaBatchStatus("loading");
    setMetaBatchResult(null);
    setMetaBatchError(null);

    try {
      const res = await fetch("/api/meta-ads/batch-collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: metaBatchAccountId,
          start_date: metaBatchStart,
          end_date: metaBatchEnd,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setMetaBatchStatus("error");
        setMetaBatchError(json.error ?? "Erro desconhecido");
      } else {
        setMetaBatchStatus("success");
        setMetaBatchResult({ dailyRecords: json.dailyRecords, campaignDailyRecords: json.campaignDailyRecords });
        await fetchLogs(activeTab);
      }
    } catch {
      setMetaBatchStatus("error");
      setMetaBatchError("Falha na comunicação com o servidor");
    }
  }

  async function handleInstagramBatchCollect() {
    setIgBatchStatus("loading");
    setIgBatchResult(null);
    setIgBatchError(null);

    try {
      const res = await fetch("/api/instagram/batch-collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: igBatchAccountId,
          start_date: igBatchStart,
          end_date: igBatchEnd,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setIgBatchStatus("error");
        setIgBatchError(json.error ?? "Erro desconhecido");
      } else {
        setIgBatchStatus("success");
        setIgBatchResult({ profileRecords: json.profileRecords, mediaRecords: json.mediaRecords });
        await fetchLogs(activeTab);
      }
    } catch {
      setIgBatchStatus("error");
      setIgBatchError("Falha na comunicação com o servidor");
    }
  }

  async function handleSyncProducts() {
    setSyncProductsStatus("loading");
    setSyncProductsResult(null);
    setSyncProductsError(null);
    try {
      const res = await fetch("/api/hotmart/sync-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: syncProductsAccountId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSyncProductsStatus("error");
        setSyncProductsError(json.error ?? "Erro desconhecido");
      } else {
        setSyncProductsStatus("success");
        setSyncProductsResult({ productsRecords: json.productsRecords, offersRecords: json.offersRecords });
        await fetchLogs(activeTab);
      }
    } catch {
      setSyncProductsStatus("error");
      setSyncProductsError("Falha na comunicação com o servidor");
    }
  }

  const sectionLabels = PLATFORM_TABS.map((p) => PLATFORM_LABELS[p]);
  const activeLabel = PLATFORM_LABELS[activeTab];
  const batchCanSubmit = !!batchAccountId && !!batchStart && !!batchEnd && batchStatus !== "loading";

  const CHUNK_STATUS_ICON: Record<string, string> = {
    pending: "○",
    loading: "◌",
    success: "●",
    error: "✕",
  };
  const CHUNK_STATUS_COLOR: Record<string, string> = {
    pending: "var(--color-text-muted)",
    loading: "var(--orange)",
    success: "var(--emerald)",
    error: "var(--color-danger)",
  };

  function handleTabSelect(label: string) {
    const platform = PLATFORM_TABS.find((p) => PLATFORM_LABELS[p] === label);
    if (platform) setActiveTab(platform);
  }

  return (
    <div className="min-h-full">
      <PageHeader
        title="Dados & Sincronização"
        subtitle="Histórico de coletas, execução manual e monitoramento por plataforma"
        back="/ajustes"
      />

      <div style={{ padding: "24px" }}>
        <SectionTabs sections={sectionLabels} selected={activeLabel} onSelect={handleTabSelect} />

        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={handleSync} disabled={syncing} className="btn-primary">
              {syncing ? "Sincronizando..." : `Sincronizar ${activeLabel}`}
            </button>
            {syncSuccess ? <StatusBadge tone="success" label="Sincronização concluída" /> : null}
            {syncError ? <StatusBadge tone="error" label={syncError} /> : null}
          </div>

          {activeTab === "youtube" ? (
            <section className="surface-card p-5">
              <div className="mb-4">
                <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>Coleta em lote YouTube</h2>
                <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                  Coleta métricas diárias do canal para um intervalo específico e cria histórico de dados.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[13px] font-medium" style={{ color: "var(--color-text-muted)" }}>Conta</label>
                  <select value={ytBatchAccountId} onChange={(e) => setYtBatchAccountId(e.target.value)} className="field-control">
                    {youtubeAccounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium" style={{ color: "var(--color-text-muted)" }}>Data inicial</label>
                  <input type="date" value={ytBatchStart} onChange={(e) => setYtBatchStart(e.target.value)} className="field-control" />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium" style={{ color: "var(--color-text-muted)" }}>Data final</label>
                  <input type="date" value={ytBatchEnd} onChange={(e) => setYtBatchEnd(e.target.value)} className="field-control" />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleYouTubeBatchCollect}
                    disabled={!ytBatchAccountId || !ytBatchStart || !ytBatchEnd || ytBatchStatus === "loading"}
                    className="btn-primary w-full"
                  >
                    {ytBatchStatus === "loading" ? "Coletando..." : "Executar batch"}
                  </button>
                </div>
              </div>

              {ytBatchStatus === "success" && ytBatchResult ? (
                <div className="mt-4">
                  <StatusBadge tone="success" label={`${ytBatchResult.channelRecords} dias coletados + ${ytBatchResult.videoRecords} vídeos atualizados`} />
                </div>
              ) : null}
              {ytBatchStatus === "error" && ytBatchError ? (
                <div className="mt-4"><StatusBadge tone="error" label={ytBatchError} /></div>
              ) : null}
            </section>
          ) : null}

          {activeTab === "meta-ads" ? (
            <section className="surface-card p-5">
              <div className="mb-4">
                <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>Coleta em lote Meta Ads</h2>
                <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                  Coleta métricas diárias e snapshots de campanhas para um intervalo específico.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[13px] font-medium" style={{ color: "var(--color-text-muted)" }}>Conta</label>
                  <select value={metaBatchAccountId} onChange={(e) => setMetaBatchAccountId(e.target.value)} className="field-control">
                    {metaAccounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium" style={{ color: "var(--color-text-muted)" }}>Data inicial</label>
                  <input type="date" value={metaBatchStart} onChange={(e) => setMetaBatchStart(e.target.value)} className="field-control" />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium" style={{ color: "var(--color-text-muted)" }}>Data final</label>
                  <input type="date" value={metaBatchEnd} onChange={(e) => setMetaBatchEnd(e.target.value)} className="field-control" />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleMetaBatchCollect}
                    disabled={!metaBatchAccountId || !metaBatchStart || !metaBatchEnd || metaBatchStatus === "loading"}
                    className="btn-primary w-full"
                  >
                    {metaBatchStatus === "loading" ? "Coletando..." : "Executar batch"}
                  </button>
                </div>
              </div>

              {metaBatchStatus === "success" && metaBatchResult ? (
                <div className="mt-4">
                  <StatusBadge tone="success" label={`${metaBatchResult.dailyRecords} dias + ${metaBatchResult.campaignDailyRecords} registros de campanha coletados`} />
                </div>
              ) : null}
              {metaBatchStatus === "error" && metaBatchError ? (
                <div className="mt-4"><StatusBadge tone="error" label={metaBatchError} /></div>
              ) : null}
            </section>
          ) : null}

          {activeTab === "instagram" ? (
            <section className="surface-card p-5">
              <div className="mb-4">
                <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>Coleta em lote Instagram</h2>
                <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                  Coleta métricas diárias de insights para um intervalo específico.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[13px] font-medium" style={{ color: "var(--color-text-muted)" }}>Conta</label>
                  <select value={igBatchAccountId} onChange={(e) => setIgBatchAccountId(e.target.value)} className="field-control">
                    {igAccounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium" style={{ color: "var(--color-text-muted)" }}>Data inicial</label>
                  <input type="date" value={igBatchStart} onChange={(e) => setIgBatchStart(e.target.value)} className="field-control" />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium" style={{ color: "var(--color-text-muted)" }}>Data final</label>
                  <input type="date" value={igBatchEnd} onChange={(e) => setIgBatchEnd(e.target.value)} className="field-control" />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleInstagramBatchCollect}
                    disabled={!igBatchAccountId || !igBatchStart || !igBatchEnd || igBatchStatus === "loading"}
                    className="btn-primary w-full"
                  >
                    {igBatchStatus === "loading" ? "Coletando..." : "Executar batch"}
                  </button>
                </div>
              </div>

              {igBatchStatus === "success" && igBatchResult ? (
                <div className="mt-4">
                  <StatusBadge tone="success" label={`${igBatchResult.profileRecords} dias de insights + ${igBatchResult.mediaRecords} mídias coletados`} />
                </div>
              ) : null}
              {igBatchStatus === "error" && igBatchError ? (
                <div className="mt-4"><StatusBadge tone="error" label={igBatchError} /></div>
              ) : null}
            </section>
          ) : null}

          {activeTab === "hotmart" ? (
            <section className="surface-card p-5">
              <div className="mb-4">
                <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>Coleta em lote Hotmart</h2>
                <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                  Dispara o batch collect para um intervalo específico e atualiza os logs após a execução.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[13px] font-medium" style={{ color: "var(--color-text-muted)" }}>Conta</label>
                  <select value={batchAccountId} onChange={(e) => setBatchAccountId(e.target.value)} className="field-control">
                    {hotmartAccounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium" style={{ color: "var(--color-text-muted)" }}>Data inicial</label>
                  <input type="date" value={batchStart} onChange={(e) => { setBatchStart(e.target.value); setBatchChunks(null); setBatchStatus("idle"); }} className="field-control" />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] font-medium" style={{ color: "var(--color-text-muted)" }}>Data final</label>
                  <input type="date" value={batchEnd} onChange={(e) => { setBatchEnd(e.target.value); setBatchChunks(null); setBatchStatus("idle"); }} className="field-control" />
                </div>
                <div className="flex items-end">
                  <button type="button" onClick={handleBatchCollect} disabled={!batchCanSubmit} className="btn-primary w-full">
                    {batchStatus === "loading" ? "Executando..." : "Executar batch"}
                  </button>
                </div>
              </div>

              {batchChunks && batchChunks.length > 0 ? (
                <div className="mt-4" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Progresso — {batchChunks.filter((c) => c.status === "success").length}/{batchChunks.length} lotes
                    {batchStatus === "loading" ? ` · ${batchTotalRecords.toLocaleString("pt-BR")} registros acumulados` : ""}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {batchChunks.map((chunk, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <span style={{ color: CHUNK_STATUS_COLOR[chunk.status], fontFamily: "monospace", minWidth: 14 }}>
                          {CHUNK_STATUS_ICON[chunk.status]}
                        </span>
                        <span style={{ color: "var(--color-text)", fontFamily: "monospace" }}>
                          {chunk.start} → {chunk.end}
                        </span>
                        {chunk.status === "success" && (
                          <span style={{ color: "var(--emerald)", marginLeft: 4 }}>
                            {(chunk.records ?? 0).toLocaleString("pt-BR")} registros
                          </span>
                        )}
                        {chunk.status === "error" && (
                          <span style={{ color: "var(--color-danger)", marginLeft: 4 }}>{chunk.error}</span>
                        )}
                        {chunk.status === "loading" && (
                          <span style={{ color: "var(--orange)", marginLeft: 4 }}>coletando...</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {batchStatus === "success" && batchResult ? (
                <div className="mt-4"><StatusBadge tone="success" label={`${batchResult.salesRecords.toLocaleString("pt-BR")} registros coletados em ${batchChunks?.length ?? 1} lotes`} /></div>
              ) : null}
              {batchStatus === "error" && batchError ? (
                <div className="mt-4"><StatusBadge tone="error" label={batchError} /></div>
              ) : null}
            </section>
          ) : null}

          {activeTab === "hotmart" ? (
            <section className="surface-card p-5">
              <div className="mb-4">
                <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text)" }}>Sincronizar Produtos e Ofertas</h2>
                <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                  Atualiza o catálogo de produtos e ofertas direto da API Hotmart, incluindo produtos sem vendas.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[13px] font-medium" style={{ color: "var(--color-text-muted)" }}>Conta</label>
                  <select value={syncProductsAccountId} onChange={(e) => setSyncProductsAccountId(e.target.value)} className="field-control">
                    {hotmartAccounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleSyncProducts}
                    disabled={!syncProductsAccountId || syncProductsStatus === "loading"}
                    className="btn-primary w-full"
                  >
                    {syncProductsStatus === "loading" ? "Sincronizando..." : "Sincronizar Produtos"}
                  </button>
                </div>
              </div>
              {syncProductsStatus === "success" && syncProductsResult ? (
                <div className="mt-4">
                  <StatusBadge tone="success" label={`${syncProductsResult.productsRecords} produtos e ${syncProductsResult.offersRecords} ofertas sincronizados`} />
                </div>
              ) : null}
              {syncProductsStatus === "error" && syncProductsError ? (
                <div className="mt-4"><StatusBadge tone="error" label={syncProductsError} /></div>
              ) : null}
            </section>
          ) : null}

          {loading ? <SkeletonTable /> : <DataTable<LogEntry> data={logs} columns={COLUMNS} />}
        </div>
      </div>
    </div>
  );
}
