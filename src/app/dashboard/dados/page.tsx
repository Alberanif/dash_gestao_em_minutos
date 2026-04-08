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

  const sectionLabels = PLATFORM_TABS.map((p) => PLATFORM_LABELS[p]);
  const activeLabel = PLATFORM_LABELS[activeTab];

  function handleTabSelect(label: string) {
    const platform = PLATFORM_TABS.find((p) => PLATFORM_LABELS[p] === label);
    if (platform) setActiveTab(platform);
  }

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
