import "../dash-theme.css";
import "./ultimates.css";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UltimatesScreen } from "@/components/ultimates/ultimates-screen";
import { sortProductsByName } from "@/lib/utils/hotmart-products";
import { resolveAccountRole } from "@/types/auth";

// Guard server-side por papel (PRD issue #114, critério 1) — mesmo padrão de
// src/app/dashboard/layout.tsx e src/app/indicadores/layout.tsx: role "comum"
// nunca acessa este módulo, cai no fallback comum a ambos (/base-de-dados).
export default async function UltimatesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = resolveAccountRole(user.app_metadata?.role);
  if (role === "pendente") redirect("/aguardando-aprovacao");
  if (role === "comum") redirect("/base-de-dados");

  // Lista de produtos para o dropdown do modal de criação de ciclo. Sem rota
  // de API dedicada que não exija account_id (GET /api/hotmart/products
  // exige), então lemos direto aqui via server client (RLS de leitura
  // authenticated — ver 037_hotmart_products_offers.sql).
  const { data: products } = await supabase
    .from("dash_gestao_hotmart_products")
    .select("product_id, product_name, account_id")
    .eq("is_active", true);

  // Sem cast na linha abaixo, de propósito: o supabase-js infere os NOMES dos
  // campos a partir da string literal do .select() (os valores viram any, os
  // nomes não). Deixando o tipo fluir, o tsc acusa se alguém tirar account_id do
  // select acima — que é justamente o que alimenta a trava de conta do modal de
  // ciclo. Um `as { ... }[]` aqui afirmaria a forma e engoliria essa deriva em
  // silêncio.
  return (
    <UltimatesScreen
      role={role}
      products={sortProductsByName(products ?? [])}
    />
  );
}
