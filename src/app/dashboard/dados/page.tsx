"use client";

import { useEffect, useState, useCallback } from "react";
import { SectionTabs } from "@/components/dashboard/section-tabs";
import { DataTable } from "@/components/ui/data-table";
import { SkeletonTable } from "@/components/ui/skeleton";

type Platform = "youtube" | "instagram" | "hotmart";

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

const PLATFORM_TABS: Platform[] = ["youtube", "instagram", "hotmart"];
const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  hotmart: "Hotmart",
};

function StatusBadge({ status }: { status: "success" | "error" }) {
  const isOk = status === "success";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 500,
        background: isOk ? "#DCFCE7" : "#FEE2E2",
        color: isOk ? "#166534" : "#991B1B",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: isOk ? "#16A34A" : "#DC2626",
        }}
      />
      {isOk ? "Sucesso" : "Erro"}
    </span>
  );
}

const COLUMNS = [
  {
    key: "status" as keyof LogEntry,
    label: "Status",
    render: (value: LogEntry[keyof LogEntry]) => (
      <StatusBadge status={value as "success" | "error"} />
    ),
  },
  {
    key: "account_name" as keyof LogEntry,
    label: "Conta",
    render: (value: LogEntry[keyof LogEntry]) => (value as string | null) ?? "—",
  },
  {
    key: "started_at" as keyof LogEntry,
    label: "Início",
    render: (value: LogEntry[keyof LogEntry]) =>
      value ? new Date(value as string).toLocaleString("pt-BR") : "—",
  },
  {
    key: "duration_s" as keyof LogEntry,
    label: "Duração",
    render: (value: LogEntry[keyof LogEntry]) =>
      value != null ? `${value}s` : "—",
  },
  {
    key: "records_collected" as keyof LogEntry,
    label: "Registros",
    render: (value: LogEntry[keyof LogEntry]) =>
      value != null ? (value as number).toLocaleString("pt-BR") : "—",
  },
  {
    key: "error_message" as keyof LogEntry,
    label: "Erro",
    render: (value: LogEntry[keyof LogEntry]) => {
      const msg = value as string | null;
      if (!msg) return null;
      return (
        <span title={msg} style={{ color: "#DC2626", fontSize: 12 }}>
          {msg.length > 60 ? msg.slice(0, 60) + "…" : msg}
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

  // Batch collection state (Hotmart only)
  const [hotmartAccounts, setHotmartAccounts] = useState<HotmartAccount[]>([]);
  const [batchAccountId, setBatchAccountId] = useState("");
  const [batchStart, setBatchStart] = useState("");
  const [batchEnd, setBatchEnd] = useState("");
  const [batchStatus, setBatchStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [batchResult, setBatchResult] = useState<{ salesRecords: number } | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);

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

  // Load Hotmart accounts when switching to Hotmart tab
  useEffect(() => {
    if (activeTab !== "hotmart") return;
    fetch("/api/accounts?platform=hotmart")
      .then((r) => r.json())
      .then((accs: HotmartAccount[]) => {
        setHotmartAccounts(Array.isArray(accs) ? accs : []);
        if (accs.length > 0 && !batchAccountId) setBatchAccountId(accs[0].id);
      })
      .catch(() => setHotmartAccounts([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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

  async function handleBatchCollect() {
    setBatchStatus("loading");
    setBatchResult(null);
    setBatchError(null);

    try {
      const res = await fetch("/api/hotmart/batch-collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: batchAccountId,
          start_date: batchStart,
          end_date: batchEnd,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setBatchStatus("error");
        setBatchError(json.error ?? "Erro desconhecido");
      } else {
        setBatchStatus("success");
        setBatchResult({ salesRecords: json.salesRecords });
        await fetchLogs(activeTab);
      }
    } catch {
      setBatchStatus("error");
      setBatchError("Falha na comunicação com o servidor");
    }
  }

  const sectionLabels = PLATFORM_TABS.map((p) => PLATFORM_LABELS[p]);
  const activeLabel = PLATFORM_LABELS[activeTab];

  function handleTabSelect(label: string) {
    const platform = PLATFORM_TABS.find((p) => PLATFORM_LABELS[p] === label);
    if (platform) setActiveTab(platform);
  }

  const batchCanSubmit =
    !!batchAccountId && !!batchStart && !!batchEnd && batchStatus !== "loading";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%" }}>
      {/* Header */}
      <div style={{ padding: "24px 32px 16px", borderBottom: "1px solid var(--color-border)" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--color-text)", marginBottom: 4 }}>
          Dados
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
          Histórico de sincronizações e acionamento manual de coletas.
        </p>
      </div>

      {/* Platform tabs */}
      <SectionTabs
        sections={sectionLabels}
        selected={activeLabel}
        onSelect={handleTabSelect}
      />

      {/* Content */}
      <div style={{ flex: 1, padding: "24px 32px", overflow: "auto" }}>
        {/* Action bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              border: "none",
              cursor: syncing ? "not-allowed" : "pointer",
              background: syncing ? "#93C5FD" : "var(--color-primary)",
              color: "#fff",
              transition: "background 0.15s",
            }}
          >
            {syncing ? (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  style={{ animation: "spin 1s linear infinite" }}
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Sincronizando…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Sincronizar {activeLabel} Agora
              </>
            )}
          </button>

          {syncSuccess && !syncError && (
            <span style={{ fontSize: 13, color: "#166534", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Sincronização concluída
            </span>
          )}

          {syncError && (
            <span style={{ fontSize: 13, color: "#DC2626" }}>
              {syncError}
            </span>
          )}
        </div>

        {/* Batch collect section — Hotmart only */}
        {activeTab === "hotmart" && (
          <div
            style={{
              marginBottom: 24,
              padding: "20px 24px",
              borderRadius: 12,
              border: "1px solid var(--color-border)",
              background: "var(--color-bg, #f9fafb)",
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)", marginBottom: 16 }}>
              Coleta em Lote
            </p>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
              {/* Account selector */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 500 }}>
                  Conta
                </label>
                <select
                  value={batchAccountId}
                  onChange={(e) => setBatchAccountId(e.target.value)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--color-border)",
                    fontSize: 14,
                    color: "var(--color-text)",
                    background: "white",
                    minWidth: 200,
                  }}
                >
                  {hotmartAccounts.length === 0 && (
                    <option value="">Nenhuma conta encontrada</option>
                  )}
                  {hotmartAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* Start date */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 500 }}>
                  De
                </label>
                <input
                  type="date"
                  value={batchStart}
                  onChange={(e) => setBatchStart(e.target.value)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--color-border)",
                    fontSize: 14,
                    color: "var(--color-text)",
                    background: "white",
                  }}
                />
              </div>

              {/* End date */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, color: "var(--color-text-muted)", fontWeight: 500 }}>
                  Até
                </label>
                <input
                  type="date"
                  value={batchEnd}
                  onChange={(e) => setBatchEnd(e.target.value)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--color-border)",
                    fontSize: 14,
                    color: "var(--color-text)",
                    background: "white",
                  }}
                />
              </div>

              {/* Submit button */}
              <button
                onClick={handleBatchCollect}
                disabled={!batchCanSubmit}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 18px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  border: "none",
                  cursor: batchCanSubmit ? "pointer" : "not-allowed",
                  background: batchCanSubmit ? "#F97316" : "#FED7AA",
                  color: "#fff",
                  transition: "background 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {batchStatus === "loading" ? (
                  <>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      style={{ animation: "spin 1s linear infinite" }}
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    Coletando…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Iniciar Coleta
                  </>
                )}
              </button>
            </div>

            {/* Batch feedback */}
            {batchStatus === "success" && batchResult && (
              <p style={{ marginTop: 12, fontSize: 13, color: "#166534", display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {batchResult.salesRecords.toLocaleString("pt-BR")} registro{batchResult.salesRecords !== 1 ? "s" : ""} importado{batchResult.salesRecords !== 1 ? "s" : ""}
              </p>
            )}

            {batchStatus === "error" && batchError && (
              <p style={{ marginTop: 12, fontSize: 13, color: "#DC2626" }}>
                {batchError}
              </p>
            )}
          </div>
        )}

        {/* Logs table */}
        {loading ? (
          <SkeletonTable />
        ) : (
          <DataTable<LogEntry>
            data={logs}
            columns={COLUMNS}
          />
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
