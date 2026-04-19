import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SelectionCards } from "@/components/layout/selection-cards";

export default async function SelectionPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
        gap: 16,
        padding: 24,
      }}
    >
      <p
        style={{
          fontSize: 13,
          color: "var(--color-text-muted)",
          marginBottom: 8,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        Selecione o módulo
      </p>
      <SelectionCards />
    </main>
  );
}
