import { NextRequest, NextResponse } from "next/server";
import { validateApiAuth } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { error } = await validateApiAuth();
  if (error) return error;

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const supabase = createSupabaseServiceClient();

  let query = supabase
    .from("dash_gestao_hotmart_products")
    .select("product_id, product_name")
    .eq("is_active", true)
    .order("product_name", { ascending: true })
    .limit(100);

  if (q.trim()) {
    query = query.or(
      `product_name.ilike.%${q.trim()}%,product_id.ilike.%${q.trim()}%`
    );
  }

  const { data, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
