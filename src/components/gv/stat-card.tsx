import React from "react";
import { StatusChip } from "./status-chip";
import { DeltaBadge } from "./delta-badge";

type Status = "green" | "amber" | "red";

interface MiniSparklineProps {
  data: number[];
}

function MiniSparkline({ data }: MiniSparklineProps): React.ReactElement {
  const width = 100;
  const height = 48;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data
    .map((v, i) => `${i * step},${height - ((v - min) / range) * height}`)
    .join(" ");

  return (
    <svg className="kc-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{width:"100%"}}>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  value: string;
  unit?: string;
  delta?: number;
  status: Status;
  foot: string;
  sparkData?: number[];
}

export function StatCard({
  icon,
  title,
  subtitle,
  value,
  unit,
  delta,
  status,
  foot,
  sparkData,
}: StatCardProps): React.ReactElement {
  return (
    <div className={"kc " + status}>
      <div className="kc-chip">
        <StatusChip status={status} />
      </div>
      <div className="kc-head">
        <div className="kc-icon">{icon}</div>
        <div>
          <div className="kc-lbl">{title}</div>
          {subtitle && <div className="kc-sub">{subtitle}</div>}
        </div>
      </div>
      <div>
        <span className="kc-val">
          {value}
          {unit && <span className="unit">{unit}</span>}
        </span>
        {delta !== undefined && <DeltaBadge value={delta} />}
      </div>
      <div className="kc-meta">
        <span className="kc-foot" dangerouslySetInnerHTML={{ __html: foot }} />
      </div>
      {sparkData && sparkData.length >= 2 && <MiniSparkline data={sparkData} />}
    </div>
  );
}
