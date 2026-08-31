import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/utils/api-auth";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { unconfiguredSelection } from "@/lib/vendas/cycle-offers";
import type {
  UltimatesCycleRecord,
  UltimatesCycleProductRef,
  UltimatesCycleProductSelection,
} from "@/types/vendas";

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

function productKey(cycleId: string, productId: string): string {
  return `${cycleId}::${productId}`;
}

export async function GET() {
  const { error } = await requireRole(["gestor", "analista"]);
  if (error) return error;

  const supabase = createSupabaseServiceClient();

  const { data: cycles, error: cyclesError } = await supabase
    .from("dash_gestao_vendas_cycles")
    .select("*")
    .order("created_at", { ascending: false });

  if (cyclesError) {
    return NextResponse.json({ error: cyclesError.message }, { status: 500 });
  }

  const rows = (cycles ?? []) as UltimatesCycleRecord[];
  const cycleIds = rows.map((cycle) => cycle.id);

  const productsByCycle = new Map<string, CycleProductRow[]>();
  const allProductIds = new Set<string>();
  const includedByProduct = new Map<string, string[]>();
  const rejectedByProduct = new Map<string, string[]>();

  if (cycleIds.length > 0) {
    const { data: pairs, error: pairsError } = await supabase
      .from("dash_gestao_vendas_cycle_products")
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
      .from("dash_gestao_vendas_cycle_offers")
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
    products: (productsByCycle.get(cycle.id) ?? [])
      .map((row) => ({
        product_id: row.product_id,
        product_name: productNameById.get(row.product_id) ?? null,
        offer_codes: (includedByProduct.get(productKey(cycle.id, row.product_id)) ?? []).sort(),
        rejected_offer_codes: (
          rejectedByProduct.get(productKey(cycle.id, row.product_id)) ?? []
        ).sort(),
        include_offerless: row.include_offerless ?? null,
      }))
      .sort((a, b) =>
        (a.product_name ?? a.product_id).localeCompare(b.product_name ?? b.product_id, "pt-BR")
      ),
  }));

  return NextResponse.json({ cycles: withProducts });
}

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
  const { name, products: rawProducts, goalPercent, purchasesOnly, folderId } = body ?? {};

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

  const { selection, error: selectionError } = parseProductSelection(rawProducts);

  if (selectionError !== null) {
    return NextResponse.json({ error: selectionError }, { status: 400 });
  }

  const ids = selection.map((item) => item.product_id);

  const supabase = createSupabaseServiceClient();

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

  const { data: cycle, error: rpcError } = await supabase.rpc(
    "dash_gestao_vendas_create_cycle",
    {
      p_name: name.trim(),
      p_selection: selection,
      p_goal_percent: goalPercent ?? null,
      p_purchases_only: purchasesOnly ?? false,
      p_created_by: userId,
    }
  );

  if (rpcError) {
    const status = rpcError.code === "UL006" ? 400 : 500;
    return NextResponse.json({ error: rpcError.message }, { status });
  }

  if (folderId !== undefined) {
    const fId = typeof folderId === "string" && folderId.trim().length > 0 ? folderId.trim() : null;
    if (fId && cycle) {
      await supabase
        .from("dash_gestao_vendas_cycles")
        .update({ folder_id: fId })
        .eq("id", cycle.id);
      cycle.folder_id = fId;
    }
  }

  return NextResponse.json({ cycle }, { status: 201 });
}
