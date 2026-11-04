import "../dash-theme.css";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canManageSettings, resolveAccountRole } from "@/types/auth";

export default async function AjustesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = resolveAccountRole(user.app_metadata?.role);
  if (role === "pendente") redirect("/aguardando-aprovacao");
  // Configurações são só do gestor (comum, legado, também não entra).
  if (!canManageSettings(role)) redirect("/");

  return (
    <main
      className="dash-dark"
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "20px",
      }}
    >
      {children}
    </main>
  );
}
