import React from "react";

type Status = "green" | "amber" | "red";

interface StatusChipProps {
  status: Status;
  label?: string;
}

export function StatusChip({ status, label }: StatusChipProps): React.ReactElement {
  return (
    <span className={"chip " + status}>
      <span className="dot"></span>
      {label}
    </span>
  );
}
