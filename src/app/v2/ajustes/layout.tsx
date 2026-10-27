import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ajustesAccessRedirect } from "./acesso";

// Gestor e analista entram em Ajustes; as telas filhas herdam a guarda.
export default async function AjustesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const destino = ajustesAccessRedirect(user);
  if (destino) redirect(destino);

  return children;
}
