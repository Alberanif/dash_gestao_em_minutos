import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import "@/components/v2/menu-principal/menu-principal.css";
import { MenuPrincipal } from "@/components/v2/menu-principal/menu-principal";
import { resolveAccountRole } from "@/types/auth";
import { primeiroNome, saudacao } from "@/components/v2/menu-principal/saudacao";

export const metadata: Metadata = { title: "Menu" };

// A raiz da V2 é o menu principal. O acesso é guardado pelo layout.
export default async function V2Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // O layout já barrou quem está pendente; na dúvida, vale o papel de menos acesso (o analista não vê Configurações).
  const papel = resolveAccountRole(user?.app_metadata?.role);
  const role = papel === "pendente" ? "analista" : papel;

  return <MenuPrincipal saudacao={saudacao(new Date())} nome={primeiroNome(user)} role={role} />;
}
