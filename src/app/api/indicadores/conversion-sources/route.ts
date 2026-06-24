import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { ConversionSourceRow } from "@/types/indicadores";

function brtToUtc(dateStr: string, endOfDay = false): string {
  const time = endOfDay ? "T23:59:59" : "T00:00:00";
  return new Date(`${dateStr}${time}-03:00`).toISOString();
}

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { searchParams } = request.nextUrl;
  const start_date = searchParams.get("start_date");
  const end_date = searchParams.get("end_date");

  if (!start_date || !end_date) {
    return NextResponse.json({ error: "start_date and end_date are required" }, { status: 400 });
  }

  const startUtc = brtToUtc(start_date, false);
  const endUtc = brtToUtc(end_date, true);
  const productIds = searchParams.getAll("product_ids[]").filter(Boolean);
  const eventos = searchParams.getAll("eventos[]").filter(Boolean);

  const supabase = createSupabaseServiceClient();

  const { data, error: rpcError } = await supabase.rpc("get_conversion_sources", {
    p_start_date: startUtc,
    p_end_date: endUtc,
    ...(productIds.length > 0 ? { p_product_ids: productIds } : {}),
    ...(eventos.length > 0 ? { p_eventos: eventos } : {}),
  });

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  return NextResponse.json(data as ConversionSourceRow[]);
}
