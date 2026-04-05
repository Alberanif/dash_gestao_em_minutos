import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AccountList } from "@/components/settings/account-list";
import { UserManagement } from "@/components/settings/user-management";
import type { Account } from "@/types/accounts";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: accounts } = await supabase
    .from("dash_gestao_accounts")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-12">
      <AccountList initialAccounts={(accounts as Account[]) ?? []} />
      <hr />
      <UserManagement />
    </div>
  );
}
