import { NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { fetchDistinctLeadEvents } from "@/lib/leads/events";

export async function GET() {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = createSupabaseServiceClient();

  try {
    const eventos = await fetchDistinctLeadEvents(supabase);
    return NextResponse.json(eventos);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar eventos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
