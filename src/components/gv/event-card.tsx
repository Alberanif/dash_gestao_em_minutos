import React from "react";
import { ListCard } from "@/components/gv/list-card";

interface EventCardProps {
  name: string;
  date: string;
  presence: number;
  conv: number;
  target: number;
  status: "green" | "amber";
}

export function EventCard({
  name,
  date,
  presence,
  conv,
  target,
  status,
}: EventCardProps): React.ReactElement {
  const convAchieved = conv >= target;
  const statusColor = status === "green" ? "var(--gn)" : "var(--am)";

  return (
    <ListCard platform="bl" name={name} subtitle={date} status={status}>
      <div className="g2 grid" style={{ gap: 16 }}>
        <div className="col">
          <span className="xmuted xsmall">Presença</span>
          <span className="mono" style={{ fontSize: 22, fontWeight: 600 }}>
            {presence}%
          </span>
          <div className="sbar">
            <span
              style={{ width: presence + "%", background: statusColor }}
            ></span>
          </div>
        </div>
        <div className="col">
          <span className="xmuted xsmall">
            Conversão vs Meta ({target}%)
          </span>
          <span
            className="mono"
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: convAchieved ? "var(--gn)" : "var(--rd)",
            }}
          >
            {conv}%
          </span>
          <div className="sbar">
            <span
              style={{
                width: Math.min(100, (conv / target) * 100) + "%",
                background: convAchieved ? "var(--gn)" : "var(--rd)",
              }}
            ></span>
          </div>
        </div>
      </div>
    </ListCard>
  );
}
