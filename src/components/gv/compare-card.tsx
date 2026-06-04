import React from "react";
import { StatusChip } from "@/components/gv/status-chip";
import { DeltaBadge } from "@/components/gv/delta-badge";

type Status = "green" | "amber" | "red";
type Platform = "yt" | "ig";

interface CompareCardProps {
  platform: Platform;
  name: string;
  metric: string;
  prevLabel: string;
  currLabel: string;
  prevValue: number;
  currValue: number;
  prevSpark?: number[];
  currSpark?: number[];
  status: Status;
  verdict: string;
}

const CURR_LABEL: Record<Status, string> = {
  green: "CRESCENDO",
  amber: "ESTÁVEL",
  red: "CAINDO",
};

const STATUS_LABEL: Record<Status, string> = {
  green: "Verde",
  amber: "Atenção",
  red: "Crítico",
};

const SPARK_COLOR: Record<Status, string> = {
  green: "var(--gn)",
  amber: "var(--am)",
  red: "var(--rd)",
};

function YtIcon(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
    </svg>
  );
}

function IgIcon(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

function VerdictIcon({ status }: { status: Status }): React.ReactElement {
  if (status === "green") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (status === "amber") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function MiniSparkline({ data, color }: { data: number[]; color: string }): React.ReactElement {
  const w = 110;
  const h = 52;
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
  const gid = `cc-sg-${color.replace(/[^a-z]/g, "")}-${data.length}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="cc-spark" style={{width:"100%",height:`${h}px`}}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gid})`} />
      <path d={lineD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CompareCard({
  platform,
  name,
  metric,
  prevLabel,
  currLabel,
  prevValue,
  currValue,
  prevSpark,
  currSpark,
  status,
  verdict,
}: CompareCardProps): React.ReactElement {
  const pct = prevValue > 0 ? ((currValue - prevValue) / prevValue) * 100 : 0;
  const pctRounded = Math.round(pct * 10) / 10;

  return (
    <div className={"cc " + status}>
      <div className="cc-head">
        <div className={"cc-plat " + platform}>
          {platform === "yt" ? <YtIcon /> : <IgIcon />}
        </div>
        <h3>{name}</h3>
        <span className="cc-metric">{metric}</span>
        <StatusChip status={status} label={STATUS_LABEL[status]} />
      </div>
      <div className="cc-body">
        <div className="cc-side">
          <span className="cc-tag prev">ANTERIOR</span>
          <div className="cc-period">{prevLabel}</div>
          <div className="cc-num">{prevValue.toLocaleString("pt-BR")}</div>
          {prevSpark && prevSpark.length > 1 && (
            <MiniSparkline data={prevSpark} color="var(--t2)" />
          )}
        </div>
        <div className="cc-side">
          <span className={"cc-tag curr " + status}>{CURR_LABEL[status]}</span>
          <div className="cc-period">{currLabel}</div>
          <div className="cc-num">{currValue.toLocaleString("pt-BR")}</div>
          {currSpark && currSpark.length > 1 && (
            <MiniSparkline data={currSpark} color={SPARK_COLOR[status]} />
          )}
        </div>
      </div>
      <div className="cc-footer">
        <div className={"cc-verdict " + status}>
          <VerdictIcon status={status} />
          <span dangerouslySetInnerHTML={{ __html: verdict }} />
        </div>
        <div className="cc-ft-r">
          <DeltaBadge value={pctRounded} />
        </div>
      </div>
    </div>
  );
}
