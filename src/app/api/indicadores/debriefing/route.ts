import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { fetchDebriefingMetrics } from "@/lib/indicadores/service/debriefing";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const productId = searchParams.get("product_id");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "start_date and end_date are required" }, { status: 400 });
  }

  if (!productId) {
    return NextResponse.json({ error: "product_id is required" }, { status: 400 });
  }

  const offerCodesRaw = searchParams.get("offer_codes");
  const offerCodes = offerCodesRaw ? offerCodesRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];

  const supabase = createSupabaseServiceClient();

  try {
    const metrics = await fetchDebriefingMetrics({ startDate, endDate, productId, offerCodes }, supabase);
    return NextResponse.json(metrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar métricas de debriefing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
