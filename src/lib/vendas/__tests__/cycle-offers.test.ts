import {
  isProductConfigured,
  unconfiguredProducts,
  isCycleConfigured,
  unconfiguredSelection,
  pendingOffers,
  pendingSalesCount,
} from "../cycle-offers";
import type {
  UltimatesCycleProductRef,
  UltimatesOfferOption,
  UltimatesOfferlessOption,
} from "@/types/vendas";

function produto(overrides: Partial<UltimatesCycleProductRef> = {}): UltimatesCycleProductRef {
  return {
    product_id: "p1",
    product_name: "Produto Um",
    offer_codes: [],
    rejected_offer_codes: [],
    include_offerless: null,
    ...overrides,
  };
}

function oferta(overrides: Partial<UltimatesOfferOption> = {}): UltimatesOfferOption {
  return {
    offer_code: "OF-1",
    offer_name: "Oferta Principal",
    product_id: "p1",
    product_name: "Produto Um",
    sales_count: 10,
    ...overrides,
  };
}

describe("isProductConfigured", () => {
  it("uma oferta escolhida basta", () => {
    expect(isProductConfigured(produto({ offer_codes: ["OF-1"] }))).toBe(true);
  });

  // Custa um booleano e impede que a venda sem offer_code suma sem ninguém ver
  // que ela existia (decisão 5 da entrevista).
  it("marcar só '(sem oferta)' basta", () => {
    expect(isProductConfigured(produto({ include_offerless: true }))).toBe(true);
  });

  // Um produto do qual nada conta é indistinguível de um produto que não
  // deveria estar no ciclo, e a segunda leitura é sempre a correta.
  it("recusar TODAS as ofertas NÃO configura", () => {
    expect(
      isProductConfigured(produto({ rejected_offer_codes: ["OF-1", "OF-2"], include_offerless: false }))
    ).toBe(false);
  });

  it("include_offerless false é decisão tomada, não escolha de incluir", () => {
    expect(isProductConfigured(produto({ include_offerless: false }))).toBe(false);
  });
});

describe("unconfiguredProducts / isCycleConfigured", () => {
  it("devolve só os produtos sem escolha, preservando o objeto original", () => {
    const bom = produto({ product_id: "p1", offer_codes: ["OF-1"] });
    const ruim = produto({ product_id: "p2" });
    expect(unconfiguredProducts([bom, ruim])).toEqual([ruim]);
  });

  it("basta UM produto sem escolha para o ciclo não estar configurado", () => {
    expect(
      isCycleConfigured([produto({ product_id: "p1", offer_codes: ["OF-1"] }), produto({ product_id: "p2" })])
    ).toBe(false);
  });

  it("todos com escolha: ciclo configurado", () => {
    expect(
      isCycleConfigured([
        produto({ product_id: "p1", offer_codes: ["OF-1"] }),
        produto({ product_id: "p2", include_offerless: true }),
      ])
    ).toBe(true);
  });

  // Ciclo sem produto nenhum já é recusado desde a 061. Devolver true aqui
  // faria o dashboard renderizar números de um universo vazio em vez do estado
  // que explica o que falta.
  it("ciclo SEM produto nenhum não é configurado", () => {
    expect(isCycleConfigured([])).toBe(false);
  });
});

describe("unconfiguredSelection", () => {
  it("devolve os product_ids sem escolha; vazio significa pode salvar", () => {
    expect(
      unconfiguredSelection([
        { product_id: "p1", offer_codes: ["OF-1"], rejected_offer_codes: [], include_offerless: null },
        { product_id: "p2", offer_codes: [], rejected_offer_codes: ["OF-9"], include_offerless: false },
      ])
    ).toEqual(["p2"]);
  });
});

describe("pendingOffers", () => {
  const produtos = [produto({ product_id: "p1", offer_codes: ["OF-1"], include_offerless: false })];

  it("oferta escolhida não é pendência", () => {
    expect(pendingOffers(produtos, [oferta({ offer_code: "OF-1" })], [])).toEqual([]);
  });

  // A razão de rejected_offer_codes existir: sem a distinção, toda cortesia
  // desmarcada de propósito alertaria para sempre e o aviso viraria ruído.
  it("oferta RECUSADA não é pendência", () => {
    const comRecusa = [
      produto({ product_id: "p1", offer_codes: ["OF-1"], rejected_offer_codes: ["OF-2"], include_offerless: false }),
    ];
    expect(pendingOffers(comRecusa, [oferta({ offer_code: "OF-2" })], [])).toEqual([]);
  });

  it("oferta que ninguém decidiu vira pendência, com nome e contagem", () => {
    expect(
      pendingOffers(produtos, [oferta({ offer_code: "OF-2", offer_name: "Cortesia Black", sales_count: 9 })], [])
    ).toEqual([
      { product_id: "p1", offer_code: "OF-2", offer_name: "Cortesia Black", sales_count: 9 },
    ]);
  });

  it("oferta de produto FORA do ciclo não é pendência de ninguém", () => {
    expect(
      pendingOffers(produtos, [oferta({ offer_code: "OF-X", product_id: "p9" })], [])
    ).toEqual([]);
  });

  it("venda sem offer_code pendente entra como offer_code null", () => {
    const semDecisao = [produto({ product_id: "p1", offer_codes: ["OF-1"], include_offerless: null })];
    const offerless: UltimatesOfferlessOption[] = [{ product_id: "p1", sales_count: 3 }];
    expect(pendingOffers(semDecisao, [], offerless)).toEqual([
      { product_id: "p1", offer_code: null, offer_name: null, sales_count: 3 },
    ]);
  });

  it("include_offerless já decidido (mesmo que false) não é pendência", () => {
    const offerless: UltimatesOfferlessOption[] = [{ product_id: "p1", sales_count: 3 }];
    expect(pendingOffers(produtos, [], offerless)).toEqual([]);
  });

  it("linha offerless com contagem 0 não vira aviso sobre nada", () => {
    const semDecisao = [produto({ product_id: "p1", offer_codes: ["OF-1"], include_offerless: null })];
    expect(pendingOffers(semDecisao, [], [{ product_id: "p1", sales_count: 0 }])).toEqual([]);
  });
});

describe("pendingSalesCount", () => {
  it("soma as vendas represadas — o número que a faixa mostra", () => {
    const pendentes = pendingOffers(
      [produto({ product_id: "p1", offer_codes: [], include_offerless: null })],
      [
        oferta({ offer_code: "OF-2", sales_count: 9 }),
        oferta({ offer_code: "OF-3", sales_count: 5 }),
      ],
      [{ product_id: "p1", sales_count: 3 }]
    );
    expect(pendentes).toHaveLength(3);
    expect(pendingSalesCount(pendentes)).toBe(17);
  });

  it("sem pendência, soma zero", () => {
    expect(pendingSalesCount([])).toBe(0);
  });
});
