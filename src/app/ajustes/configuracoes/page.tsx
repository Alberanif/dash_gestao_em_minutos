import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { AccountList } from "@/components/settings/account-list";
import { UserManagement } from "@/components/settings/user-management";
import type { Account } from "@/types/accounts";
import type { UserRole } from "@/types/auth";

export default async function ConfiguracoesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const role = (user.app_metadata?.role as UserRole) ?? "gestor";
  if (role !== "gestor" && role !== "analista") redirect("/ajustes");

  const { data: accounts } = await supabase
    .from("dash_gestao_accounts")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-full" style={{ width: "100%" }}>
      <div className="mx-auto max-w-5xl px-6 pt-6">
        <Link
          href="/ajustes"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text-muted)",
            textDecoration: "none",
            marginBottom: 16,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Voltar
        </Link>
      </div>
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
