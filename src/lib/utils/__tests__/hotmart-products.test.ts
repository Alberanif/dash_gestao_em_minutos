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

  // Jest NÃO type-checa neste repositório: tsconfig.json tem
  // isolatedModules: true, então ts-jest é transpile-only e até um
  // `const x: number = "texto"` passaria. Este teste prova, portanto, apenas a
  // preservação em RUNTIME.
  //
  // A garantia de TIPO — que é a razão de ser da assinatura genérica, porque o
  // modal de ciclo precisa de account_id no tipo estático — é verificada pelo
  // compilador, não por aqui:
  //
  //   npx tsc --noEmit --strict --skipLibCheck --esModuleInterop --target es2020 \
  //     --moduleResolution node --types jest,node \
  //     src/lib/utils/hotmart-products.ts \
  //     src/lib/utils/__tests__/hotmart-products.test.ts
  //
  // Com a assinatura literal antiga, esse comando acusa TS2353 na linha do
  // objeto e TS2339 na linha do expect. Sem ele, esta suíte passaria verde com
  // a regressão instalada.
  it("preserva campos extras (account_id) no valor devolvido", () => {
    const sorted = sortProductsByName([
      { product_id: "1", product_name: "A", account_id: "acc-1" },
    ]);
    expect(sorted[0].account_id).toBe("acc-1");
  });
});
