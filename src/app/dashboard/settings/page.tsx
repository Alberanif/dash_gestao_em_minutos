import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { AccountList } from "@/components/settings/account-list";
import { UserManagement } from "@/components/settings/user-management";
import type { Account } from "@/types/accounts";
import type { UserRole } from "@/types/auth";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = (user.app_metadata?.role as UserRole) ?? "gestor";
  if (role !== "gestor") redirect("/dashboard");

  const { data: accounts } = await supabase
    .from("dash_gestao_accounts")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-full">
      <PageHeader title="Configurações" subtitle="Gerencie contas conectadas e acessos ao painel" />

      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <section className="surface-card p-6">
          <AccountList initialAccounts={(accounts as Account[]) ?? []} />
        </section>
        <section className="surface-card p-6">
          <UserManagement />
        </section>
      </div>
    </div>
  );
}
