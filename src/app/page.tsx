import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SelectionCards } from "@/components/layout/selection-cards";
import type { UserRole } from "@/types/auth";

export default async function SelectionPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const role = (user.app_metadata?.role as UserRole) ?? "gestor";

  return (
    <main
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "var(--color-background)",
        padding: "20px",
      }}
    >
      <p
        style={{
          position: "absolute",
          top: "24px",
          left: "24px",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        Selecione o módulo
      </p>
      <SelectionCards role={role} />
    </main>
  );
}
