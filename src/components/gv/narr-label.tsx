import React from "react";

interface NarrLabelProps {
  step: string;
  label: string;
  desc?: string;
}

export function NarrLabel({ step, label, desc }: NarrLabelProps): React.ReactElement {
  return (
    <div className="narr">
      <span className="ns">{step}</span>
      <span className="nl">{label}</span>
      {desc && (
        <>
          <span className="nd"></span>
          <span className="ndesc">{desc}</span>
        </>
      )}
    </div>
  );
}
