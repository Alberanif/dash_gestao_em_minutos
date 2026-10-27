import { ipPrivado, conferirDestino, statusDaPagina } from "../ssrf";
import { FalhaDeArquivamento } from "../arquivamento";

describe("ipPrivado v4", () => {
  const privados = [
    "0.0.0.0", "0.1.2.3", "10.0.0.1", "10.255.255.255", "127.0.0.1", "127.9.9.9",
    "100.64.0.1", "100.127.255.255", "169.254.169.254", "172.16.0.1", "172.31.255.255",
    "192.168.0.1", "192.168.255.255", "224.0.0.1", "239.1.1.1", "255.255.255.255",
  ];
  const publicos = [
    "1.1.1.1", "8.8.8.8", "9.255.255.255", "11.0.0.1", "100.63.255.255", "100.128.0.1",
    "126.255.255.255", "128.0.0.1", "169.253.0.1", "169.255.0.1", "172.15.255.255",
    "172.32.0.1", "192.167.1.1", "192.169.0.1", "223.255.255.255",
  ];
  it.each(privados)("%s é privado", (ip) => expect(ipPrivado(ip)).toBe(true));
  it.each(publicos)("%s é público", (ip) => expect(ipPrivado(ip)).toBe(false));
});

describe("ipPrivado v6", () => {
  it.each(["::1", "::", "fe80::1", "FE80::1", "fc00::1", "fd12:3456::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:7f00:1", "::ffff:a00:1", "::FFFF:192.168.1.1"])(
    "%s é privado", (ip) => expect(ipPrivado(ip)).toBe(true));
  it.each(["2606:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8", "::ffff:808:808"])(
    "%s é público", (ip) => expect(ipPrivado(ip)).toBe(false));
});

const resolverPara = (...ips: string[]) => jest.fn(async (_host: string) => ips.map((address) => ({ address })));

describe("conferirDestino", () => {
  it("aceita https público e devolve a URL", async () => {
    const u = await conferirDestino("https://exemplo.com/a?b=1", resolverPara("93.184.216.34"));
    expect(u).toBeInstanceOf(URL);
    expect(u.href).toBe("https://exemplo.com/a?b=1");
  });
  it("URL inválida", async () => {
    await expect(conferirDestino("não é url", resolverPara("1.1.1.1"))).rejects.toThrow("URL inválida.");
    await expect(conferirDestino("não é url", resolverPara("1.1.1.1"))).rejects.toBeInstanceOf(FalhaDeArquivamento);
  });
  it.each(["ftp://exemplo.com", "file:///etc/passwd", "javascript:alert(1)"])("recusa protocolo %s", async (t) => {
    await expect(conferirDestino(t, resolverPara("1.1.1.1"))).rejects.toThrow("Só URLs http ou https podem ser arquivadas.");
  });
  it("portas 80 e 443 passam; outras não", async () => {
    const r = resolverPara("1.1.1.1");
    await expect(conferirDestino("http://exemplo.com:80/", r)).resolves.toBeDefined();
    await expect(conferirDestino("https://exemplo.com:443/", r)).resolves.toBeDefined();
    await expect(conferirDestino("https://exemplo.com:8443/", r)).rejects.toThrow("Porta não permitida.");
    await expect(conferirDestino("http://exemplo.com:8080/", r)).rejects.toThrow("Porta não permitida.");
    // o parser omite a porta padrão do esquema; 443 em http e 80 em https chegam como porta explícita e o original as aceita
    await expect(conferirDestino("http://exemplo.com:443/", r)).resolves.toBeDefined();
    await expect(conferirDestino("https://exemplo.com:80/", r)).resolves.toBeDefined();
  });
  it("IP literal privado é recusado sem consultar o resolvedor", async () => {
    const r = resolverPara("1.1.1.1");
    await expect(conferirDestino("http://127.0.0.1/", r)).rejects.toThrow("Endereço não permitido.");
    await expect(conferirDestino("http://[::1]/", r)).rejects.toThrow("Endereço não permitido.");
    await expect(conferirDestino("http://[::ffff:127.0.0.1]/", r)).rejects.toThrow("Endereço não permitido.");
    await expect(conferirDestino("http://169.254.169.254/latest", r)).rejects.toThrow("Endereço não permitido.");
    expect(r).not.toHaveBeenCalled();
  });
  it("IP literal público passa sem consultar o resolvedor", async () => {
    const r = resolverPara("10.0.0.1");
    await expect(conferirDestino("http://8.8.8.8/", r)).resolves.toBeDefined();
    await expect(conferirDestino("http://[2606:4700::1111]/", r)).resolves.toBeDefined();
    expect(r).not.toHaveBeenCalled();
  });
  it("recusa se QUALQUER endereço resolvido for privado", async () => {
    await expect(conferirDestino("https://x.com/", resolverPara("1.1.1.1", "10.0.0.5"))).rejects.toThrow("Endereço não permitido.");
    await expect(conferirDestino("https://x.com/", resolverPara("10.0.0.5", "1.1.1.1"))).rejects.toThrow("Endereço não permitido.");
  });
  it("aceita se todos forem públicos", async () => {
    await expect(conferirDestino("https://x.com/", resolverPara("1.1.1.1", "8.8.8.8"))).resolves.toBeDefined();
  });
  it("sem endereços ou resolvedor que falha", async () => {
    const msg = "Não foi possível resolver o endereço do site.";
    await expect(conferirDestino("https://x.com/", resolverPara())).rejects.toThrow(msg);
    await expect(
      conferirDestino("https://x.com/", async () => {
        throw new Error("ENOTFOUND");
      }),
    ).rejects.toThrow(msg);
  });
  it("resolve o hostname", async () => {
    const r = resolverPara("1.1.1.1");
    await conferirDestino("https://exemplo.com/", r);
    expect(r).toHaveBeenCalledWith("exemplo.com");
  });
});

