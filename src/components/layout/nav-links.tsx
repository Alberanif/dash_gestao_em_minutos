"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard/youtube", label: "▶ YouTube" },
  { href: "/dashboard/instagram", label: "📷 Instagram" },
  { href: "/dashboard/settings", label: "⚙ Configurações" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            pathname.startsWith(href)
              ? "bg-blue-600 text-white"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
