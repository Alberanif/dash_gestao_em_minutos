import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { unconfiguredSelection } from "@/lib/ultimates/cycle-offers";
import type {
  UltimatesCycleRecord,
  UltimatesCycleProductRef,
  UltimatesCycleProductSelection,
} from "@/types/ultimates";

// Ciclo com o conjunto de produtos anexado. O join é manual (três queries em
// memória) porque as tabelas não têm FK direto para join via PostgREST —
// mesma razão do join de produto que existia antes da migration 061.
export interface UltimatesCycleWithProducts extends UltimatesCycleRecord {
  products: UltimatesCycleProductRef[];
}

type CycleProductRow = {
  cycle_id: string;
  product_id: string;
  include_offerless: boolean | null;
};

type CycleOfferRow = {
  cycle_id: string;
  product_id: string;
  offer_code: string;
  included: boolean;
};

// Chave do par (ciclo, produto): as ofertas de cycle_offers são escopadas pelos
// dois, e um ciclo multi-produto tem várias linhas por cycle_id.
function productKey(cycleId: string, productId: string): string {
  return `${cycleId}::${productId}`;
}

export async function GET() {
  const { error } = await requireRole(["gestor", "analista"]);
  if (error) return error;

  const supabase = createSupabaseServiceClient();

  const { data: cycles, error: cyclesError } = await supabase
    .from("dash_gestao_ultimates_cycles")
    .select("*")
    .order("created_at", { ascending: false });

  if (cyclesError) {
    return NextResponse.json({ error: cyclesError.message }, { status: 500 });
  }

  const rows = (cycles ?? []) as UltimatesCycleRecord[];
  const cycleIds = rows.map((cycle) => cycle.id);

  const productsByCycle = new Map<string, CycleProductRow[]>();
  const allProductIds = new Set<string>();
  // Ofertas ESCOLHIDAS e RECUSADAS, por par (ciclo, produto). São listas
  // separadas de propósito: "recusada" é uma decisão registrada, e é ela que
  // impede o aviso de oferta nova de gritar para sempre (ver o comentário de
  // rejected_offer_codes em src/types/ultimates.ts).
  const includedByProduct = new Map<string, string[]>();
  const rejectedByProduct = new Map<string, string[]>();

  if (cycleIds.length > 0) {
    const { data: pairs, error: pairsError } = await supabase
      .from("dash_gestao_ultimates_cycle_products")
      .select("cycle_id, product_id, include_offerless")
      .in("cycle_id", cycleIds);

    if (pairsError) {
      return NextResponse.json({ error: pairsError.message }, { status: 500 });
    }

    for (const pair of (pairs ?? []) as CycleProductRow[]) {
      const list = productsByCycle.get(pair.cycle_id) ?? [];
      list.push(pair);
      productsByCycle.set(pair.cycle_id, list);
      allProductIds.add(pair.product_id);
    }

    const { data: offers, error: offersError } = await supabase
      .from("dash_gestao_ultimates_cycle_offers")
      .select("cycle_id, product_id, offer_code, included")
      .in("cycle_id", cycleIds);

    if (offersError) {
      return NextResponse.json({ error: offersError.message }, { status: 500 });
    }

    for (const offer of (offers ?? []) as CycleOfferRow[]) {
      const bucket = offer.included === true ? includedByProduct : rejectedByProduct;
      const key = productKey(offer.cycle_id, offer.product_id);
      const list = bucket.get(key) ?? [];
      list.push(offer.offer_code);
      bucket.set(key, list);
    }
  }

  const productNameById = new Map<string, string>();

  if (allProductIds.size > 0) {
    const { data: products, error: productsError } = await supabase
      .from("dash_gestao_hotmart_products")
      .select("product_id, product_name")
      .in("product_id", Array.from(allProductIds));

    if (productsError) {
      return NextResponse.json({ error: productsError.message }, { status: 500 });
    }

    for (const product of (products ?? []) as { product_id: string; product_name: string }[]) {
      productNameById.set(product.product_id, product.product_name);
    }
  }

  const withProducts: UltimatesCycleWithProducts[] = rows.map((cycle) => ({
    ...cycle,
    // Ordem por nome para o header do dashboard ser estável entre requisições
    // — o PostgREST não garante ordem numa tabela sem order by.
    products: (productsByCycle.get(cycle.id) ?? [])
      .map((row) => ({
        product_id: row.product_id,
        product_name: productNameById.get(row.product_id) ?? null,
        // Ofertas em ordem estável pela mesma razão dos produtos: o PostgREST
        // não garante ordem, e o cliente compara estas listas entre renders.
        offer_codes: (includedByProduct.get(productKey(cycle.id, row.product_id)) ?? []).sort(),
        rejected_offer_codes: (
          rejectedByProduct.get(productKey(cycle.id, row.product_id)) ?? []
        ).sort(),
        // `?? null` e não `?? false`: null é "ninguém decidiu ainda" (ciclo
        // anterior à 065, ou banco sem a coluna), e é o que faz o aviso de
        // oferta nova distinguir pendência de recusa.
        include_offerless: row.include_offerless ?? null,
      }))
      .sort((a, b) =>
        (a.product_name ?? a.product_id).localeCompare(b.product_name ?? b.product_id, "pt-BR")
      ),
  }));

  return NextResponse.json({ cycles: withProducts });
}

