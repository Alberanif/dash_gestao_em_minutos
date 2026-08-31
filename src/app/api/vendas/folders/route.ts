import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await requireRole(["gestor", "analista"]);
  if (error) return error;

  const supabase = createSupabaseServiceClient();
  const url = new URL(request.url);
  const accountId = url.searchParams.get("account_id");

  let query = supabase
    .from("dash_gestao_vendas_folders")
    .select("*")
    .order("name", { ascending: true });

  if (accountId) {
    query = query.eq("account_id", accountId);
  }

  const { data: folders, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ folders: folders ?? [] });
}

export async function POST(request: NextRequest) {
  const { error } = await requireRole(["gestor"]);
  if (error) return error;

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

  let accountId = typeof body?.account_id === "string" ? body.account_id.trim() : null;

  if (!accountId) {
    // Busca a conta padrão
    const { data: account } = await supabase
      .from("dash_gestao_accounts")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (account?.id) {
      accountId = account.id;
    } else {
      // Se não tem conta no DB ainda, busca de cycles/products
      const { data: product } = await supabase
        .from("dash_gestao_hotmart_products")
        .select("account_id")
        .limit(1)
        .maybeSingle();

      accountId = product?.account_id ?? null;
    }
  }

  if (!accountId) {
    return NextResponse.json({ error: "Conta não informada ou não encontrada" }, { status: 400 });
  }

  const { data: folder, error: insertError } = await supabase
    .from("dash_gestao_vendas_folders")
    .insert({
      name,
      account_id: accountId,
    })
    .select("*")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ folder }, { status: 201 });
}
