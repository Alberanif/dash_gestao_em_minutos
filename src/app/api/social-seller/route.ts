import { NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_eqa")
    .select("*")
    .order("week_start", { ascending: false });

  if (dbError) {
    return NextResponse.json(
      { error: "Erro ao carregar semanas" },
      { status: 500 }
    );
  }

  return NextResponse.json(data || []);
}