// Normaliza o `products` do corpo: dedup, poda de lixo e as duas checagens que
// só o payload pode responder. Devolve `error` com a MENSAGEM pronta, nunca um
// código — quem lê isto é o gestor no modal.
//
// Duplicada em cycles/[id]/route.ts de propósito: um route.ts do App Router só
// pode exportar handlers HTTP (qualquer outro export vira erro de tipo na
// rota), então não há como as duas rotas compartilharem isto sem um módulo em
// src/lib — e a invariante que REALMENTE precisa ser a mesma nos dois lados já
// mora lá, em unconfiguredSelection.
type ParsedSelection =
  | { selection: UltimatesCycleProductSelection[]; error: null }
  | { selection: null; error: string };

function parseProductSelection(raw: unknown): ParsedSelection {
  if (!Array.isArray(raw)) {
    return { selection: null, error: "Selecione ao menos um produto" };
  }

  const byProduct = new Map<string, UltimatesCycleProductSelection>();

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;

    const entry = item as Record<string, unknown>;
    const productId = typeof entry.product_id === "string" ? entry.product_id.trim() : "";
    if (productId.length === 0) continue;
    // Primeira ocorrência vence. Fundir duas entradas do mesmo produto
    // silenciosamente juntaria decisões contraditórias (uma oferta escolhida
    // numa e recusada na outra) num conjunto que ninguém pediu.
    if (byProduct.has(productId)) continue;

    if (entry.offer_codes !== undefined && !Array.isArray(entry.offer_codes)) {
      return { selection: null, error: "offer_codes deve ser um array" };
    }
    if (entry.rejected_offer_codes !== undefined && !Array.isArray(entry.rejected_offer_codes)) {
      return { selection: null, error: "rejected_offer_codes deve ser um array" };
    }
    if (
      entry.include_offerless !== undefined &&
      entry.include_offerless !== null &&
      typeof entry.include_offerless !== "boolean"
    ) {
      return { selection: null, error: "include_offerless deve ser booleano ou null" };
    }

    // Dedup dos códigos dentro do produto: a PK (cycle_id, offer_code) de
    // cycle_offers rejeitaria a duplicata com um 23505 que não diz nada.
    const codes = (list: unknown): string[] =>
      Array.from(
        new Set(
          ((list ?? []) as unknown[])
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter((value) => value.length > 0)
        )
      );

    const offerCodes = codes(entry.offer_codes);
    const rejectedCodes = codes(entry.rejected_offer_codes);

    const conflito = offerCodes.find((code) => rejectedCodes.includes(code));
    if (conflito !== undefined) {
      return {
        selection: null,
        error: `Oferta ${conflito} não pode estar escolhida e recusada ao mesmo tempo`,
      };
    }

    byProduct.set(productId, {
      product_id: productId,
      offer_codes: offerCodes,
      rejected_offer_codes: rejectedCodes,
      include_offerless: (entry.include_offerless as boolean | null | undefined) ?? null,
    });
  }

  const selection = Array.from(byProduct.values());

  if (selection.length === 0) {
    return { selection: null, error: "Selecione ao menos um produto" };
  }

  // A invariante da 065: produto sem NENHUMA escolha (nem oferta, nem "(sem
  // oferta)") não entra em ciclo nenhum. A RPC repete a checagem e levanta
  // UL006 — esta aqui existe só pela mensagem, que nomeia os produtos.
  const semEscolha = unconfiguredSelection(selection);
  if (semEscolha.length > 0) {
    return {
      selection: null,
      error: `Selecione ao menos uma oferta para: ${semEscolha.join(", ")}`,
    };
  }

  return { selection, error: null };
}

