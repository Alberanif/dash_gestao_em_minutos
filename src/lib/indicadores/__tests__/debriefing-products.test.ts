import {
  resolveDebriefingProducts,
  validateDebriefingProducts,
} from "../debriefing-products";

describe("resolveDebriefingProducts", () => {
  const legacy = {
    main_hotmart_product: { product_id: "1", product_name: "Legado" },
    debriefing_offer_codes: ["a", "Sem Oferta"],
  };

  it("usa debriefing_products quando existe", () => {
    const list = [{ product_id: "9", product_name: "Novo", offer_codes: ["x"] }];
    expect(resolveDebriefingProducts({ ...legacy, debriefing_products: list })).toEqual(list);
  });

  it("lista vazia em debriefing_products vence o legado", () => {
    expect(resolveDebriefingProducts({ ...legacy, debriefing_products: [] })).toEqual([]);
  });

  it("null cai no legado: 1 item com as ofertas antigas", () => {
    expect(resolveDebriefingProducts({ ...legacy, debriefing_products: null })).toEqual([
      { product_id: "1", product_name: "Legado", offer_codes: ["a", "Sem Oferta"] },
    ]);
  });

  it("legado sem ofertas vira offer_codes []", () => {
    expect(
      resolveDebriefingProducts({
        main_hotmart_product: legacy.main_hotmart_product,
        debriefing_offer_codes: null,
      })
    ).toEqual([{ product_id: "1", product_name: "Legado", offer_codes: [] }]);
  });

  it("sem nada devolve []", () => {
    expect(resolveDebriefingProducts({})).toEqual([]);
    expect(
      resolveDebriefingProducts({ debriefing_products: null, main_hotmart_product: null })
    ).toEqual([]);
  });
});

describe("validateDebriefingProducts", () => {
  const ok = { product_id: "1", product_name: "A", offer_codes: ["x"] };

  it("null limpa", () => {
    expect(validateDebriefingProducts(null)).toEqual({ ok: true, value: null });
  });

  it("aceita [] e item válido", () => {
    expect(validateDebriefingProducts([])).toEqual({ ok: true, value: [] });
    expect(validateDebriefingProducts([ok])).toEqual({ ok: true, value: [ok] });
  });

  it("offer_codes ausente vira []", () => {
    expect(validateDebriefingProducts([{ product_id: "1", product_name: "A" }])).toEqual({
      ok: true,
      value: [{ product_id: "1", product_name: "A", offer_codes: [] }],
    });
  });

  it.each([
    ["não-array", "x"],
    ["objeto", {}],
    ["item não objeto", ["x"]],
    ["item null", [null]],
    ["product_id vazio", [{ ...ok, product_id: " " }]],
    ["product_id número", [{ ...ok, product_id: 1 }]],
    ["product_name vazio", [{ ...ok, product_name: "" }]],
    ["product_name ausente", [{ product_id: "1" }]],
    ["offer_codes não array", [{ ...ok, offer_codes: "a" }]],
    ["offer_codes com não string", [{ ...ok, offer_codes: ["a", 2] }]],
    ["product_id repetido", [ok, { ...ok, product_name: "B" }]],
  ])("rejeita %s", (_n, input) => {
    const r = validateDebriefingProducts(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/debriefing_products/);
  });
});
