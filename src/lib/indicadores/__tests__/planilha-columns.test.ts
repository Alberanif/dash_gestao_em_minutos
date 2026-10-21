import { planilhaBlocksFor } from "../planilha-columns";

describe("planilhaBlocksFor", () => {
  it("modo pago exibe todos os blocos", () => {
    expect(planilhaBlocksFor(false)).toEqual({ meta: true, leads: true, vendas: true, resumo: true });
  });
  it("modo orgânico oculta vendas e resumo (receita/ROAS/vendas) e mantém meta e leads", () => {
    expect(planilhaBlocksFor(true)).toEqual({ meta: true, leads: true, vendas: false, resumo: false });
  });
});
