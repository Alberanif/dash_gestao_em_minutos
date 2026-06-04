"use client";
import React, { useEffect, useCallback, useState } from "react";
import type { Funnel, FunnelMetrics } from "@/types/funnels";
import { FunnelFormContent } from "@/components/eqa/funnel-form-content";

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function MetricRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="fd-row">
      <div className="fd-row-left">
        <span className="fd-lbl">{label}</span>
        {sub && <span className="fd-sub">{sub}</span>}
      </div>
      <span className="fd-val">{value}</span>
    </div>
  );
}

interface FunnelDetailDrawerProps {
  funnel: Funnel | null;
  metrics: FunnelMetrics | null;
  period: string;
  status: "green" | "amber";
  steps: Array<{ label: string; value: number; conv: number }>;
  verdict: string;
  onClose: () => void;
  onSave?: (data: Omit<Funnel, "id" | "created_at" | "updated_at">) => Promise<void>;
  onDelete?: () => void;
}

export function FunnelDetailDrawer({
  funnel,
  metrics,
  period,
  status,
  steps,
  verdict,
  onClose,
  onSave,
  onDelete,
}: FunnelDetailDrawerProps): React.ReactElement {
  const isOpen = funnel !== null;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) {
      setConfirmDelete(false);
      setIsEditing(false);
      return;
    }
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  const mPago = metrics?.type === "lancamento_pago" ? metrics : null;
  const mLanc = metrics?.type === "lancamento" ? metrics : null;

  const fmtPace = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <>
      <div
        className={"fd-overlay" + (isOpen ? " open" : "")}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={"fd-panel" + (isOpen ? " open" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={funnel?.name ?? "Detalhe do funil"}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="fd-head">
          <div className="fd-head-info">
            <div className="fd-head-name">{funnel?.name ?? ""}</div>
            <div className="fd-head-per">{period}</div>
          </div>
          <div className="fd-head-right">
            <span className={`chip ${status}`}>
              <span className="dot" />
              {status === "green" ? "Verde" : "Atenção"}
            </span>
            {onSave && !isEditing && (
              <button
                className="icon-btn"
                onClick={() => setIsEditing(true)}
                aria-label="Editar funil"
                title="Editar"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                className="icon-btn"
                onClick={() => setConfirmDelete(true)}
                aria-label="Excluir funil"
                title="Excluir"
                style={{ color: "var(--color-danger, #e53e3e)" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            )}
            <button className="icon-btn" onClick={onClose} aria-label="Fechar">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Confirmação de exclusão ─────────────────────────── */}
        {confirmDelete && (
          <div style={{
            margin: "0 0 0 0",
            padding: "14px 20px",
            background: "var(--color-danger-light, #fff5f5)",
            borderBottom: "1px solid var(--color-danger, #e53e3e)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}>
            <p style={{ fontSize: 13, color: "var(--color-danger, #e53e3e)", fontWeight: 600, margin: 0 }}>
              Excluir este funil?
            </p>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>
              Esta ação não pode ser desfeita. Toda a configuração será perdida.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { onDelete?.(); setConfirmDelete(false); }}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: "var(--color-danger, #e53e3e)",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Excluir
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--color-text)",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="fd-body">

          {/* Formulário inline de edição */}
          {isEditing && funnel && onSave && (
            <FunnelFormContent
              funnel={funnel}
              onSave={async (data) => { await onSave(data); setIsEditing(false); }}
              onCancel={() => setIsEditing(false)}
            />
          )}

          {/* Detalhe de métricas */}
          {!isEditing && <>

          {/* Funil */}
          <div className="fd-section-lbl">Funil</div>
          <div className="funnel">
            {steps.map((s, i) => (
              <div key={i} className="fstep">
                <div className="fbar-wrap">
                  <div
                    className={"fbar" + (s.conv < 30 ? " muted" : "")}
                    style={{ width: s.conv + "%" }}
                  >
                    {s.conv >= 18 ? s.label : ""}
                  </div>
                </div>
                <span className="fval">{s.value.toLocaleString("pt-BR")}</span>
                <span className="fconv">{s.conv}%</span>
              </div>
            ))}
          </div>
          <div className="tip">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {verdict}
          </div>

          {/* Financeiro */}
          <div className="fd-section-lbl">Financeiro</div>
          <div className="fd-group">
            {mPago && (
              <>
                <MetricRow label="Receita total" value={fmtBRL(mPago.total_sales_brl)} />
                <MetricRow label="Gasto em anúncios" value={fmtBRL(mPago.total_spend)} />
                <MetricRow
                  label="CAC"
                  value={mPago.cac > 0 ? fmtBRL(mPago.cac) : "—"}
                  sub="custo por aquisição"
                />
              </>
            )}
            {mLanc && (
              <>
                <MetricRow label="Gasto em anúncios" value={fmtBRL(mLanc.total_spend)} />
                <MetricRow
                  label="CPL"
                  value={mLanc.cpl > 0 ? fmtBRL(mLanc.cpl) : "—"}
                  sub="custo por lead"
                />
              </>
            )}
            {!metrics && (
              <div className="fd-row">
                <span className="xmuted" style={{ fontSize: 14 }}>
                  Sem dados financeiros
                </span>
              </div>
            )}
          </div>

          {/* Ritmo */}
          <div className="fd-section-lbl">Ritmo</div>
          <div className="fd-group">
            {mPago && (
              <>
                <MetricRow
                  label="Pace diário"
                  value={fmtPace(mPago.pace_diario)}
                  sub="vendas/dia"
                />
                <MetricRow
                  label="Pace ideal"
                  value={fmtPace(mPago.pace_ideal)}
                  sub="vendas/dia"
                />
                <MetricRow
                  label="Restantes para meta"
                  value={mPago.sales_remaining.toLocaleString("pt-BR")}
                  sub="vendas"
                />
              </>
            )}
            {mLanc && (
              <>
                <MetricRow
                  label="Pace diário"
                  value={fmtPace(mLanc.pace_diario_leads)}
                  sub="leads/dia"
                />
                <MetricRow
                  label="Pace ideal"
                  value={fmtPace(mLanc.pace_ideal_leads)}
                  sub="leads/dia"
                />
                <MetricRow
                  label="Restantes para meta"
                  value={mLanc.leads_remaining.toLocaleString("pt-BR")}
                  sub="leads"
                />
              </>
            )}
            {!metrics && (
              <div className="fd-row">
                <span className="xmuted" style={{ fontSize: 14 }}>
                  Sem dados de ritmo
                </span>
              </div>
            )}
          </div>

          </>}
        </div>
      </div>
    </>
  );
}
