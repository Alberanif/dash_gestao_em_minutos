import "../dash-theme.css";
import "./relatorio-de-vendas.css";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VendasScreen } from "@/components/vendas/vendas-screen";
import { sortProductsByName } from "@/lib/utils/hotmart-products";
import { resolveAccountRole } from "@/types/auth";

export default async function VendasPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = resolveAccountRole(user.app_metadata?.role);
  if (role === "pendente") redirect("/aguardando-aprovacao");
  if (role === "comum") redirect("/base-de-dados");

  const { data: products } = await supabase
    .from("dash_gestao_hotmart_products")
    .select("product_id, product_name, account_id")
    .eq("is_active", true);

  return (
    <VendasScreen
      role={role}
      products={sortProductsByName(products ?? [])}
    />
  );
}