const resp = (status: number, location?: string) =>
  ({ status, headers: { get: (k: string) => (k.toLowerCase() === "location" ? (location ?? null) : null) } }) as unknown as Response;

describe("statusDaPagina", () => {
  const resolver = async () => [{ address: "1.1.1.1" }];

  it("devolve o status da resposta final", async () => {
    const buscar = jest.fn(async () => resp(200));
    await expect(statusDaPagina("https://a.com/", { resolver, buscar: buscar as never })).resolves.toBe(200);
    await expect(statusDaPagina("https://a.com/", { resolver, buscar: (async () => resp(404)) as never })).resolves.toBe(404);
  });
  it("segue redirecionamento relativo e confere cada destino", async () => {
    const buscar = jest.fn().mockResolvedValueOnce(resp(302, "/b")).mockResolvedValueOnce(resp(200));
    const r = jest.fn(resolver);
    await expect(statusDaPagina("https://a.com/x", { resolver: r, buscar: buscar as never })).resolves.toBe(200);
    expect(String((buscar.mock.calls[1] as unknown[])[0])).toBe("https://a.com/b");
    expect(r).toHaveBeenCalledTimes(2);
  });
  it("usa redirect manual e timeout", async () => {
    const buscar = jest.fn(async (..._a: unknown[]) => resp(200));
    await statusDaPagina("https://a.com/", { resolver, buscar: buscar as never });
    const init = buscar.mock.calls[0][1] as RequestInit;
    expect(init.redirect).toBe("manual");
    expect(init.signal).toBeDefined();
  });
  it("redirecionamento para destino privado é recusado", async () => {
    const buscar = jest.fn().mockResolvedValueOnce(resp(301, "http://127.0.0.1/admin"));
    await expect(statusDaPagina("https://a.com/", { resolver, buscar: buscar as never })).rejects.toThrow("Endereço não permitido.");
    expect(buscar).toHaveBeenCalledTimes(1);
  });
  it("3xx sem location devolve o status", async () => {
    const buscar = jest.fn(async () => resp(304));
    await expect(statusDaPagina("https://a.com/", { resolver, buscar: buscar as never })).resolves.toBe(304);
  });
  it("6 pedidos ainda passam (5 redirecionamentos e a resposta final)", async () => {
    const buscar = jest.fn();
    for (let i = 0; i < 5; i++) buscar.mockResolvedValueOnce(resp(302, `/p${i}`));
    buscar.mockResolvedValueOnce(resp(200));
    await expect(statusDaPagina("https://a.com/", { resolver, buscar: buscar as never })).resolves.toBe(200);
    expect(buscar).toHaveBeenCalledTimes(6);
  });
  it("redirecionamentos demais após 6 pedidos", async () => {
    const buscar = jest.fn(async () => resp(302, "/de-novo"));
    const p = statusDaPagina("https://a.com/", { resolver, buscar: buscar as never });
    await expect(p).rejects.toThrow("Redirecionamentos demais.");
    await expect(p).rejects.toBeInstanceOf(FalhaDeArquivamento);
    expect(buscar).toHaveBeenCalledTimes(6);
  });
});
