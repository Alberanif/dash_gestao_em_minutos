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
    redirect("/login");
  }

  const role = (user.app_metadata?.role as UserRole) ?? "gestor";

  return (
    <main style={{ minHeight: "100vh", background: "#07101f" }}>
      <SelectionCards role={role} userEmail={user.email ?? ""} />
    </main>
  );
}
