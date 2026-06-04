import React from "react";

type StatusColor = "green" | "amber" | "red";
type ChipStatus = "green" | "amber" | "red" | "muted";

interface Chip {
  label: string;
  status: ChipStatus;
}

interface PulseBannerProps {
  status: StatusColor;
  headline: string;
  sub: string;
  chips: Chip[];
}

const colorMap: Record<StatusColor, string> = {
  green: "var(--gn)",
  amber: "var(--am)",
  red: "var(--rd)",
};

const bgMap: Record<StatusColor, string> = {
  green: "rgba(26,185,108,.1)",
  amber: "rgba(217,149,18,.1)",
  red: "rgba(224,66,66,.1)",
};

function GreenIcon(): React.ReactElement {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function AmberIcon(): React.ReactElement {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function RedIcon(): React.ReactElement {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

const iconMap: Record<StatusColor, React.ReactElement> = {
  green: <GreenIcon />,
  amber: <AmberIcon />,
  red: <RedIcon />,
};

export function PulseBanner({ status, headline, sub, chips }: PulseBannerProps): React.ReactElement {
  return (
    <div
      className="pulse"
      style={{ "--pc": colorMap[status], "--pb": bgMap[status] } as React.CSSProperties}
    >
      <div className="pulse-icon">{iconMap[status]}</div>
      <div className="pulse-txt">
        <p className="pulse-h">{headline}</p>
        <p className="pulse-s">{sub}</p>
      </div>
      <div className="pulse-sum">
        {chips.map((c, i) => (
          <span key={i} className={"pchip " + c.status}>
            <span className="dot"></span>
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
