"use client";

import React from "react";
import type { PresetKey } from "@/lib/utils/period-presets";

const PRESETS: [PresetKey, string][] = [
  ["7d", "7d"],
  ["28d", "28d"],
  ["90d", "90d"],
  ["mes-atual", "Mês Atual"],
  ["mes-anterior", "Mês Ant."],
];

interface GvDateControlsProps {
  startDate: string;
  endDate: string;
  activePreset: PresetKey | null;
  onPreset: (key: PresetKey) => void;
  onStartDate: (v: string) => void;
  onEndDate: (v: string) => void;
}

export function GvDateControls({
  startDate,
  endDate,
  activePreset,
  onPreset,
  onStartDate,
  onEndDate,
}: GvDateControlsProps): React.ReactElement {
  return (
    <div className="per">
      <div className="pset">
        {PRESETS.map(([key, label]) => (
          <button
            key={key}
            className={"pb" + (activePreset === key ? " on" : "")}
            onClick={() => onPreset(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="dp">
        <input
          className="di"
          type="date"
          value={startDate}
          onChange={(e) => onStartDate(e.target.value)}
        />
        <span className="ds">até</span>
        <input
          className="di"
          type="date"
          value={endDate}
          onChange={(e) => onEndDate(e.target.value)}
        />
      </div>
    </div>
  );
}
