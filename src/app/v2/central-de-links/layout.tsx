import "@/components/v2/eventos/pastas.css";
import "@/components/v2/central-de-links/central-de-links.css";
import "@/components/v2/evento/voltar.css";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { papelDoUsuario, podeVer } from "@/lib/central-de-links/papel";
import { PapelProvider } from "@/components/v2/central-de-links/papel-context";
import { BotaoVoltarAoMenu } from "@/components/v2/central-de-links/voltar-ao-menu";
import { SemAcessoCentral } from "@/components/v2/central-de-links/sem-acesso";

/** Guarda server-side: sem `central_role` o conteúdo nem é renderizado. A RLS do banco é a barreira real. */
export default async function CentralDeLinksLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const papel = papelDoUsuario(user);

  if (!podeVer(papel)) return <SemAcessoCentral />;

  return (
    <PapelProvider papel={papel}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 py-6">
        <BotaoVoltarAoMenu />
        {children}
      </div>
    </PapelProvider>
  );
}
