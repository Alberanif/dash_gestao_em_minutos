import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  parseFolderId,
  parseOfferCodes,
  parseViewPeriod,
} from "@/lib/vendas/views-validation";
import { runBackfill } from "@/lib/vendas/views-sync";
import type { VendasViewRecord } from "@/types/vendas";

export const maxDuration = 60;

type Params = { id: string };

const VIEWS_TABLE = "dash_gestao_vendas_views";
const PATCHABLE = ["name", "folder_id", "offer_codes", "view_start_date", "view_end_date"];

export async function GET(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const { error } = await requireRole(["gestor", "analista"]);
  if (error) return error;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  const { data, error: dbError } = await supabase
    .from(VIEWS_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Visualização não encontrada" }, { status: 404 });

  return NextResponse.json({ view: data as VendasViewRecord });
}

/**
 * PATCH parcial. product_id é imutável (400 se vier no body). Ofertas: o corpo
 * traz a lista COMPLETA; adicionar dispara backfill SÓ das ofertas novas e
 * remover apenas tira da allowlist (as vendas continuam em hotmart_sales).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<Params> }) {
  const { error } = await requireRole(["gestor"]);
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
    return NextResponse.json({ error: "body vazio" }, { status: 400 });
  }
  const input = body as Record<string, unknown>;

  if ("product_id" in input) {
    return NextResponse.json(
      { error: "product_id não pode ser alterado; crie uma nova visualização" },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {};

  if (input.name !== undefined) {
    if (typeof input.name !== "string" || input.name.trim().length === 0) {
      return NextResponse.json({ error: "name inválido" }, { status: 400 });
    }
    update.name = input.name.trim();
  }

  if (input.folder_id !== undefined) {
    const folder = parseFolderId(input.folder_id);
    if (!folder.ok) return NextResponse.json({ error: folder.error }, { status: 400 });
    update.folder_id = folder.value;
  }

  if (input.view_start_date !== undefined || input.view_end_date !== undefined) {
    const period = parseViewPeriod(input.view_start_date, input.view_end_date);
    if (!period.ok) return NextResponse.json({ error: period.error }, { status: 400 });
    Object.assign(update, period.value);
  }

  let newCodes: string[] | null = null;
  if (input.offer_codes !== undefined) {
    const codes = parseOfferCodes(input.offer_codes);
    if (!codes.ok) return NextResponse.json({ error: codes.error }, { status: 400 });
    newCodes = codes.value;
    update.offer_codes = newCodes;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: `nenhum campo válido para atualizar (${PATCHABLE.join(", ")})` },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServiceClient();

  // Estado atual: precisamos da allowlist anterior para saber o que é "novo".
  const { data: current, error: readError } = await supabase
    .from(VIEWS_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Visualização não encontrada" }, { status: 404 });

  const before = current as VendasViewRecord;

  // updated_at é mantido pelo trigger do banco.
  const { data: updated, error: dbError } = await supabase
    .from(VIEWS_TABLE)
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (dbError || !updated) {
    if (dbError?.code === "PGRST116") {
      return NextResponse.json({ error: "Visualização não encontrada" }, { status: 404 });
    }
    // 23514 = CHECK violada; UV001 = product_id (defesa em profundidade do trigger).
    const status = dbError?.code === "23514" || dbError?.code === "UV001" ? 400 : 500;
    return NextResponse.json({ error: dbError?.message ?? "Falha ao atualizar" }, { status });
  }

  let view = updated as VendasViewRecord;

  const added = newCodes === null ? [] : newCodes.filter((code) => !before.offer_codes.includes(code));
  if (added.length > 0) {
    const outcome = await runBackfill({
      supabase,
      view,
      offerCodes: added,
      signal: request.signal,
    });
    view = {
      ...view,
      backfill_status: outcome.status,
      backfill_from: outcome.status === "failed" ? view.backfill_from : outcome.backfillFrom,
    };
  }

  return NextResponse.json({ view });
}

// Remover a visualização NÃO apaga vendas: hotmart_sales é compartilhada e não
// tem FK para a visualização.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const { error } = await requireRole(["gestor"]);
  if (error) return error;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  const { data, error: dbError } = await supabase
    .from(VIEWS_TABLE)
    .delete()
    .eq("id", id)
    .select("id");

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Visualização não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
