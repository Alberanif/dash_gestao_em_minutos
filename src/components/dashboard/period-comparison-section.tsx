"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PeriodCard } from "@/components/dashboard/period-card";
import type { MiniChartPoint } from "@/components/dashboard/positioning-mini-chart";

export interface PeriodData {
  label: string;
  value: number;
  sparklineData: MiniChartPoint[];
}

interface AccountOption {
  id: string;
  name: string;
}

interface PeriodComparisonSectionProps {
  platformName: string;
  platformColor: string;
  platformIcon: ReactNode;
  exploreHref: string;
  metricLabel: string;
  currentPeriod: PeriodData;
  previousPeriod: PeriodData;
  loading?: boolean;
  accounts?: AccountOption[];
  selectedAccountId?: string;
  onAccountChange?: (id: string) => void;
}

export function PeriodComparisonSection({
  platformName,
  platformColor,
  platformIcon,
  exploreHref,
  metricLabel,
  currentPeriod,
  previousPeriod,
  loading = false,
  accounts = [],
  selectedAccountId = "",
  onAccountChange,
}: PeriodComparisonSectionProps) {
  const currentVariant =
    currentPeriod.value > previousPeriod.value ? "positive" :
    currentPeriod.value < previousPeriod.value ? "negative" : "neutral";
  const previousVariant =
    previousPeriod.value > currentPeriod.value ? "positive" :
    previousPeriod.value < currentPeriod.value ? "negative" : "neutral";

  if (loading) {
    return (
      <div
        className="flex flex-col overflow-hidden rounded-[var(--radius-card)]"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "var(--shadow-card)",
          borderTop: `4px solid ${platformColor}`,
        }}
      >
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded animate-pulse" style={{ background: "var(--color-border)" }} />
              <div className="h-4 w-20 rounded animate-pulse" style={{ background: "var(--color-border)" }} />
            </div>
            <div className="h-4 w-16 rounded animate-pulse" style={{ background: "var(--color-border)" }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="flex flex-col gap-3 p-4 rounded-[var(--radius-sm)]"
                style={{ border: "1px solid var(--color-border)" }}
              >
                <div className="h-3 w-24 rounded animate-pulse" style={{ background: "var(--color-border)" }} />
                <div className="h-10 w-32 rounded animate-pulse" style={{ background: "var(--color-border)" }} />
                <div className="h-40 w-full rounded animate-pulse" style={{ background: "var(--color-border)" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col overflow-hidden rounded-[var(--radius-card)]"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-card)",
        borderTop: `4px solid ${platformColor}`,
      }}
    >
      <div className="flex flex-col gap-4 p-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2" style={{ color: platformColor }}>
            {platformIcon}
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text)" }}>
              {platformName}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {accounts.length > 1 && onAccountChange ? (
              <select
                value={selectedAccountId}
                onChange={(e) => onAccountChange(e.target.value)}
                className="field-control"
                style={{ fontSize: 12, height: 30, padding: "0 24px 0 8px", minWidth: 0, maxWidth: 140 }}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
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

            <Link
              href={exploreHref}
              className="inline-flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: platformColor }}
            >
              Explorar
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Period cards */}
        <div className="grid grid-cols-2 gap-4">
          <PeriodCard
            periodLabel={previousPeriod.label}
            value={previousPeriod.value}
            metricLabel={metricLabel}
            sparklineData={previousPeriod.sparklineData}
            variant={previousVariant}
          />
          <PeriodCard
            periodLabel={currentPeriod.label}
            value={currentPeriod.value}
            metricLabel={metricLabel}
            sparklineData={currentPeriod.sparklineData}
            variant={currentVariant}
          />
        </div>
      </div>
    </div>
  );
}
