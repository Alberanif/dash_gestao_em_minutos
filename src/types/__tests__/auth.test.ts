import { resolveAccountRole } from "../auth";

/**
 * `app_metadata.role` é dado externo: vem do Supabase e pode ter sido escrito
 * à mão no painel. A resolução é o único ponto que decide o que aquele valor
 * bruto significa, e o default seguro é sempre `pendente` (bloqueio).
 */
describe("resolveAccountRole", () => {
  it("preserva as roles de acesso conhecidas", () => {
    expect(resolveAccountRole("gestor")).toBe("gestor");
    expect(resolveAccountRole("analista")).toBe("analista");
    expect(resolveAccountRole("comum")).toBe("comum");
  });

  it("preserva o estado pendente explícito", () => {
    expect(resolveAccountRole("pendente")).toBe("pendente");
  });

  it("trata role ausente como pendente, nunca como gestor", () => {
    expect(resolveAccountRole(undefined)).toBe("pendente");
    expect(resolveAccountRole(null)).toBe("pendente");
  });

  it("trata role desconhecida como pendente — um valor inválido não pode virar acesso", () => {
    expect(resolveAccountRole("admin")).toBe("pendente");
    expect(resolveAccountRole("superuser")).toBe("pendente");
    expect(resolveAccountRole("")).toBe("pendente");
  });

  it("não aceita variação de caixa como role válida", () => {
    expect(resolveAccountRole("Gestor")).toBe("pendente");
    expect(resolveAccountRole("GESTOR")).toBe("pendente");
  });

  it("trata valores não-string como pendente", () => {
    expect(resolveAccountRole(1)).toBe("pendente");
    expect(resolveAccountRole(true)).toBe("pendente");
    expect(resolveAccountRole({ role: "gestor" })).toBe("pendente");
    expect(resolveAccountRole(["gestor"])).toBe("pendente");
  });
});
