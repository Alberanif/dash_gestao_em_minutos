import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PaginaAjustes } from "@/components/v2/ajustes/pagina";
import { ContasConectadas } from "@/components/v2/ajustes/contas/contas-conectadas";
import type { Account } from "@/types/accounts";

export const metadata: Metadata = { title: "Contas conectadas" };

// Permissão (gestor/analista) é checada pelo layout de /v2/ajustes.
export default async function ContasPage() {
  const supabase = await createSupabaseServerClient();
  const { data: accounts } = await supabase
    .from("dash_gestao_accounts")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <PaginaAjustes titulo="Contas conectadas" subtitulo="Plataformas conectadas ao painel">
      <ContasConectadas contasIniciais={(accounts as Account[]) ?? []} />
    </PaginaAjustes>
  );
}
