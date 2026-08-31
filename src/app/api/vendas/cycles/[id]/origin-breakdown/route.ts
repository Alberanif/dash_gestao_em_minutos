import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { originSourceFor } from "@/lib/vendas/origin-source";
import {
  aggregateOriginDimension,
  type OriginBaseRow,
  type OriginBreakdownBlock,
} from "@/lib/vendas/origin-breakdown";

/**
 * Dash Ultimates — origem das compras do ciclo.
 *
 * Cruza os emails das compras que a TELA JÁ ESTÁ EXIBINDO com a base de
 * inscritos do evento (ver src/lib/ultimates/origin-source.ts) e devolve só
 * agregados.
 *
 * POST, e não GET, por duas razões que andam juntas: os emails vêm no corpo
 * (são até algumas centenas, não cabem bem em query string) e a base de
 * inscritos NUNCA desce para o browser — o cruzamento acontece deste lado. É
 * uma leitura sem efeito colateral; o verbo é imposto pelo formato do payload.
 *
 * Por que o cliente manda os emails em vez de o servidor refazer o roster: os
 * emails enviados são exatamente as linhas que o usuário está vendo, com
 * recorte de datas, leads excluídos, ofertas excluídas e reembolsos já
 * aplicados pela RPC do roster. Refazer a contabilidade aqui abriria uma
 * segunda fonte de verdade que divergiria da tela no primeiro ajuste de regra.
 */

type Params = { id: string };

// Teto defensivo do corpo. O roster de um ciclo real tem ordem de centenas de
// linhas; qualquer coisa muito acima disso é abuso ou bug, não uso.
const MAX_EMAILS = 20000;

// PostgREST devolve no máximo 1000 linhas por requisição por padrão. A base de
// inscritos tem 724 hoje e é uma FOTO ESTÁTICA que pode ser reinserida maior —
// sem paginar, o dia em que ela passar de 1000 a coluna "Base" encolheria
// sozinha e a conversão de todo mundo subiria, sem erro nenhum na tela.
const PAGE_SIZE = 1000;

interface Body {
  emails?: unknown;
}

async function fetchBaseRows(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  table: string,
  columns: string[]
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  const rows: Record<string, unknown>[] = [];
  const select = columns.join(", ");

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + PAGE_SIZE - 1);

    if (error) return { rows: [], error: error.message };

    const page = (data as unknown as Record<string, unknown>[]) ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { rows, error: null };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { error } = await requireRole(["gestor", "analista"]);
  if (error) return error;

  const { id } = await params;

  // A configuração É a checagem de ciclo: só um ciclo tem base de origem, e a
  // chave do mapa é o id dele. Ciclo inexistente e ciclo sem cruzamento caem no
  // mesmo lugar de propósito — nenhum dos dois tem o que responder aqui.
  const config = originSourceFor(id);
  if (!config) {
    return NextResponse.json(
      { error: "Ciclo sem base de origem configurada" },
      { status: 404 }
    );
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!Array.isArray(body?.emails)) {
    return NextResponse.json({ error: "emails é obrigatório" }, { status: 400 });
  }
  if (body.emails.length > MAX_EMAILS) {
    return NextResponse.json({ error: "emails acima do limite" }, { status: 413 });
  }

  const purchaseEmails = body.emails.filter(
    (value): value is string => typeof value === "string"
  );

  const supabase = createSupabaseServiceClient();

  // Colunas vêm da configuração em código, nunca do request — ver o comentário
  // do topo de origin-source.ts. O Set evita repetir a coluna de email caso ela
  // também seja usada como dimensão.
  const columns = [...new Set([config.emailColumn, ...config.dimensions.map((d) => d.column)])];

  const { rows, error: baseError } = await fetchBaseRows(supabase, config.table, columns);

  if (baseError) {
    return NextResponse.json({ error: baseError }, { status: 500 });
  }

  const blocks: OriginBreakdownBlock[] = config.dimensions.map((dimension) => {
    const baseRows: OriginBaseRow[] = rows.map((row) => ({
      email: String(row[config.emailColumn] ?? ""),
      origin: row[dimension.column] == null ? null : String(row[dimension.column]),
    }));

    return {
      key: dimension.key,
      title: dimension.title,
      rows: aggregateOriginDimension(purchaseEmails, baseRows),
    };
  });

  return NextResponse.json({ blocks });
}
