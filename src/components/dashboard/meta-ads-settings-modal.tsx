"use client";

import { useState, useEffect } from "react";
import { StatusBadge } from "@/components/ui/status-badge";

interface Account {
  id: string;
  name: string;
}

interface MetaAdsSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
}

export function MetaAdsSettingsModal({
  isOpen,
  onClose,
  accounts,
}: MetaAdsSettingsModalProps) {
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [syncStatus, setSyncStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [syncResult, setSyncResult] = useState<{ campaignsCollected: number } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Handle Escape key to close modal
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Clean up sync state when modal reopens
  useEffect(() => {
    if (isOpen) {
      setSyncError(null);
      setSyncResult(null);
      setSyncStatus("idle");
    }
  }, [isOpen]);

  async function handleCampaignsSyncCollect() {
    if (!selectedAccountId) return;

    setSyncStatus("loading");
    setSyncResult(null);
    setSyncError(null);

    try {
      const res = await fetch("/api/meta-ads/campaigns-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: selectedAccountId }),
      });

      const json = await res.json();

      if (!res.ok) {
        setSyncStatus("error");
        setSyncError(json.error ?? "Erro desconhecido");
      } else {
        setSyncStatus("success");
        setSyncResult({ campaignsCollected: json.campaignsCollected });
      }
    } catch {
      setSyncStatus("error");
      setSyncError("Falha na comunicação com o servidor");
    }
  }

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="surface-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        style={{
          maxWidth: "500px",
          width: "90%",
          padding: "24px",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: "20px" }}>
          <h2 id="modal-title" style={{ fontSize: 18, fontWeight: 600, color: "var(--color-text)", margin: 0 }}>
            Ajustes Meta Ads
          </h2>
          <p id="modal-description" style={{ fontSize: 13, color: "var(--color-text-muted)", margin: "8px 0 0 0" }}>
            Sincronize a lista completa de campanhas ativas da sua conta Meta.
          </p>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label htmlFor="account-select" className="mb-2 block text-[13px] font-medium" style={{ color: "var(--color-text-muted)" }}>
            Conta
          </label>
          <select
            id="account-select"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="field-control"
          >
            <option value="">Selecione uma conta...</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <button
            type="button"
            onClick={handleCampaignsSyncCollect}
            disabled={!selectedAccountId || syncStatus === "loading"}
            className="btn-primary w-full"
          >
            {syncStatus === "loading" ? "Sincronizando..." : "Sincronizar campanhas"}
          </button>
        </div>

        {syncStatus === "success" && syncResult ? (
          <div style={{ marginBottom: "16px" }}>
            <StatusBadge tone="success" label={`${syncResult.campaignsCollected} campanhas sincronizadas`} />
          </div>
        ) : null}

        {syncStatus === "error" && syncError ? (
          <div style={{ marginBottom: "16px" }}>
            <StatusBadge tone="error" label={syncError} />
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
