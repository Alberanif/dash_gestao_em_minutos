import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

/**
 * Dash Ultimates — correção de cadastro de um lead da base
 * (PRD docs/PRD_2026-07-30_ultimates_editar_roster.md, seção 6.4).
 *
 * Só `name` e `phone`. O `email` fica de fora de propósito: é a chave do
 * cruzamento com as vendas e do unique uq_ultimates_buyers_cycle_email, então
 * trocá-lo reclassificaria a pessoa sem deixar rastro do motivo — o caminho
 * explícito e auditável para isso é o vínculo manual (POST /api/ultimates/links).
 * `extra` também não é editável: veio do CSV e não tem UI.
 *
 * ATENÇÃO: esta correção é SOBRESCRITA pelo próximo upload da base —
 * dash_gestao_ultimates_replace_buyers faz `set name = ..., phone = ...` para
 * todo email mantido (migration 050). É comportamento aceito (o CSV é a fonte
 * da verdade) e o modal avisa o gestor; não "conserte" isso sem revisitar a
 * decisão 9 do PRD.
 *
 * Ciclo encerrado bloqueia (409), como upload e vínculo manual: cadastro é
 * operação de ciclo vivo. A exclusão de lead é a única escrita do roster que
 * atravessa o encerramento — ver excluded-buyers/route.ts.
 */

type Params = { id: string; buyerId: string };

interface PatchBody {
  name?: unknown;
  phone?: unknown;
}

// Campo ausente fica de fora do UPDATE; campo presente e vazio vira null (é
// como o upload já grava um campo em branco do CSV).
function normalizeField(value: unknown): string | null | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { error } = await requireRole(["gestor"]);
  if (error) return error;

  const { id, buyerId } = await params;
  const body = (await request.json().catch(() => null)) as PatchBody | null;

  const patch: { name?: string | null; phone?: string | null } = {};
  const name = normalizeField(body?.name);
  const phone = normalizeField(body?.phone);
  if (name !== undefined) patch.name = name;
  if (phone !== undefined) patch.phone = phone;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Informe name ou phone" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { data: cycle, error: cycleError } = await supabase
    .from("dash_gestao_ultimates_cycles")
    .select("id, status")
    .eq("id", id)
    .single();

  if (cycleError || !cycle) {
    return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  }

  if (cycle.status === "encerrado") {
    return NextResponse.json({ error: "Ciclo encerrado" }, { status: 409 });
  }

  // O filtro por cycle_id não é redundante com o id: sem ele, um buyerId de
  // outro ciclo seria editado por quem só tem acesso a este.
  const { data: updated, error: updateError } = await supabase
    .from("dash_gestao_ultimates_buyers")
    .update(patch)
    .eq("id", buyerId)
    .eq("cycle_id", id)
    .select("id, email, name, phone")
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: "Comprador não encontrado neste ciclo" },
      { status: 404 }
    );
  }

  return NextResponse.json({ buyer: updated });
}
