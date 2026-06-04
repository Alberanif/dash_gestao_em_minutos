import React from "react";
import { ListCard } from "@/components/gv/list-card";

function MiniSparkline({ data }: { data: number[] }): React.ReactElement {
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
  const gid = `ltv-sg-${data.length}-${(data[0] | 0)}-${(data[data.length - 1] | 0)}`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--bl)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--bl)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gid})`} />
      <path d={lineD} fill="none" stroke="var(--bl)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Status = "green" | "amber";

interface LtvCardProps {
  name: string;
  subtitle: string;
  active: number;
  mrr: number;
  ltv: number;
  churn: number;
  status: Status;
  sparkData?: number[];
}

export function LtvCard({
  name,
  subtitle,
  active,
  mrr,
  ltv,
  churn,
  status,
  sparkData,
}: LtvCardProps): React.ReactElement {
  const churnColor = status === "green" ? "var(--gn)" : "var(--am)";

  return (
    <ListCard platform="vi" name={name} subtitle={subtitle} status={status}>
      <div className="g2 grid" style={{ gap: 8 }}>
        <div className="col">
          <span className="xmuted xsmall">Clientes Ativos</span>
          <span className="mono" style={{ fontSize: 26, fontWeight: 500 }}>
            {active.toLocaleString("pt-BR")}
          </span>
        </div>
        <div className="col">
          <span className="xmuted xsmall">MRR</span>
          <span className="mono" style={{ fontSize: 26, fontWeight: 500 }}>
            R$ {mrr.toLocaleString("pt-BR")}
          </span>
        </div>
        <div className="col">
          <span className="xmuted xsmall">LTV Médio</span>
          <span className="mono" style={{ fontSize: 20, fontWeight: 500 }}>
            R$ {ltv.toLocaleString("pt-BR")}
          </span>
        </div>
        <div className="col">
          <span className="xmuted xsmall">Churn Mensal</span>
          <span className="mono" style={{ fontSize: 20, fontWeight: 500, color: churnColor }}>
            {churn}%
          </span>
        </div>
      </div>
      {sparkData && sparkData.length >= 2 && (
        <MiniSparkline data={sparkData} />
      )}
    </ListCard>
  );
}
