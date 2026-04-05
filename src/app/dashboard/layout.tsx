import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NavLinks } from "@/components/layout/nav-links";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold">IGT Dashboard</h1>
          <NavLinks />
        </div>
        <form action="/api/auth/signout" method="post">
          <button className="text-sm text-gray-500 hover:text-gray-700">
            Sair
          </button>
        </form>
      </header>
      <main>{children}</main>
    </div>
  );
}
