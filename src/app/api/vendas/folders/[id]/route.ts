import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

type Params = { id: string };

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<Params> }
) {
  const { error } = await requireRole(["gestor"]);
  if (error) return error;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "ID da pasta é obrigatório" }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload JSON inválido" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Nome da pasta é obrigatório" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { data: existing } = await supabase
    .from("dash_gestao_vendas_folders")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Pasta não encontrada" }, { status: 404 });
  }

  const { data: folder, error: updateError } = await supabase
    .from("dash_gestao_vendas_folders")
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ folder });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<Params> }
) {
  const { error } = await requireRole(["gestor"]);
  if (error) return error;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "ID da pasta é obrigatório" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { data: existing } = await supabase
    .from("dash_gestao_vendas_folders")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Pasta não encontrada" }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from("dash_gestao_vendas_folders")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
