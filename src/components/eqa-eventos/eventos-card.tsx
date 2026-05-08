"use client";

import { useState, useRef, useEffect } from "react";
import type { EqaEventosProject, EqaEventosMetrics } from "@/types/eqa-eventos";

function formatBRL(n: number): string {
  return Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(n);
}

interface EventosCardProps {
  project: EqaEventosProject;
  metrics: EqaEventosMetrics | null;
  loading: boolean;
  onDateChange: (start: string, end: string) => void;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function EventosCard({
  project,
  metrics,
  loading,
  onDateChange,
  onClick,
  onEdit,
  onDelete,
}: EventosCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [localLoading, setLocalLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // localStorage helpers
  const CACHE_KEY = "eqa-eventos-date-range";

  function getCachedDates(): { startDate: string; endDate: string } | null {
    if (typeof window === "undefined") return null;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  function setCachedDates(start: string, end: string): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ startDate: start, endDate: end }));
    } catch {
      // localStorage may be unavailable
    }
  }

  // useEffect to initialize dates from cache or defaults
  useEffect(() => {
    const cached = getCachedDates();
    if (cached?.startDate && cached?.endDate) {
      setStartDate(cached.startDate);
      setEndDate(cached.endDate);
    } else {
      // Set default: today - 7 days
      const end = new Date().toISOString().split("T")[0];
      const start = new Date(new Date().setDate(new Date().getDate() - 7))
        .toISOString()
        .split("T")[0];
      setStartDate(start);
      setEndDate(end);
    }
  }, []);

  // Keep existing click-outside handler for menu
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const leadEventsCount = project.lead_events?.length ?? 0;
  const campaignIdsCount = project.campaign_ids?.length ?? 0;
  const subtitle = `${leadEventsCount} evento${leadEventsCount !== 1 ? "s" : ""} · ${campaignIdsCount} campanha${campaignIdsCount !== 1 ? "s" : ""}`;

  async function handleSearch() {
    if (!startDate || !endDate) {
      setFetchError("Selecione ambas as datas");
      return;
    }

    if (endDate < startDate) {
      setFetchError("Data de fim deve ser posterior à data de início");
      return;
    }

    setFetchError("");
    setCachedDates(startDate, endDate);
    setLocalLoading(true);
    onDateChange(startDate, endDate);
    setLocalLoading(false);
  }

  return (
    <div
      onClick={(e) => {
        // Only toggle on body click, not menu
        if (e.target === e.currentTarget) {
          setExpanded((v) => !v);
        }
      }}
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
        padding: "16px",
        cursor: "pointer",
        transition: "box-shadow 0.15s",
        position: "relative",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.boxShadow = "var(--shadow-md)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.boxShadow = "var(--shadow-card)")
      }
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div style={{ minWidth: 0 }}>
          <p
            className="truncate font-semibold"
            style={{ fontSize: 15, color: "var(--color-text)" }}
          >
            {project.name}
          </p>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
            {subtitle}
          </p>
        </div>

        <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: 6,
              color: "var(--color-text-muted)",
              fontSize: 18,
              lineHeight: 1,
            }}
            title="Opções"
          >
            ⋯
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 4px)",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm)",
                boxShadow: "var(--shadow-md)",
                zIndex: 20,
                minWidth: 120,
                overflow: "hidden",
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onEdit();
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 14px",
                  fontSize: 13,
                  color: "var(--color-text)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--color-bg)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "none")
                }
              >
                Editar
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete();
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 14px",
                  fontSize: 13,
                  color: "var(--color-danger)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--color-bg)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "none")
                }
              >
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          height: 1,
          background: "var(--color-border)",
          margin: "12px 0",
        }}
      />

      {/* Metrics Display Section */}
      {loading && !metrics ? (
        <div
          style={{
            padding: "20px 0",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            ⟳ Carregando métricas...
          </p>
        </div>
      ) : metrics ? (
        <>
          <div
            style={{
              marginBottom: expanded ? 16 : 0,
            }}
          >
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div
                style={{
                  background: "var(--color-bg)",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px 8px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: 10,
                    color: "var(--color-text-muted)",
                    marginBottom: 4,
                  }}
                >
                  Total Leads
                </p>
                <p
                  style={{
                    fontSize: 18,
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
                  padding: "10px 8px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: 10,
                    color: "var(--color-text-muted)",
                    marginBottom: 4,
                  }}
                >
                  CPL
                </p>
                <p
                  style={{
                    fontSize: 18,
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
                  padding: "10px 8px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: 10,
                    color: "var(--color-text-muted)",
                    marginBottom: 4,
                  }}
                >
                  Total Gasto
                </p>
                <p
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--color-text)",
                  }}
                >
                  {metrics.total_spend > 0 ? formatBRL(metrics.total_spend) : "—"}
                </p>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              style={{
                width: "100%",
                padding: "6px 0",
                fontSize: 12,
                color: "var(--color-text-muted)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {expanded ? "↑ Ocultar" : "↓ Expandir"} seletor de datas
            </button>
          </div>

          {/* Date Picker Section (Expanded) */}
          {expanded && (
            <>
              <div
                style={{
                  height: 1,
                  background: "var(--color-border)",
                  margin: "12px 0",
                }}
              />
              <div
                style={{
                  background: "var(--color-bg)",
                  borderRadius: "var(--radius-sm)",
                  padding: "12px",
                  marginTop: 12,
                }}
              >
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 10,
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
                        marginBottom: 4,
                        textTransform: "uppercase",
                      }}
                    >
                      De
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        fontSize: 12,
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--color-border)",
                        background: "var(--color-surface)",
                        color: "var(--color-text)",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 10,
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
                        marginBottom: 4,
                        textTransform: "uppercase",
                      }}
                    >
                      Até
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        fontSize: 12,
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--color-border)",
                        background: "var(--color-surface)",
                        color: "var(--color-text)",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSearch();
                  }}
                  disabled={localLoading}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    fontSize: 12,
                    fontWeight: 600,
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--color-primary)",
                    color: "var(--color-primary-text)",
                    cursor: localLoading ? "not-allowed" : "pointer",
                    outline: "none",
                    opacity: localLoading ? 0.6 : 1,
                  }}
                >
                  {localLoading ? "Buscando..." : "Buscar"}
                </button>
                {fetchError && (
                  <p
                    style={{
                      fontSize: 11,
                      color: "var(--color-error)",
                      marginTop: 6,
                    }}
                  >
                    {fetchError}
                  </p>
                )}
              </div>
            </>
          )}
        </>
      ) : (
        <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          Sem dados no período
        </p>
      )}
    </div>
  );
}
