import type { DebriefingProduct, FilterRecord } from "@/types/indicadores";

type LegacyFields = Pick<
  FilterRecord,
  "debriefing_products" | "main_hotmart_product" | "debriefing_offer_codes"
>;

/**
 * Única porta de leitura dos produtos principais do Debriefing.
 * 1) debriefing_products (array, mesmo vazio) vence;
 * 2) senão, main_hotmart_product + debriefing_offer_codes viram o 1º item;
 * 3) senão, lista vazia.
 */
export function resolveDebriefingProducts(filter: LegacyFields): DebriefingProduct[] {
  if (Array.isArray(filter.debriefing_products)) return filter.debriefing_products;
  if (filter.main_hotmart_product) {
    return [
      {
        product_id: filter.main_hotmart_product.product_id,
        product_name: filter.main_hotmart_product.product_name,
        offer_codes: filter.debriefing_offer_codes ?? [],
      },
    ];
  }
  return [];
}

export type DebriefingProductsValidation =
  | { ok: true; value: DebriefingProduct[] | null }
  | { ok: false; error: string };

/** Valida o corpo de POST/PUT. `null` limpa; offer_codes ausente vira []. */
export function validateDebriefingProducts(input: unknown): DebriefingProductsValidation {
  if (input === null) return { ok: true, value: null };
  if (!Array.isArray(input)) {
    return { ok: false, error: "debriefing_products must be an array or null" };
  }
  const seen = new Set<string>();
  const value: DebriefingProduct[] = [];
  for (let i = 0; i < input.length; i++) {
    const item = input[i] as Record<string, unknown> | null;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: `debriefing_products[${i}] must be an object` };
    }
    const { product_id, product_name, offer_codes } = item;
    if (typeof product_id !== "string" || product_id.trim() === "") {
      return { ok: false, error: `debriefing_products[${i}].product_id must be a non-empty string` };
    }
    if (typeof product_name !== "string" || product_name.trim() === "") {
      return { ok: false, error: `debriefing_products[${i}].product_name must be a non-empty string` };
    }
    if (
      offer_codes !== undefined &&
      (!Array.isArray(offer_codes) || !offer_codes.every((c) => typeof c === "string"))
    ) {
      return { ok: false, error: `debriefing_products[${i}].offer_codes must be an array of strings` };
    }
    if (seen.has(product_id)) {
      return { ok: false, error: `debriefing_products has duplicate product_id: ${product_id}` };
    }
    seen.add(product_id);
    value.push({ product_id, product_name, offer_codes: (offer_codes as string[] | undefined) ?? [] });
  }
  return { ok: true, value };
}
