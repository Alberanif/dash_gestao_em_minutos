import nextConfig from "../../../../next.config";

const mockRedirect = jest.fn((destino: string) => {
  throw new Error(`NEXT_REDIRECT:${destino}`);
});

jest.mock("next/navigation", () => ({
  redirect: (destino: string) => mockRedirect(destino),
}));

type Regra = { source: string; destination: string };

describe("/ultimates (endereço antigo do Relatório de Vendas)", () => {
  it("vai direto para a V2, num único salto", async () => {
    const Pagina = (await import("../page")).default;
    expect(() => Pagina()).toThrow("NEXT_REDIRECT:/v2/relatorio-de-vendas");

    // O destino não é origem de nenhuma regra do next.config: sem cadeia nem loop.
    const regras = ((await nextConfig.redirects?.()) ?? []) as Regra[];
    expect(regras.some((r) => r.source === "/v2/relatorio-de-vendas")).toBe(false);
  });

  it("não passa mais pelo endereço antigo, que agora é um redirect", async () => {
    const Pagina = (await import("../page")).default;
    expect(() => Pagina()).not.toThrow("NEXT_REDIRECT:/relatorio-de-vendas");
    const regras = ((await nextConfig.redirects?.()) ?? []) as Regra[];
    expect(regras.find((r) => r.source === "/relatorio-de-vendas")?.destination).toBe("/v2/relatorio-de-vendas");
  });
});