export async function POST(request: NextRequest) {
  const { error, userId } = await requireRole(["gestor"]);
  if (error) return error;

  const body = await request.json().catch(() => null);
  const { name, products: rawProducts, goalPercent, purchasesOnly } = body ?? {};

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name é obrigatório" }, { status: 400 });
  }

  if (purchasesOnly !== undefined && typeof purchasesOnly !== "boolean") {
    return NextResponse.json({ error: "purchasesOnly deve ser booleano" }, { status: 400 });
  }

  if (goalPercent !== undefined && goalPercent !== null) {
    if (typeof goalPercent !== "number" || Number.isNaN(goalPercent) || goalPercent < 0 || goalPercent > 100) {
      return NextResponse.json(
        { error: "goalPercent deve ser numérico entre 0 e 100" },
        { status: 400 }
      );
    }
  }

  // O corpo carrega o conjunto de produtos COM as ofertas de cada um desde a
  // migration 065: o ciclo não acompanha mais o produto inteiro.
  const { selection, error: selectionError } = parseProductSelection(rawProducts);

  if (selectionError !== null) {
    return NextResponse.json({ error: selectionError }, { status: 400 });
  }

  const ids = selection.map((item) => item.product_id);

  const supabase = createSupabaseServiceClient();

  // As checagens abaixo (e a de oferta, em parseProductSelection) existem SÓ
  // pela mensagem: quem garante a invariante é
  // dash_gestao_ultimates_create_cycle, que repete todas e levanta exceção. Não
  // remova a validação da RPC confiando nesta.
  const { data: products, error: productsError } = await supabase
    .from("dash_gestao_hotmart_products")
    .select("product_id, account_id")
    .in("product_id", ids);

  if (productsError) {
    return NextResponse.json({ error: productsError.message }, { status: 500 });
  }

  const found = (products ?? []) as { product_id: string; account_id: string }[];

  if (found.length !== ids.length) {
    return NextResponse.json(
      {
        error:
          "Produto não encontrado. Rode o sync de produtos em /api/hotmart/sync-products e tente novamente.",
      },
      { status: 400 }
    );
  }

  if (new Set(found.map((product) => product.account_id)).size > 1) {
    return NextResponse.json(
      { error: "Todos os produtos devem ser da mesma conta Hotmart" },
      { status: 400 }
    );
  }

  // purchases_only entra pela RPC, não por um update depois: o modo do ciclo é
  // imutável após a criação (PRD da 059) e um segundo statement poderia falhar
  // deixando um ciclo de renovação onde o gestor pediu Apenas Compras.
  const { data: cycle, error: rpcError } = await supabase.rpc(
    "dash_gestao_ultimates_create_cycle",
    {
      p_name: name.trim(),
      // jsonb com o conjunto INTEIRO (produto + ofertas + include_offerless):
      // um text[] de produtos não teria onde carregar a escolha de ofertas, e
      // duas chamadas deixariam o ciclo nascer sem oferta se a segunda falhasse.
      p_selection: selection,
      p_goal_percent: goalPercent ?? null,
      p_purchases_only: purchasesOnly ?? false,
      p_created_by: userId,
    }
  );

  if (rpcError) {
    // UL006 = produto sem oferta escolhida (migration 065). É regra de negócio
    // que o gestor corrige na tela, não falha do servidor: só chega aqui se a
    // checagem acima for contornada, e mesmo assim precisa voltar como 400.
    const status = rpcError.code === "UL006" ? 400 : 500;
    return NextResponse.json({ error: rpcError.message }, { status });
  }

  return NextResponse.json({ cycle }, { status: 201 });
}
