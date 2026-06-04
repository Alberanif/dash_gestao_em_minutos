import React from "react";
import { ListCard } from "@/components/gv/list-card";

function MiniSparkline({ data, color = "var(--gn)" }: { data: number[]; color?: string }): React.ReactElement {
  const w = 200;
  const h = 34;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i): [number, number] => [
    i * step,
    h - 2 - ((v - min) / range) * (h - 4),
  ]);
  const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const areaD = `${lineD} L${w},${h} L0,${h} Z`;
  const gid = `pc-sg-${data.length}-${(data[0] | 0)}-${(data[data.length - 1] | 0)}`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gid})`} />
      <path d={lineD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const sparkColorMap: Record<Status, string> = {
  green: "var(--gn)",
  amber: "var(--am)",
  red: "var(--rd)",
};

type Status = "green" | "amber" | "red";

interface ProjectCardProps {
  name: string;
  start: string;
  end: string;
  mainMetric: string;
  value: string;
  subMetric: string;
  sub: string;
  status: Status;
  sparkData?: number[];
  href?: string;
  onClick?: () => void;
}

const borderColorMap: Record<Status, string> = {
  green: "rgba(26,185,108,.3)",
  amber: "rgba(217,149,18,.3)",
  red: "rgba(224,66,66,.3)",
};

const statusColorMap: Record<Status, string> = {
  green: "var(--gn)",
  amber: "var(--am)",
  red: "var(--rd)",
};

export function ProjectCard({
  name,
  start,
  end,
  mainMetric,
  value,
  subMetric,
  sub,
  status,
  sparkData,
  href,
  onClick,
}: ProjectCardProps): React.ReactElement {
  const inner = (
    <ListCard
      platform="gn"
      name={name}
      subtitle={start + " → " + end}
      status={status}
      clickable={true}
      borderColor={borderColorMap[status]}
      href={href}
    >
      <div className="g2 grid" style={{ gap: 8 }}>
        <div className="col">
          <span className="xmuted xsmall">{mainMetric}</span>
          <span className="mono" style={{ fontSize: 20, fontWeight: 600 }}>{value}</span>
        </div>
        <div className="col">
          <span className="xmuted xsmall">{subMetric}</span>
          <span className="mono" style={{ fontSize: 20, color: statusColorMap[status] }}>{sub}</span>
        </div>
      </div>
      {sparkData && sparkData.length >= 2 && (
        <MiniSparkline data={sparkData} color={sparkColorMap[status]} />
      )}
    </ListCard>
  );

  if (onClick && !href) {
    return <div onClick={onClick}>{inner}</div>;
  }

  return inner;
}
