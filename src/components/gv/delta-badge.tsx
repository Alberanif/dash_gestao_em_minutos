import React from "react";

interface DeltaBadgeProps {
  value: number;
  unit?: string;
}

export function DeltaBadge({ value, unit = "%" }: DeltaBadgeProps): React.ReactElement {
  if (value > 0) {
    return (
      <span className="dbadge up">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <polyline points="18 15 12 9 6 15" />
        </svg>
        {Math.abs(value)}{unit}
      </span>
    );
  }

  if (value < 0) {
    return (
      <span className="dbadge down">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {Math.abs(value)}{unit}
      </span>
    );
  }

  return (
    <span className="dbadge flat">
      {"—"}
    </span>
  );
}
