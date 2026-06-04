import React from "react";

interface GvPageHeaderProps {
  eyebrow?: string;
  title: string;
  sub?: string;
  children?: React.ReactNode;
}

export function GvPageHeader(
  { eyebrow, title, sub, children }: GvPageHeaderProps,
  childrenOverride?: React.ReactNode
): React.ReactElement {
  const slot = childrenOverride ?? children;
  return (
    <div className="page-header">
      <div className="ph-block">
        {eyebrow && <p className="ph-eyebrow">{eyebrow}</p>}
        <h1 className="ph-title">{title}</h1>
        {sub && <p className="ph-sub">{sub}</p>}
      </div>
      {slot && <div>{slot}</div>}
    </div>
  );
}
