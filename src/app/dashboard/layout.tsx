import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold">Gestao em 4 Minutos</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/dashboard" className="hover:text-blue-600">
              Visao Geral
            </Link>
            <Link href="/dashboard/youtube" className="hover:text-blue-600">
              YouTube
            </Link>
            <Link href="/dashboard/instagram" className="hover:text-blue-600">
              Instagram
            </Link>
          </nav>
        </div>
        <form action="/api/auth/signout" method="post">
          <button className="text-sm text-gray-500 hover:text-gray-700">
            Sair
          </button>
        </form>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
