import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { UltimatesCycleStatus } from "@/types/ultimates";

type Params = { id: string };

const VALID_STATUSES: UltimatesCycleStatus[] = ["ativo", "encerrado"];

// Gestão de ciclo (renomear, ajustar meta, encerrar/reativar) NÃO é bloqueada
// pelo status encerrado — RF-12 bloqueia upload/vínculo/refresh, que são
// tratados em outras rotas, não nesta.
export async function PATCH(request: NextRequest, { params }: { params: Promise<Params> }) {
  const { error } = await requireRole(["gestor"]);
  if (error) return error;

  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
    return NextResponse.json({ error: "body vazio" }, { status: 400 });
  }

  // purchases_only NÃO é lido aqui de propósito: é definido só na criação e
  // imutável depois (PRD "Apenas Compras"). Trocar o modo no meio do ciclo
  // corromperia a contabilidade — um purchasesOnly no body é simplesmente
  // ignorado, nunca aplicado.
  const { name, goalPercent, status, countsNewBuyers } = body as {
    name?: unknown;
    goalPercent?: unknown;
    status?: unknown;
    countsNewBuyers?: unknown;
  };

  const update: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name inválido" }, { status: 400 });
    }
    update.name = name.trim();
  }

  if (goalPercent !== undefined) {
    if (goalPercent !== null) {
      if (
        typeof goalPercent !== "number" ||
        Number.isNaN(goalPercent) ||
        goalPercent < 0 ||
        goalPercent > 100
      ) {
        return NextResponse.json(
          { error: "goalPercent deve ser numérico entre 0 e 100, ou null" },
          { status: 400 }
        );
      }
    }
    update.goal_percent = goalPercent;
  }

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status as UltimatesCycleStatus)) {
      return NextResponse.json(
        { error: `status deve ser um de: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    update.status = status;
  }

  // Declara que o ciclo não admite novas compras (migration 053). A
  // reclassificação em si é derivada no cliente; aqui só persistimos a política.
  if (countsNewBuyers !== undefined) {
    if (typeof countsNewBuyers !== "boolean") {
      return NextResponse.json({ error: "countsNewBuyers deve ser booleano" }, { status: 400 });
    }
    update.counts_new_buyers = countsNewBuyers;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nenhum campo válido para atualizar" }, { status: 400 });
  }

  update.updated_at = new Date().toISOString();

  const supabase = createSupabaseServiceClient();
  const { data, error: dbError } = await supabase
    .from("dash_gestao_ultimates_cycles")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (dbError) {
    if (dbError.code === "PGRST116") {
      return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ cycle: data });
}
