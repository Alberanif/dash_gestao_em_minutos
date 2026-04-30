import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import type { UserRole } from "@/types/auth";

export const metadata: Metadata = {
  title: "Painel IGT — Gestão em 4 Minutos",
};

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

  const role = (user.app_metadata?.role as UserRole) ?? "gestor";
  if (role === "comum") redirect("/base-de-dados");

  return (
    <div className="flex min-h-screen" style={{ background: "var(--color-bg)" }}>
      <DashboardSidebar userEmail={user.email ?? "usuario@igt"} role={role} />
      <main className="flex-1 overflow-y-auto" style={{ background: "var(--color-bg)" }}>
        {children}
      </main>
    </div>
  );
}
