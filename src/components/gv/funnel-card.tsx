import React from "react";
import { ListCard } from "@/components/gv/list-card";

interface FunnelStep {
  label: string;
  value: number;
  conv: number;
}

interface FunnelCardProps {
  name: string;
  period: string;
  steps: FunnelStep[];
  status: "green" | "amber";
  verdict: string;
  onClick?: () => void;
}

export function FunnelCard({
  name,
  period,
  steps,
  status,
  verdict,
  onClick,
}: FunnelCardProps): React.ReactElement {
  return (
    <ListCard platform="gn" name={name} subtitle={period} status={status} clickable={!!onClick} onClick={onClick}>
      <div className="funnel">
        {steps.map((s, i) => (
          <div key={i} className="fstep">
            <div className="fbar-wrap">
              <div
                className={"fbar" + (s.conv < 30 ? " muted" : "")}
                style={{ width: s.conv + "%" }}
              >
                {s.conv >= 18 ? s.label : ""}
              </div>
            </div>
            <span className="fval">{s.value.toLocaleString("pt-BR")}</span>
            <span className="fconv">{s.conv}%</span>
          </div>
        ))}
      </div>
      <div className="tip">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        {verdict}
      </div>
    </ListCard>
  );
}
