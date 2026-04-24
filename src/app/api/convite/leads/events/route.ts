import { NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { fetchDistinctLeadEvents } from "@/lib/leads/events";

export async function GET() {
  const { error } = await validateApiAuth();
  if (error) return error;

  const supabase = createSupabaseServiceClient();
  try {
    const events = await fetchDistinctLeadEvents(supabase);
    return NextResponse.json(events);
  } catch (dbError) {
    return NextResponse.json(
      { error: dbError instanceof Error ? dbError.message : "Erro ao carregar eventos" },
      { status: 500 }
    );
  }
}
