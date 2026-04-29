"use client";

import { useEffect, useState, useRef } from "react";
import type { EqaEventosProject, EqaEventosMetrics } from "@/types/eqa-eventos";

function formatBRL(n: number): string {
  return Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(n);
}

interface EventosDetailModalProps {
  project: EqaEventosProject;
  open: boolean;
  onClose: () => void;
}

const CACHE_KEY = "eqa-eventos-date-range";

interface CachedDateRange {
  startDate: string;
  endDate: string;
}

function getCachedDates(): CachedDateRange | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function setCachedDates(startDate: string, endDate: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ startDate, endDate }));
  } catch {
    // localStorage may be unavailable
  }
}

export function EventosDetailModal({
  project,
  open,
  onClose,
}: EventosDetailModalProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [metrics, setMetrics] = useState<EqaEventosMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const autoFetchRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setFetchError("");
      autoFetchRef.current = false;
      return;
    }

    const cached = getCachedDates();
    if (cached && cached.startDate && cached.endDate) {
      setStartDate(cached.startDate);
      setEndDate(cached.endDate);
      if (!autoFetchRef.current) {
        autoFetchRef.current = true;
      }
    }
  }, [open]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  async function handleFetch(start?: string, end?: string) {
    const start_date = start || startDate;
    const end_date = end || endDate;

    setFetchError("");

    if (!start_date || !end_date) {
      setFetchError("Selecione ambas as datas");
      return;
    }

    if (end_date < start_date) {
      setFetchError("Data de fim deve ser posterior à data de início");
      return;
    }

    setCachedDates(start_date, end_date);

    setLoading(true);
    try {
      const params = new URLSearchParams({
        start_date,
        end_date,
      });
      const res = await fetch(
        `/api/eqa-eventos/${project.id}/metrics?${params}`
      );
      if (!res.ok) {
        const error = await res.json();
        setFetchError(error.error || "Erro ao carregar métricas");
        return;
      }
      const data = await res.json();
      setMetrics(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !startDate || !endDate || !autoFetchRef.current || metrics) return;

    autoFetchRef.current = false;
    handleFetch(startDate, endDate);
  }, [open, startDate, endDate, metrics]);

  if (!open) return null;

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    fontSize: 13,
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-border)",
    background: "var(--color-bg)",
    color: "var(--color-text)",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-text-muted)",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "8px 12px",
    fontSize: 13,
    fontWeight: 600,
    border: "none",
    borderRadius: "var(--radius-sm)",
    background: "var(--color-primary)",
    color: "var(--color-primary-text)",
    cursor: "pointer",
    outline: "none",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          width: "100%",
          maxWidth: 520,
          padding: 24,
          position: "relative",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--color-text-muted)",
            fontSize: 20,
            lineHeight: 1,
            padding: 4,
          }}
          title="Fechar"
        >
          ✕
        </button>

        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--color-text)",
            marginBottom: 20,
            paddingRight: 32,
          }}
        >
          {project.name}
        </h2>

        <div
          style={{
            background: "var(--color-bg)",
            borderRadius: "var(--radius-sm)",
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>De</label>
              <input
                style={inputStyle}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Até</label>
              <input
                style={inputStyle}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <button
            onClick={() => handleFetch()}
            disabled={loading}
            style={{
              ...buttonStyle,
              width: "100%",
              marginTop: 12,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>
          {fetchError && (
            <p
              style={{
                fontSize: 12,
                color: "var(--color-error)",
                marginTop: 8,
              }}
            >
              {fetchError}
            </p>
          )}
        </div>

        {metrics ? (
          <>
            <div
              style={{
                height: 1,
                background: "var(--color-border)",
                marginBottom: 20,
              }}
            />
            <div className="grid grid-cols-3 gap-4">
              <div
                style={{
                  background: "var(--color-bg)",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px 14px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-muted)",
                    marginBottom: 4,
                  }}
                >
                  Total de Leads
                </p>
                <p
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--color-text)",
                  }}
                >
                  {metrics.total_leads}
                </p>
              </div>
              <div
                style={{
                  background: "var(--color-bg)",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px 14px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-muted)",
                    marginBottom: 4,
                  }}
                >
                  CPL
                </p>
                <p
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--color-text)",
                  }}
                >
                  {metrics.cpl ? formatBRL(metrics.cpl) : "—"}
                </p>
              </div>
              <div
                style={{
                  background: "var(--color-bg)",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px 14px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-muted)",
                    marginBottom: 4,
                  }}
                >
                  Total Gasto
                </p>
                <p
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--color-text)",
                  }}
                >
                  {metrics.total_spend > 0 ? formatBRL(metrics.total_spend) : "—"}
                </p>
              </div>
            </div>
          </>
        ) : (
          <p
            style={{
              fontSize: 13,
              color: "var(--color-text-muted)",
              textAlign: "center",
              padding: 20,
              background: "var(--color-bg)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            Selecione um período para ver as métricas
          </p>
        )}
      </div>
    </div>
  );
}
