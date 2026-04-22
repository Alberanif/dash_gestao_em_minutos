import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IndicadoresSidebar } from "@/components/indicadores/indicadores-sidebar";

export const metadata: Metadata = {
  title: "Indicadores — IGT",
};

export default async function IndicadoresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--color-bg)" }}>
      <IndicadoresSidebar userEmail={user.email ?? ""} />
      <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}
