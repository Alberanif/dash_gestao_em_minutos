import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { fetchDebriefingMetrics, type DebriefingQueryProduct } from "@/lib/indicadores/service/debriefing";

type ParsedProducts = { ok: true; value: DebriefingQueryProduct[] } | { ok: false; error: string };

/** `products` = JSON `[{"product_id":"123","offer_codes":["abc"]}]`. offer_codes ausente/vazio = todas. */
function parseProducts(raw: string | null): ParsedProducts {
  if (!raw) return { ok: false, error: "products is required" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "products must be valid JSON" };
  }
  if (!Array.isArray(parsed)) return { ok: false, error: "products must be an array" };
  if (parsed.length === 0) return { ok: false, error: "products must not be empty" };

  const value: DebriefingQueryProduct[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i] as Record<string, unknown> | null;
    if (!item || typeof item !== "object" || typeof item.product_id !== "string" || item.product_id.trim() === "") {
      return { ok: false, error: `products[${i}].product_id is required` };
    }
    const offerCodes = Array.isArray(item.offer_codes)
      ? item.offer_codes.filter((c): c is string => typeof c === "string")
      : [];
    value.push({
      product_id: item.product_id,
      product_name: typeof item.product_name === "string" ? item.product_name : undefined,
      offer_codes: offerCodes,
    });
  }
  return { ok: true, value };
}

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "start_date and end_date are required" }, { status: 400 });
  }

  const products = parseProducts(searchParams.get("products"));
  if (!products.ok) {
    return NextResponse.json({ error: products.error }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  try {
    const metrics = await fetchDebriefingMetrics({ startDate, endDate, products: products.value }, supabase);
    return NextResponse.json(metrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar métricas de debriefing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
