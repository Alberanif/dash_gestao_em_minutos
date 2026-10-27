import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { exigirPapelCentral } from "@/lib/central-de-links/papel-servidor";
import { resolverPapelCentral } from "@/lib/central-de-links/papel";

/** Concede, troca ou remove o acesso de uma pessoa à Central de Links (só admin da Central). */
export async function PATCH(request: NextRequest) {
  const { error, userId } = await exigirPapelCentral("admin");
  if (error) return error;

  let corpo: { userId?: unknown; centralRole?: unknown } | null = null;
  try {
    corpo = await request.json();
  } catch {
    corpo = null;
  }

  const alvoId = corpo?.userId;
  const bruto = corpo?.centralRole;
  const novoPapel = resolverPapelCentral(bruto);

  if (typeof alvoId !== "string" || !alvoId) {
    return NextResponse.json({ error: "userId é obrigatório" }, { status: 400 });
  }
  if (bruto !== null && novoPapel === null) {
    return NextResponse.json({ error: "centralRole deve ser admin, membro ou null" }, { status: 400 });
  }
  if (alvoId === userId) {
    return NextResponse.json({ error: "Não é possível alterar o próprio acesso" }, { status: 403 });
  }

  const supabase = createSupabaseServiceClient();
  const { data: alvo, error: erroAlvo } = await supabase.auth.admin.getUserById(alvoId);
  if (erroAlvo || !alvo?.user) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
  }

  // O Supabase pode substituir app_metadata inteiro: parte do que existe e mexe só em central_role.
  const { central_role: _antigo, ...resto } = (alvo.user.app_metadata ?? {}) as Record<string, unknown>;
  void _antigo;
  const app_metadata = novoPapel === null ? resto : { ...resto, central_role: novoPapel };

  const { error: erroGravar } = await supabase.auth.admin.updateUserById(alvoId, { app_metadata });
  if (erroGravar) {
    return NextResponse.json({ error: erroGravar.message }, { status: 500 });
  }

  return NextResponse.json({ id: alvoId, central_role: novoPapel });
}
