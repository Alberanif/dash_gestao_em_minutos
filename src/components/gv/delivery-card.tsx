import React from "react";
import { ListCard } from "@/components/gv/list-card";

type Status = "green" | "amber" | "red";

interface DeliveryCardProps {
  name: string;
  period: string;
  expected: number;
  delivered: number;
  score: number;
  status: Status;
}

function statusColor(status: Status): string {
  if (status === "green") return "var(--gn)";
  if (status === "amber") return "var(--am)";
  return "var(--rd)";
}

export function DeliveryCard({
  name,
  period,
  expected,
  delivered,
  score,
  status,
}: DeliveryCardProps): React.ReactElement {
  const pct = Math.min(100, Math.round((delivered / expected) * 100));
  const color = statusColor(status);

  return (
    <ListCard platform="bl" name={name} subtitle={period} status={status}>
      <div className="row" style={{ gap: 16, alignItems: "flex-start" }}>
        <div className="col" style={{ flex: 1 }}>
          <span className="xmuted xsmall">Entregas</span>
          <span className="mono" style={{ fontSize: 20, fontWeight: 600 }}>
            {delivered} / {expected}
          </span>
          <div className="sbar" style={{ margin: "6px 0" }}>
            <span style={{ width: pct + "%", background: color }}></span>
          </div>
          <span className="xmuted xsmall">{pct}% concluído</span>
        </div>
        <div className="col" style={{ alignItems: "flex-end" }}>
          <span className="xmuted xsmall">Qualidade</span>
          <span className="mono" style={{ fontSize: 28, fontWeight: 600, color }}>
            {score}
          </span>
        </div>
      </div>
    </ListCard>
  );
}
