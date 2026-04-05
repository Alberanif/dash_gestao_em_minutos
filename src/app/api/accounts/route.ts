import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient, createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = await createSupabaseServerClient();
  const platform = request.nextUrl.searchParams.get("platform");

  let query = supabase
    .from("dash_gestao_accounts")
    .select("*")
    .order("created_at", { ascending: true });

  if (platform) {
    query = query.eq("platform", platform);
  }

  const { data, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const body = await request.json();
  const { name, platform, credentials } = body;

  if (!name || !platform || !credentials) {
    return NextResponse.json(
      { error: "name, platform e credentials são obrigatórios" },
      { status: 400 }
    );
  }

  if (!["youtube", "instagram"].includes(platform)) {
    return NextResponse.json(
      { error: "platform deve ser 'youtube' ou 'instagram'" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_accounts")
    .insert({ name, platform, credentials })
    .select()
    .single();

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
