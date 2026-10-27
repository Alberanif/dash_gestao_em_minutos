import { createSupabaseServerClient } from "@/lib/supabase/server";
import { papelDoUsuario, podeVer } from "@/lib/central-de-links/papel";
import { PapelProvider } from "@/components/v2/central-de-links/papel-context";
import { SemAcessoCentral } from "@/components/v2/central-de-links/sem-acesso";

/** Guarda server-side: o Teste A/B segue o `central_role`. Sem papel o conteúdo nem é renderizado. A RLS é a barreira real. */
export default async function TestesAbLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const papel = papelDoUsuario(user);

  if (!podeVer(papel)) return <SemAcessoCentral />;

  return (
    <PapelProvider papel={papel}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 py-6">{children}</div>
    </PapelProvider>
  );
}
