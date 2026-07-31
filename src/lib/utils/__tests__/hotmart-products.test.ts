import { sortProductsByName } from "../hotmart-products";

describe("sortProductsByName", () => {
  it("ordena por nome em pt-BR", () => {
    const sorted = sortProductsByName([
      { product_id: "2", product_name: "Ávila" },
      { product_id: "1", product_name: "Abacaxi" },
    ]);
    expect(sorted.map((p) => p.product_id)).toEqual(["1", "2"]);
  });

  it("não muta o array recebido", () => {
    const input = [
      { product_id: "2", product_name: "B" },
      { product_id: "1", product_name: "A" },
    ];
    sortProductsByName(input);
    expect(input.map((p) => p.product_id)).toEqual(["2", "1"]);
  });

  // Sem a assinatura genérica, account_id sobrevive em runtime mas some do
  // tipo estático — e o modal precisa dele para travar a conta.
  it("preserva campos extras (account_id) no tipo e no valor", () => {
    const sorted = sortProductsByName([
      { product_id: "1", product_name: "A", account_id: "acc-1" },
    ]);
    expect(sorted[0].account_id).toBe("acc-1");
  });
});
