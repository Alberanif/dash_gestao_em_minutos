import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { listAllUsers } from "@/lib/supabase/list-all-users";
import type { UltimatesExcludedBuyerRecord } from "@/types/ultimates";

/**
 * Dash Ultimates — leads excluídos da contabilidade do ciclo
 * (PRD docs/PRD_2026-07-30_ultimates_editar_roster.md, seção 6.4).
 *
 * A lista é POR CICLO e não apaga nada: nem a linha de
 * dash_gestao_ultimates_buyers, nem venda alguma. Quem aplica o efeito são as
 * RPCs de leitura (migration 055), que descartam o email dos DOIS lados — fora
 * da base e fora do universo de vendas. Por isso remover uma linha daqui basta
 * para devolver o lead inteiro (com vendas e vínculos) à contabilidade, sem
 * refresh nem reprocessamento.
 *
 * A chave é o EMAIL NORMALIZADO e não o buyer_id — ver o comentário em
 * UltimatesExcludedBuyerRecord.
 *
 * DIFERENTE do upload da base, do vínculo manual e do refresh, ciclo encerrado
 * NÃO bloqueia: um email de teste descoberto depois do encerramento também
 * suja o histórico (decisão 13 do PRD, mesmo racional de excluded-offers). Não
 * introduza checagem de status aqui achando que é uma inconsistência esquecida.
 */

type Params = { id: string };

const MAX_NOTE_LENGTH = 200;

interface WriteBody {
  email?: unknown;
  note?: unknown;
}

// Mesma expressão do join das RPCs (lower(btrim(...))) e do que o upload já
// grava em dash_gestao_ultimates_buyers — por isso as comparações com a base
// podem usar `.eq()` puro, sem ilike (que trataria `_` de emails como coringa).
function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
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
    .from("dash_gestao_ultimates_excluded_buyers")
    .select("id, cycle_id, email, note, excluded_by, created_at")
    .eq("cycle_id", id)
    .order("created_at", { ascending: false });

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const rows = (data as UltimatesExcludedBuyerRecord[]) ?? [];
  const emails = rows.map((row) => row.email);

  // O nome vem da base do ciclo, não da tabela de exclusão: a exclusão guarda
  // só o email (é a chave) e o nome pode ter sido corrigido depois. Fica null
  // quando o email saiu do CSV — a exclusão sobrevive ao upload, a linha da
  // base não.
  const nameByEmail = new Map<string, string | null>();
  if (emails.length > 0) {
    const { data: buyers } = await supabase
      .from("dash_gestao_ultimates_buyers")
      .select("email, name")
      .eq("cycle_id", id)
      .in("email", emails);

    for (const buyer of (buyers as Array<{ email: string; name: string | null }>) ?? []) {
      nameByEmail.set(buyer.email, buyer.name);
    }
  }

  const emailById = await resolveAuthorEmails(
    supabase,
    rows.map((row) => row.excluded_by)
  );

  return NextResponse.json({
    buyers: rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: nameByEmail.get(row.email) ?? null,
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
  const email = normalizeEmail(body?.email);
  const rawNote = typeof body?.note === "string" ? body.note.trim() : "";

  if (!email) {
    return NextResponse.json({ error: "email é obrigatório" }, { status: 400 });
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

  // A ação só existe em linhas da BASE (decisão 4 do PRD): excluir um email
  // que só aparece como novo comprador seria excluir uma venda, que é
  // deliberadamente outro mecanismo (ofertas excluídas).
  const { data: buyer, error: buyerError } = await supabase
    .from("dash_gestao_ultimates_buyers")
    .select("id, email, name")
    .eq("cycle_id", id)
    .eq("email", email)
    .single();

  if (buyerError || !buyer) {
    return NextResponse.json(
      { error: "Email não pertence à base deste ciclo" },
      { status: 400 }
    );
  }

  const { data: created, error: insertError } = await supabase
    .from("dash_gestao_ultimates_excluded_buyers")
    .insert({
      cycle_id: id,
      email,
      note: rawNote === "" ? null : rawNote.slice(0, MAX_NOTE_LENGTH),
      excluded_by: userId,
    })
    .select()
    .single();

  // Duplicidade resolvida pela constraint uq_ultimates_excluded_buyers, não por
  // um SELECT antes do INSERT — dois cliques simultâneos não criam duas linhas.
  if (insertError) {
    const status = insertError.code === "23505" ? 409 : 500;
    return NextResponse.json(
      { error: status === 409 ? "Lead já excluído neste ciclo" : insertError.message },
      { status }
    );
  }

  return NextResponse.json({ buyer: created }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { error } = await requireRole(["gestor"]);
  if (error) return error;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as WriteBody | null;
  const email = normalizeEmail(body?.email);

  if (!email) {
    return NextResponse.json({ error: "email é obrigatório" }, { status: 400 });
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

  // Escopo por cycle_id é obrigatório: o mesmo email pode estar excluído em
  // outro ciclo do mesmo produto, e aquele filtro não é nosso para desfazer.
  const { data: removed, error: deleteError } = await supabase
    .from("dash_gestao_ultimates_excluded_buyers")
    .delete()
    .eq("cycle_id", id)
    .eq("email", email)
    .select("id");

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (!removed || removed.length === 0) {
    return NextResponse.json(
      { error: "Lead não está excluído neste ciclo" },
      { status: 404 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
