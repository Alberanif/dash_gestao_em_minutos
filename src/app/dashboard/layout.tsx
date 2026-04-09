import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";

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

  return (
    <div className="flex min-h-screen" style={{ background: "var(--color-bg)" }}>
      <DashboardSidebar userEmail={user.email ?? "usuario@igt"} />
      <main className="flex-1 overflow-y-auto" style={{ background: "var(--color-bg)" }}>
        {children}
      </main>
    </div>
  );
}
