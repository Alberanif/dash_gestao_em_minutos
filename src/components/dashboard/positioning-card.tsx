"use client";

import { PositioningMiniChart, type MiniChartPoint } from "@/components/dashboard/positioning-mini-chart";

export type PositioningPlatform = "youtube" | "instagram" | "spotify";

interface AccountOption {
  id: string;
  name: string;
}

interface PositioningCardProps {
  platform: PositioningPlatform;
  label: string;
  value: string | number;
  weekDelta: number | null;
  sparklineData: MiniChartPoint[];
  seriesLabel: string;
  loading?: boolean;
  noData?: boolean;
  accounts?: AccountOption[];
  selectedAccountId?: string;
  onAccountChange?: (id: string) => void;
  toggleMode?: "videos" | "shorts";
  onToggleMode?: (mode: "videos" | "shorts") => void;
}

const PLATFORM_CONFIG: Record<
  PositioningPlatform,
  { name: string; color: string; icon: React.ReactNode }
> = {
  youtube: {
    name: "YouTube",
    color: "#FF0000",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
      </svg>
    ),
  },
  instagram: {
    name: "Instagram",
    color: "#E1306C",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
      </svg>
    ),
  },
  spotify: {
    name: "Spotify",
    color: "#1DB954",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
      </svg>
    ),
  },
};

function formatValue(v: string | number): string {
  if (typeof v === "number") {
    return Intl.NumberFormat("pt-BR").format(v);
  }
  return v;
}

function DeltaBadge({ delta }: { delta: number }) {
  const isPositive = delta >= 0;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        background: isPositive ? "#DCFCE7" : "#FEE2E2",
        color: isPositive ? "#16A34A" : "#DC2626",
      }}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="currentColor"
        style={{ transform: isPositive ? "none" : "rotate(180deg)" }}
      >
        <path d="M5 1l4 5H1z" />
      </svg>
      {isPositive ? "+" : ""}
      {delta.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
    </span>
  );
}

export function PositioningCard({
  platform,
  label,
  value,
  weekDelta,
  sparklineData,
  seriesLabel,
  loading = false,
  noData = false,
  accounts = [],
  selectedAccountId = "",
  onAccountChange,
  toggleMode,
  onToggleMode,
}: PositioningCardProps) {
  const { name, color, icon } = PLATFORM_CONFIG[platform];

  if (loading) {
    return (
      <div
        className="flex flex-col rounded-[var(--radius-card)] overflow-hidden"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-card)",
          borderTop: `4px solid ${color}`,
        }}
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded animate-pulse" style={{ background: "var(--color-border)" }} />
              <div className="h-4 w-20 rounded animate-pulse" style={{ background: "var(--color-border)" }} />
            </div>
            <div className="h-7 w-28 rounded animate-pulse" style={{ background: "var(--color-border)" }} />
          </div>
          <div className="h-16 w-full rounded animate-pulse" style={{ background: "var(--color-border)" }} />
          <div className="h-5 w-24 rounded animate-pulse" style={{ background: "var(--color-border)" }} />
          <div className="h-48 w-full rounded animate-pulse" style={{ background: "var(--color-border)" }} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col rounded-[var(--radius-card)] overflow-hidden"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-card)",
        borderTop: `4px solid ${color}`,
      }}
    >
      <div className="flex flex-col gap-4 p-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2" style={{ color }}>
            {icon}
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>{name}</span>
          </div>

          {accounts.length > 1 && onAccountChange ? (
            <select
              value={selectedAccountId}
              onChange={(e) => onAccountChange(e.target.value)}
              className="field-control"
              style={{ fontSize: 12, height: 30, padding: "0 24px 0 8px", minWidth: 0, maxWidth: 140 }}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          ) : accounts.length === 1 ? (
            <span
              className="truncate"
              style={{ fontSize: 12, color: "var(--color-text-muted)", maxWidth: 140 }}
              title={accounts[0].name}
            >
              {accounts[0].name}
            </span>
          ) : null}
        </div>

        {/* Caixa do valor principal */}
        <div
          className="rounded-[var(--radius-sm)] p-4"
          style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}
        >
          {toggleMode !== undefined && onToggleMode ? (
            <div className="mb-3 flex gap-1">
              {(["videos", "shorts"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onToggleMode(mode)}
                  aria-pressed={toggleMode === mode}
                  aria-label={`Mostrar ${mode === "videos" ? "vídeos" : "shorts"}`}
                  className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
                  style={{
                    background: toggleMode === mode ? color : "transparent",
                    color: toggleMode === mode ? "#fff" : "var(--color-text-muted)",
                    border: `1px solid ${toggleMode === mode ? color : "var(--color-border)"}`,
                    cursor: "pointer",
                  }}
                >
                  {mode === "videos" ? "Vídeos" : "Shorts"}
                </button>
              ))}
            </div>
          ) : null}
          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)", marginBottom: 6 }}>
            {label}
          </p>
          <p
            className="tabular-nums"
            style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.1, color: "var(--color-text)" }}
          >
            {formatValue(value)}
          </p>
        </div>

        {/* Comparativo semanal */}
        <div className="flex items-center gap-2">
          {weekDelta !== null ? (
            <>
              <DeltaBadge delta={weekDelta} />
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                vs semana anterior
              </span>
            </>
          ) : (
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              {noData ? "Sem dados disponíveis" : "Comparativo indisponível"}
            </span>
          )}
        </div>

        {/* Gráfico de série temporal */}
        <div
          className="rounded-[var(--radius-sm)] p-3"
          style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}
        >
          {noData ? (
            <div
              className="flex items-center justify-center"
              style={{ height: 160, fontSize: 12, color: "var(--color-text-muted)" }}
            >
              —
            </div>
          ) : (
            <PositioningMiniChart
              data={sparklineData}
              color={color}
              seriesLabel={seriesLabel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
