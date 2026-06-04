import React from "react";

const SEVERITY_CLASS: Record<"critical" | "attention" | "ok", string> = {
  critical: "red",
  attention: "amber",
  ok: "green",
};

interface CockpitTileProps {
  severity: "critical" | "attention" | "ok";
  label: string;
  value: string;
  description: string;
  owner?: string;
  actionLabel?: string;
  actionHref?: string;
}

export function CockpitTile({
  severity,
  label,
  value,
  description,
  owner,
  actionLabel,
  actionHref,
}: CockpitTileProps): React.ReactElement {
  const severityClass = SEVERITY_CLASS[severity];
  const showFooter = Boolean(owner && actionLabel && actionHref);

  return (
    <div className={"ctile " + severityClass}>
      <h4>{label}</h4>
      <div className="big">{value}</div>
      <p className="xmuted small">{description}</p>
      {showFooter && (
        <div className="crow">
          <b>{owner}</b>
          <a href={actionHref} className="expl">{actionLabel}</a>
        </div>
      )}
    </div>
  );
}
