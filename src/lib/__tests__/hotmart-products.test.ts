import { sortProductsByName } from "@/lib/utils/hotmart-products";

describe("sortProductsByName()", () => {
  it("sorts alphabetically with pt-BR locale", () => {
    const input = [
      { product_id: "3", product_name: "Carro" },
      { product_id: "1", product_name: "Arroz" },
      { product_id: "2", product_name: "Banana" },
    ];
    const result = sortProductsByName(input);
    expect(result.map((p) => p.product_name)).toEqual(["Arroz", "Banana", "Carro"]);
  });

  it("handles empty array", () => {
    expect(sortProductsByName([])).toEqual([]);
  });

  it("preserves product_id and product_name fields in output", () => {
    const input = [
      { product_id: "abc-123", product_name: "Produto X" },
      { product_id: "def-456", product_name: "Produto A" },
    ];
    const result = sortProductsByName(input);
    expect(result[0]).toEqual({ product_id: "def-456", product_name: "Produto A" });
    expect(result[1]).toEqual({ product_id: "abc-123", product_name: "Produto X" });
  });

  it("sorts case-insensitively with pt-BR locale", () => {
    const input = [
      { product_id: "2", product_name: "banana" },
      { product_id: "1", product_name: "Arroz" },
      { product_id: "3", product_name: "Carro" },
    ];
    const result = sortProductsByName(input);
    expect(result[0].product_name).toBe("Arroz");
    expect(result[1].product_name).toBe("banana");
    expect(result[2].product_name).toBe("Carro");
  });

  it("does not mutate the original array", () => {
    const input = [
      { product_id: "2", product_name: "Zebra" },
      { product_id: "1", product_name: "Abacaxi" },
    ];
    const copy = [...input];
    sortProductsByName(input);
    expect(input).toEqual(copy);
  });
});
