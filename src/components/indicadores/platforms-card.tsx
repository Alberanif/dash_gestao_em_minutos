"use client";

import { useState } from "react";
import { MetaAdsPanel } from "./meta-ads-card";
import { HotmartPanel } from "./hotmart-card";
import type { GlobalMetrics, GlobalHotmartMetrics, DailyPoint } from "@/types/indicadores";

interface SectionState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

type Platform = "meta" | "hotmart";

interface PlatformsCardProps {
  metaState: SectionState<GlobalMetrics>;
  hotmartState: SectionState<GlobalHotmartMetrics>;
  dailyState: SectionState<DailyPoint[]>;
  accountId?: string;
  selectedProductId?: string | null;
  onOfferCodeChange?: (offerCode: string | null, productId: string | null) => void;
  hasMetaFilter?: boolean;
  hasHotmartFilter?: boolean;
}

interface TabProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  iconColor: string;
  iconBg: string;
  iconBorder: string;
  label: string;
}

function Tab({ active, onClick, icon, iconColor, iconBg, iconBorder, label }: TabProps) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      style={{
        border: active ? "1px solid var(--border-vis)" : "1px solid transparent",
        borderBottom: `1px solid ${active ? "var(--surface-2)" : "transparent"}`,
        background: active ? "var(--surface-2)" : "transparent",
        marginBottom: -1,
        borderRadius: "8px 8px 0 0",
        padding: "9px 16px",
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 600,
        color: active ? "var(--text-strong)" : "var(--text-3)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          background: iconBg,
          border: `1px solid ${iconBorder}`,
          borderRadius: 5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: iconColor,
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      {label}
    </button>
  );
}

export function PlatformsCard({
  metaState,
  hotmartState,
  dailyState,
  accountId,
  selectedProductId,
  onOfferCodeChange,
  hasMetaFilter = true,
  hasHotmartFilter = true,
}: PlatformsCardProps) {
  const [activePlatform, setActivePlatform] = useState<Platform>("meta");

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-vis)",
        borderRadius: 11,
        overflow: "hidden",
      }}
    >
      {/* Tab bar */}
      <div role="tablist" style={{ display: "flex", gap: 2, padding: "12px 16px 0" }}>
        <Tab
          active={activePlatform === "meta"}
          onClick={() => setActivePlatform("meta")}
          icon="M"
          iconColor="var(--link)"
          iconBg="rgba(76,141,255,0.12)"
          iconBorder="rgba(76,141,255,0.22)"
          label="Meta Ads"
        />
        <Tab
          active={activePlatform === "hotmart"}
          onClick={() => setActivePlatform("hotmart")}
          icon="H"
          iconColor="var(--orange)"
          iconBg="rgba(232,133,63,0.12)"
          iconBorder="rgba(232,133,63,0.22)"
          label="Hotmart"
        />
      </div>
      <div style={{ borderTop: "1px solid var(--border-vis)" }}>
        {activePlatform === "meta" ? (
          <MetaAdsPanel metaState={metaState} dailyState={dailyState} hasMetaFilter={hasMetaFilter} />
        ) : (
          <HotmartPanel
            hotmartState={hotmartState}
            dailyState={dailyState}
            accountId={accountId}
            selectedProductId={selectedProductId}
            onOfferCodeChange={onOfferCodeChange}
            hasHotmartFilter={hasHotmartFilter}
          />
        )}
      </div>
    </div>
  );
}
