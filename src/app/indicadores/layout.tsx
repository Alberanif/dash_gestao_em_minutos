import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { resolveAccountRole } from "@/types/auth";

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

  const role = resolveAccountRole(user.app_metadata?.role);
  if (role === "pendente") redirect("/aguardando-aprovacao");
  if (role === "comum") redirect("/base-de-dados");

  return <main style={{ minHeight: "100vh", background: "#0d0f12" }}>{children}</main>;
}
