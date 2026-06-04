import React from "react";
import Link from "next/link";
import { StatusChip } from "@/components/gv/status-chip";

type Platform = "yt" | "ig" | "am" | "gn" | "bl" | "vi";
type Status = "green" | "amber" | "red";

const STATUS_LABEL: Record<Status, string> = {
  green: "Verde",
  amber: "Atenção",
  red: "Crítico",
};

interface ListCardProps {
  platform?: Platform;
  name: string;
  subtitle?: string;
  status?: Status;
  borderColor?: string;
  clickable?: boolean;
  children?: React.ReactNode;
  href?: string;
  onClick?: () => void;
}

function YtIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" />
    </svg>
  );
}

function IgIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

function ActivityIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 8-6-16-3 8H2" />
    </svg>
  );
}

function BarChartIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function LayersIcon(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

const PLATFORM_ICONS: Record<Platform, React.ReactElement> = {
  yt: <YtIcon />,
  ig: <IgIcon />,
  am: <ActivityIcon />,
  gn: <ActivityIcon />,
  bl: <BarChartIcon />,
  vi: <BarChartIcon />,
};

export function ListCard({
  platform,
  name,
  subtitle,
  status,
  borderColor,
  clickable,
  children,
  href,
  onClick,
}: ListCardProps): React.ReactElement {
  const card = (
    <div
      className={"lc" + (clickable ? " clickable" : "")}
      style={borderColor ? { borderColor } : undefined}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="lc-head">
        {platform && (
          <div className={"ibox " + platform}>
            {PLATFORM_ICONS[platform]}
          </div>
        )}
        <div className="col" style={{ flex: 1, minWidth: 0 }}>
          <p className="lc-name">{name}</p>
          {subtitle && <p className="lc-per">{subtitle}</p>}
        </div>
        {status && <StatusChip status={status} label={STATUS_LABEL[status]} />}
      </div>
      {children}
    </div>
  );

  if (href) {
    return <Link href={href}>{card}</Link>;
  }

  return card;
}
