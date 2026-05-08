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

  return (
    <div
      onClick={onClick}
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
    </div>
  );
}
