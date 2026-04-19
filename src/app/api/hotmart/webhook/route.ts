import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const RELEVANT_EVENTS = new Set([
  "PURCHASE_APPROVED",
  "PURCHASE_COMPLETE",
  "PURCHASE_CANCELLED",
  "PURCHASE_REFUNDED",
  "PURCHASE_CHARGEBACK",
  "PURCHASE_EXPIRED",
]);

export async function POST(request: NextRequest) {
  const hottok = request.headers.get("x-hotmart-hottok");
  if (!hottok || hottok !== process.env.HOTMART_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = (body as { event?: string }).event;
  if (!event || !RELEVANT_EVENTS.has(event)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const purchase = (body as { data?: { purchase?: { transaction?: string; status?: string } } })
    .data?.purchase;

  const transactionCode = purchase?.transaction;
  const status = purchase?.status;

  if (!transactionCode || !status) {
    return NextResponse.json({ error: "Missing transaction or status" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { error } = await supabase
    .from("dash_gestao_hotmart_sales")
    .update({ status, collected_at: new Date().toISOString() })
    .eq("transaction_code", transactionCode);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
