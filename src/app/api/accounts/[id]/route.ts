import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();

  // Permite atualizar apenas campos seguros
  const allowed: Record<string, unknown> = {};
  if (body.name !== undefined) allowed.name = body.name;
  if (body.credentials !== undefined) allowed.credentials = body.credentials;
  if (body.is_active !== undefined) allowed.is_active = body.is_active;

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_accounts")
    .update(allowed)
    .eq("id", id)
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  // CASCADE DELETE via FK remove todos os snapshots associados automaticamente
  const { error: dbError } = await supabase
    .from("dash_gestao_accounts")
    .delete()
    .eq("id", id);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
