import React from "react";
import { ListCard } from "@/components/gv/list-card";
import { StatusChip } from "@/components/gv/status-chip";

type Platform = "yt" | "ig";
type Status = "green" | "amber" | "red";

interface HealthRow {
  label: string;
  help: string;
  value: string;
  status: Status;
}

interface HealthCardProps {
  platform: Platform;
  name: string;
  score: number;
  status: Status;
  headline: string;
  rows: HealthRow[];
}

const strokeColor: Record<Status, string> = {
  green: "var(--gn)",
  amber: "var(--am)",
  red: "var(--rd)",
};

const rowColor: Record<Status, string> = {
  green: "var(--gn)",
  amber: "var(--am)",
  red: "var(--rd)",
};

export function HealthCard({
  platform,
  name,
  score,
  status,
  headline,
  rows,
}: HealthCardProps): React.ReactElement {
  const C = 2 * Math.PI * 38;
  const dashoffset = C - (score / 100) * C;

  return (
    <ListCard platform={platform} name={name} status={status}>
      <div className="row" style={{ gap: 16, alignItems: "flex-start" }}>
        <div className="ring">
          <svg viewBox="0 0 84 84">
            <circle cx="42" cy="42" r="38" fill="none" stroke="var(--br)" strokeWidth="6" />
            <circle
              cx="42"
              cy="42"
              r="38"
              fill="none"
              stroke={strokeColor[status]}
              strokeWidth="6"
              strokeDasharray={C}
              strokeDashoffset={dashoffset}
              strokeLinecap="round"
              style={{ transform: "rotate(-90deg)", transformOrigin: "42px 42px" }}
            />
          </svg>
          <div className="ring-txt">
            <span>{score}</span>
            <span style={{ fontSize: 10, color: "var(--t3)" }}>/100</span>
          </div>
        </div>
        <div className="col" style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--tx)" }}>{headline}</p>
        </div>
      </div>
      {rows.map((row, i) => (
        <div key={i} className="h-row">
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: rowColor[row.status],
            }}
          ></div>
          <div className="h-lbl">
            {row.label}
            <small>{row.help}</small>
          </div>
          <div className="h-num">{row.value}</div>
          <StatusChip status={row.status} />
        </div>
      ))}
    </ListCard>
  );
}
