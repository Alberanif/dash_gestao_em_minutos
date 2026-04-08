import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NavLinks } from "@/components/layout/nav-links";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--color-bg)" }}>
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-white flex flex-col" style={{ borderRight: "1px solid var(--color-border)" }}>
        {/* Logo */}
        <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--color-primary)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>IGT</p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3">
          <p className="text-xs font-semibold uppercase tracking-wider px-3 mb-2" style={{ color: "var(--color-text-muted)" }}>
            Análises
          </p>
          <NavLinks />
        </nav>

        {/* Sign out */}
        <div className="px-3 py-4" style={{ borderTop: "1px solid var(--color-border)" }}>
          <form action="/api/auth/signout" method="post">
            <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-100 cursor-pointer" style={{ color: "var(--color-text-muted)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
