"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  {
    href: "/dashboard/posicionamento",
    label: "Posicionamento",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/relacionamento",
    label: "Relacionamento",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/dashboard/youtube",
    label: "YouTube",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="10 8 16 12 10 16 10 8" />
      </svg>
    ),
  },
  {
    href: "/dashboard/instagram",
    label: "Instagram",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/meta-ads",
    label: "Meta Ads",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    href: "/dashboard/hotmart",
    label: "Hotmart",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/dados",
    label: "Dados",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
        <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
      </svg>
    ),
  },
  {
    href: "/dashboard/settings",
    label: "Configurações",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
        <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
];

interface NavLinksProps {
  collapsed?: boolean;
}

export function NavLinks({ collapsed = false }: NavLinksProps) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-1 px-2">
      {LINKS.map(({ href, label, icon }) => {
        const isActive = pathname.startsWith(href);
        return (
          <div key={href} className="group relative">
            <Link
              href={href}
              className={`flex rounded-r-[10px] text-sm font-medium transition-colors ${
                collapsed
                  ? "justify-center px-0 py-2.5 hover:bg-slate-50 hover:text-slate-900"
                  : "items-center gap-3 px-4 py-2.5 hover:bg-slate-50 hover:text-slate-900"
              }`}
              style={
                isActive
                  ? {
                      background: "var(--color-primary-light)",
                      color: "var(--color-primary)",
                      borderLeft: "3px solid var(--color-primary)",
                    }
                  : {
                      color: "var(--color-text-muted)",
                    }
              }
            >
              <span className="flex h-[18px] w-[18px] items-center justify-center">{icon}</span>
              {!collapsed ? <span>{label}</span> : null}
            </Link>
            {collapsed ? (
              <span
                className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-30 hidden -translate-y-1/2 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-white shadow-md group-hover:block"
                style={{ background: "var(--color-text)" }}
              >
                {label}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
