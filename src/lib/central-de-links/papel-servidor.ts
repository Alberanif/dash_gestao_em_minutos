import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { podeEditar, podeVer, resolverPapelCentral, type PapelCentral } from "./papel";

type Resultado = {
  error: NextResponse | null;
  userId: string | null;
  papel: PapelCentral | null;
};

/**
 * Guarda das rotas da Central de Links. A sessão vem do cookie; o papel é RECONSULTADO com a
 * service key (não se confia no JWT, que pode estar desatualizado após uma troca de acesso).
 */
export async function exigirPapelCentral(minimo: "membro" | "admin"): Promise<Resultado> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), userId: null, papel: null };
  }

  const { data } = await createSupabaseServiceClient().auth.admin.getUserById(user.id);
  const papel = resolverPapelCentral(
    (data?.user?.app_metadata as { central_role?: unknown } | undefined)?.central_role,
  );

  const permitido = minimo === "admin" ? podeEditar(papel) : podeVer(papel);
  if (!permitido) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), userId: user.id, papel };
  }

  return { error: null, userId: user.id, papel };
}
