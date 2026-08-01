import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { parseDateRange } from "@/lib/ultimates/date-range";
import type { UltimatesCycleStatus, SetProductsResult } from "@/types/ultimates";

type Params = { id: string };

const VALID_STATUSES: UltimatesCycleStatus[] = ["ativo", "encerrado"];

// SQLSTATEs próprios levantados pela RPC (migrations 061/062).
const RPC_ERROR_STATUS: Record<string, number> = {
  UL001: 400, // conjunto vazio
  UL002: 400, // produto inexistente
  UL003: 400, // produto de outra conta Hotmart
  UL004: 404, // ciclo inexistente
  UL005: 409, // ciclo encerrado
};

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
  const { name, goalPercent, status, countsNewBuyers, productIds, viewStartDate, viewEndDate } =
    body as {
      name?: unknown;
      goalPercent?: unknown;
      status?: unknown;
      countsNewBuyers?: unknown;
      productIds?: unknown;
      viewStartDate?: unknown;
      viewEndDate?: unknown;
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

  // Janela de visualização do ciclo (migration 063). Vale para TODOS que abrem
  // o ciclo, e por isso é escrita aqui, na rota que já é gestor-only — o resto
  // do dash a consome como leitura.
  //
  // O PAR É UM VALOR SÓ, e este é o único campo do PATCH em que uma chave
  // sozinha é erro em vez de atualização parcial. Aceitar `viewStartDate`
  // isolado deixaria a decisão de qual é o outro extremo para o banco (que
  // recusa, pelo CHECK, com um 500 ilegível) ou pior, para o acaso de a coluna
  // já ter um valor antigo — um recorte que ninguém pediu. Mesma regra que o
  // GET /roster já aplica à query string.
  //
  // `null` nos dois limpa a janela: o ciclo volta a mostrar o produto inteiro.
  const pediuJanela = viewStartDate !== undefined || viewEndDate !== undefined;

  if (pediuJanela) {
    if (viewStartDate === undefined || viewEndDate === undefined) {
      return NextResponse.json(
        { error: "viewStartDate e viewEndDate devem vir juntos" },
        { status: 400 }
      );
    }
    if (viewStartDate === null && viewEndDate === null) {
      update.view_start_date = null;
      update.view_end_date = null;
    } else {
      const janela =
        typeof viewStartDate === "string" && typeof viewEndDate === "string"
          ? parseDateRange(viewStartDate, viewEndDate)
          : null;
      if (janela === null) {
        return NextResponse.json(
          { error: "Janela inválida: use YYYY-MM-DD com fim >= início, ou null nos dois" },
          { status: 400 }
        );
      }
      update.view_start_date = janela.start;
      update.view_end_date = janela.end;
    }
  }

  // Conjunto de produtos do ciclo (migration 062). Vem COMPLETO, não como
  // delta: o corpo diz o que o ciclo passa a ter, e o diff é feito no banco.
  let ids: string[] | null = null;

  if (productIds !== undefined) {
    if (!Array.isArray(productIds)) {
      return NextResponse.json({ error: "productIds deve ser um array" }, { status: 400 });
    }
    ids = Array.from(
      new Set(
        productIds
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      )
    );
    if (ids.length === 0) {
      return NextResponse.json({ error: "Selecione ao menos um produto" }, { status: 400 });
    }
  }

  if (Object.keys(update).length === 0 && ids === null) {
    return NextResponse.json({ error: "nenhum campo válido para atualizar" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  // A troca de produtos vai PRIMEIRO, e sozinha numa transação (a RPC). É a
  // única escrita daqui que apaga linha de roster, e é a que tem invariantes
  // reais para checar — ciclo ativo, conta única, conjunto não vazio. Se ela
  // recusar, nada mais foi tocado.
  let productsResult: SetProductsResult | null = null;

  if (ids !== null) {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "dash_gestao_ultimates_set_cycle_products",
      { p_cycle_id: id, p_product_ids: ids }
    );

    if (rpcError) {
      // As exceções da RPC carregam SQLSTATE próprio (UL001..UL005). Sem este
      // mapa, "ciclo encerrado" viraria um 500 genérico e a tela mostraria
      // "erro ao salvar" para uma regra de negócio que o gestor pode corrigir.
      const status = RPC_ERROR_STATUS[rpcError.code ?? ""] ?? 500;
      return NextResponse.json({ error: rpcError.message }, { status });
    }

    // returns table (...) chega como array de uma linha pelo PostgREST.
    productsResult = (Array.isArray(rpcData) ? rpcData[0] : rpcData) ?? null;
  }

  if (Object.keys(update).length === 0) {
    const { data: cycle, error: readError } = await supabase
      .from("dash_gestao_ultimates_cycles")
      .select("*")
      .eq("id", id)
      .single();

    if (readError || !cycle) {
      return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ cycle, products: productsResult });
  }

  update.updated_at = new Date().toISOString();

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

  return NextResponse.json({ cycle: data, products: productsResult });
}

// Exclusão DEFINITIVA do ciclo. Não há soft delete: o estado "encerrado" já
// cobre o caso reversível (congela a operação, preserva os dados), então quem
// chega aqui quer o ciclo fora do banco.
//
// Um único DELETE basta — as tabelas filhas (buyers, manual_links,
// excluded_offers, excluded_buyers) têm `on delete cascade` no cycle_id
// (migrations 049/052/055), então nada fica órfão e nenhuma limpeza manual
// (nem transação) é necessária aqui.
//
// NÃO checamos refresh_started_at de propósito: esse lock tem TTL e já nasceu
// órfão uma vez (fetch Hotmart pendurado antes do finally). Amarrar a exclusão
// a ele tornaria o ciclo temporariamente inexcluível sem explicação visível. Um
// refresh em voo que tente gravar depois do DELETE simplesmente esbarra na FK e
// falha — sem resíduo, porque o cascade já levou tudo.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<Params> }) {
  const { error } = await requireRole(["gestor"]);
  if (error) return error;

  const { id } = await params;

  const supabase = createSupabaseServiceClient();
  // .select() após o delete é o que permite distinguir "apagou" de "não
  // existia" — sem ele o PostgREST devolve sucesso vazio nos dois casos.
  const { data, error: dbError } = await supabase
    .from("dash_gestao_ultimates_cycles")
    .delete()
    .eq("id", id)
    .select("id");

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ deleted: id });
}
