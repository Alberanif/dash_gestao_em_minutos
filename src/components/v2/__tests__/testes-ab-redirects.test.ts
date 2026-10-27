import nextConfig from "../../../../next.config";

describe("redirecionamentos do Teste A/B", () => {
  it("os endereços antigos da Central levam, de forma permanente, aos novos dos Indicadores", async () => {
    const regras = (await nextConfig.redirects?.()) ?? [];
    expect(regras).toEqual(
      expect.arrayContaining([
        { source: "/v2/central-de-links/testes", destination: "/v2/indicadores/testes-ab", permanent: true },
        { source: "/v2/central-de-links/testes/:id", destination: "/v2/indicadores/testes-ab/:id", permanent: true },
      ]),
    );
    expect(regras).toHaveLength(2);
  });
});
