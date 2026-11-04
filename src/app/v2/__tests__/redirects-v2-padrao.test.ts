import nextConfig from "../../../../next.config";

type Regra = { source: string; destination: string; permanent: boolean };

/** Resolve um caminho pelas regras do next.config, como o Next faz: a primeira que casa vence. */
async function resolver(caminho: string): Promise<{ para: string; regra: Regra } | null> {
  const regras = ((await nextConfig.redirects?.()) ?? []) as Regra[];
  for (const regra of regras) {
    if (regra.source.endsWith("/:path*")) {
      const base = regra.source.slice(0, -"/:path*".length);
      if (caminho === base || caminho.startsWith(`${base}/`)) {
        const resto = caminho.slice(base.length + 1);
        const destinoBase = regra.destination.slice(0, -"/:path*".length);
        return { para: resto ? `${destinoBase}/${resto}` : destinoBase, regra };
      }
    } else if (caminho === regra.source) {
      return { para: regra.destination, regra };
    }
  }
  return null;
}

describe("V2 como layout padrão: redirects do layout anterior", () => {
  it.each([
    ["/", "/v2"],
    ["/indicadores", "/v2/indicadores"],
    ["/indicadores/eventos", "/v2/indicadores/eventos"],
    ["/indicadores/0b6c4a3e-1111-4222-8333-444455556666", "/v2/indicadores/0b6c4a3e-1111-4222-8333-444455556666"],
    ["/ajustes", "/v2/ajustes"],
    ["/ajustes/dados", "/v2/ajustes/dados"],
    ["/ajustes/configuracoes", "/v2/ajustes/contas"],
    ["/dashboard/settings", "/v2/ajustes/contas"],
    ["/dashboard/dados", "/v2/ajustes/dados"],
  ])("%s leva a %s", async (de, para) => {
    expect((await resolver(de))?.para).toBe(para);
  });

  it("são temporários (307): a regra pode ser revista sem cache de navegador", async () => {
    for (const c of ["/", "/indicadores", "/ajustes", "/ajustes/configuracoes", "/dashboard/settings"]) {
      expect((await resolver(c))?.regra.permanent).toBe(false);
    }
  });

  it("sem cadeias e sem loops: o destino de cada regra não é origem de outra", async () => {
    const regras = ((await nextConfig.redirects?.()) ?? []) as Regra[];
    for (const r of regras) {
      const exemplo = r.destination.replace(":path*", "x").replace(":id", "x");
      expect({ de: r.source, destino: exemplo, depois: await resolver(exemplo) }).toEqual({
        de: r.source,
        destino: exemplo,
        depois: null,
      });
    }
  });

  it("as áreas sem versão V2 e as rotas de API não são redirecionadas", async () => {
    for (const c of [
      "/dashboard",
      "/dashboard/eqa",
      "/base-de-dados",
      "/base-de-dados/eqa",
      "/relatorio-de-vendas",
      "/api/indicadores/daily",
      "/api/admin/users",
      "/login",
      "/v2",
      "/v2/indicadores",
      "/aguardando-aprovacao",
    ]) {
      expect(await resolver(c)).toBeNull();
    }
  });

  it("os endereços do Teste A/B continuam valendo", async () => {
    expect((await resolver("/v2/central-de-links/testes"))?.para).toBe("/v2/indicadores/testes-ab");
  });
});
