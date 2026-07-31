import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { listAllUsers } from "@/lib/supabase/list-all-users";
import type { UltimatesExcludedOfferRecord } from "@/types/ultimates";

/**
 * Dash Ultimates — ofertas excluídas da contabilidade do ciclo
 * (PRD docs/PRD_2026-07-30_ultimates_excluir_ofertas.md, seção 6.4).
 *
 * A lista é POR CICLO e não altera nenhuma venda: quem aplica o efeito são as
 * RPCs de leitura (migration 052), que descartam do universo as vendas cujo
 * offer_code está aqui. Por isso remover uma linha basta para devolver as
 * vendas à contabilidade — não há reprocessamento nem refresh envolvido.
 *
 * DIFERENTE das demais escritas do módulo, ciclo encerrado NÃO bloqueia: uma
 * compra de teste descoberta depois do encerramento também suja o histórico
 * (decisão 8 do PRD). Não introduza checagem de status aqui achando que é uma
 * inconsistência esquecida.
 */

type Params = { id: string };

const MAX_NOTE_LENGTH = 200;

interface WriteBody {
  offerCode?: unknown;
  note?: unknown;
}

// Resolve o email de quem excluiu para exibição na lista. Uma falha aqui é
// cosmética — a lista continua útil sem o autor —, então nunca derruba o GET.
async function resolveAuthorEmails(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  userIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;

  const { users, error } = await listAllUsers(supabase);
  if (error) return map;

  for (const user of users) {
    if (user.email) map.set(user.id, user.email);
  }
  return map;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { error } = await requireRole(["gestor", "analista"]);
  if (error) return error;

  const { id } = await params;
  const supabase = createSupabaseServiceClient();

  const { data: cycle, error: cycleError } = await supabase
    .from("dash_gestao_ultimates_cycles")
    .select("id, status")
    .eq("id", id)
    .single();

  if (cycleError || !cycle) {
    return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  }

  const { data, error: listError } = await supabase
    .from("dash_gestao_ultimates_excluded_offers")
    .select("id, cycle_id, offer_code, note, excluded_by, created_at")
    .eq("cycle_id", id)
    .order("created_at", { ascending: false });

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const rows = (data as UltimatesExcludedOfferRecord[]) ?? [];
  const codes = rows.map((row) => row.offer_code);

  // Nome da oferta vem de dash_gestao_hotmart_offers — a tabela de exclusão
  // guarda só o código (o nome pode mudar num sync futuro e não é dado nosso).
  const nameByCode = new Map<string, string>();
  if (codes.length > 0) {
    const { data: offers } = await supabase
      .from("dash_gestao_hotmart_offers")
      .select("offer_code, offer_name")
      .in("offer_code", codes);

    for (const offer of (offers as Array<{ offer_code: string; offer_name: string }>) ?? []) {
      nameByCode.set(offer.offer_code, offer.offer_name);
    }
  }

  const emailById = await resolveAuthorEmails(
    supabase,
    rows.map((row) => row.excluded_by)
  );

  return NextResponse.json({
    offers: rows.map((row) => ({
      id: row.id,
      offer_code: row.offer_code,
      offer_name: nameByCode.get(row.offer_code) ?? null,
      note: row.note,
      excluded_by: row.excluded_by,
      excluded_by_email: emailById.get(row.excluded_by) ?? null,
      created_at: row.created_at,
    })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { error, userId } = await requireRole(["gestor"]);
  if (error) return error;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as WriteBody | null;
  const offerCode = typeof body?.offerCode === "string" ? body.offerCode.trim() : "";
  const rawNote = typeof body?.note === "string" ? body.note.trim() : "";

  if (!offerCode) {
    return NextResponse.json({ error: "offerCode é obrigatório" }, { status: 400 });
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

  const { data: cycleProducts, error: cycleProductsError } = await supabase
    .from("dash_gestao_ultimates_cycle_products")
    .select("product_id")
    .eq("cycle_id", id);

  if (cycleProductsError) {
    return NextResponse.json({ error: cycleProductsError.message }, { status: 500 });
  }

  const cycleProductIds = new Set(
    ((cycleProducts ?? []) as { product_id: string }[]).map((row) => row.product_id)
  );

  const { data: offer, error: offerError } = await supabase
    .from("dash_gestao_hotmart_offers")
    .select("offer_code, offer_name, product_id")
    .eq("offer_code", offerCode)
    .single();

  // A oferta precisa ser de algum produto do ciclo: excluir oferta de fora não
  // teria efeito (o universo das RPCs já é filtrado por produto) e daria ao
  // gestor a impressão de ter resolvido algo.
  if (offerError || !offer || !cycleProductIds.has(offer.product_id)) {
    return NextResponse.json(
      { error: "Oferta não encontrada para os produtos deste ciclo" },
      { status: 400 }
    );
  }

  const { data: created, error: insertError } = await supabase
    .from("dash_gestao_ultimates_excluded_offers")
    .insert({
      cycle_id: id,
      offer_code: offerCode,
      note: rawNote === "" ? null : rawNote.slice(0, MAX_NOTE_LENGTH),
      excluded_by: userId,
    })
    .select()
    .single();

  // Duplicidade resolvida pela constraint uq_ultimates_excluded_offers, não
  // por um SELECT antes do INSERT — dois cliques simultâneos não criam duas
  // linhas.
  if (insertError) {
    const status = insertError.code === "23505" ? 409 : 500;
    return NextResponse.json(
      {
        error:
          status === 409 ? "Oferta já excluída neste ciclo" : insertError.message,
      },
      { status }
    );
  }

  return NextResponse.json({ offer: created }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { error } = await requireRole(["gestor"]);
  if (error) return error;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as WriteBody | null;
  const offerCode = typeof body?.offerCode === "string" ? body.offerCode.trim() : "";

  if (!offerCode) {
    return NextResponse.json({ error: "offerCode é obrigatório" }, { status: 400 });
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

  // Escopo por cycle_id é obrigatório: o mesmo offer_code pode estar excluído
  // em outro ciclo do mesmo produto, e aquele filtro não é nosso para desfazer.
  const { data: removed, error: deleteError } = await supabase
    .from("dash_gestao_ultimates_excluded_offers")
    .delete()
    .eq("cycle_id", id)
    .eq("offer_code", offerCode)
    .select("id");

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (!removed || removed.length === 0) {
    return NextResponse.json(
      { error: "Oferta não está excluída neste ciclo" },
      { status: 404 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
