import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { UserRole } from "@/types/auth";

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

  const role = (user.app_metadata?.role as UserRole) ?? "gestor";
  if (role === "comum") redirect("/base-de-dados");

  return <main style={{ minHeight: "100vh", background: "var(--color-bg)" }}>{children}</main>;
}
