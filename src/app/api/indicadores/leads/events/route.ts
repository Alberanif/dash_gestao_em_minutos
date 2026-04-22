import { NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET() {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_captacao_leads")
    .select("evento")
    .not("evento", "is", null)
    .order("evento");

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  const events = [...new Set((data ?? []).map((r) => r.evento as string))].sort();
  return NextResponse.json(events);
}
