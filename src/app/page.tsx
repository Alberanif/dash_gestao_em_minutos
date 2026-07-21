import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SelectionCards } from "@/components/layout/selection-cards";
import { resolveAccountRole } from "@/types/auth";

export default async function SelectionPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = resolveAccountRole(user.app_metadata?.role);
  if (role === "pendente") redirect("/aguardando-aprovacao");

  return (
    <main style={{ minHeight: "100vh", background: "#07101f" }}>
      <SelectionCards role={role} userEmail={user.email ?? ""} />
    </main>
  );
}
