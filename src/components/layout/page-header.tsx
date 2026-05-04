import type { ReactNode } from "react";
import Link from "next/link";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  back?: string;
}

export function PageHeader({ title, subtitle, actions, back }: PageHeaderProps) {
  return (
    <header
      className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"
      style={{
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        padding: "20px 24px",
      }}
    >
      <div className="min-w-0">
        {back ? (
          <div className="flex gap-2 mb-3">
            <Link
              href={back}
              className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:opacity-70 focus-visible:outline outline-2 outline-offset-2 transition-opacity"
              style={{
                color: "var(--color-text-muted)",
                textDecoration: "none",
                outlineColor: "var(--color-text-muted)",
              }}
            >
              <span aria-hidden="true">←</span>
              Voltar
            </Link>
          </div>
        ) : null}
        <h1
          className="truncate"
          style={{ fontSize: 20, fontWeight: 600, color: "var(--color-text)" }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-muted)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>

      {actions ? <div className="w-full xl:w-auto xl:flex-shrink-0">{actions}</div> : null}
    </header>
  );
}
