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
      className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between"
      style={{
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        padding: "12px 24px",
      }}
    >
      <div className="min-w-0">
        {back ? (
          <div className="mb-2">
            <Link
              href={back}
              className="inline-flex items-center gap-2 rounded-[8px] px-3.5 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 focus-visible:outline outline-2 outline-offset-2"
              style={{
                background: "var(--color-primary)",
                border: "1px solid var(--color-primary)",
                textDecoration: "none",
                outlineColor: "var(--color-primary)",
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
