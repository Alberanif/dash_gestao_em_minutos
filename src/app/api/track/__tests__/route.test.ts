import { NextRequest } from "next/server";

// --- Supabase falso: variantes ativas (select) e eventos (upsert com dedupe por evento_id)
type Variante = {
  id: string;
  teste_id: string;
  link_id: string;
  central_links: { url: string; deleted: boolean };
  ab_testes: { status: string; iniciado_em: string | null };
};
let variantes: Variante[];
let falhaConsulta = false;
let falhaGravacao = false;
let consultas = 0;
const filtros: Array<[string, unknown]> = [];
const gravados: Record<string, unknown>[] = [];
const opcoesUpsert: unknown[] = [];

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => ({
    from: (tabela: string) => {
      if (tabela === "ab_variantes") {
        const q: Record<string, unknown> = {};
        q.select = () => q;
        q.eq = (c: string, v: unknown) => {
          filtros.push([c, v]);
          return q;
        };
        q.limit = () => {
          consultas++;
          // o fake aplica os mesmos filtros que o PostgREST aplicaria
          const ativo = filtros.some(([c, v]) => c === "ab_testes.status" && v === "ativo");
          const vivo = filtros.some(([c, v]) => c === "central_links.deleted" && v === false);
          const data = variantes.filter(
            (x) => (!ativo || x.ab_testes.status === "ativo") && (!vivo || !x.central_links.deleted),
          );
          return Promise.resolve(falhaConsulta ? { data: null, error: { message: "x" } } : { data, error: null });
        };
        return q;
      }
      return {
        upsert: (linha: Record<string, unknown>, opcoes: { ignoreDuplicates?: boolean }) => {
          opcoesUpsert.push(opcoes);
          if (falhaGravacao) return Promise.resolve({ error: { message: "x" } });
          const repetido = gravados.some((g) => g.evento_id === linha.evento_id);
          if (!(repetido && opcoes?.ignoreDuplicates)) gravados.push(linha);
          return Promise.resolve({ error: null });
        },
      };
    },
  }),
}));

import { OPTIONS, POST } from "../route";
import { resetarCache, resetarContagens } from "../coleta";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36";

function evento(extra: Record<string, unknown> = {}) {
  return {
    evento_id: "ev-00000001",
    visitante_id: "vis-00000001",
    tipo: "pageview",
    url: "https://pagina.com/oferta?utm_source=fb#x",
    novo_visitante: true,
    ...extra,
  };
}

function req(corpo: unknown, headers: Record<string, string> = {}, bruto?: string) {
  return new NextRequest("http://localhost/api/track", {
    method: "POST",
    body: bruto ?? JSON.stringify(corpo),
    headers: { "content-type": "text/plain", "user-agent": CHROME, ...headers },
  });
}

function variante(extra: Partial<Variante> = {}): Variante {
  return {
    id: "var-1",
    teste_id: "teste-1",
    link_id: "link-1",
    central_links: { url: "https://www.Pagina.com/oferta/", deleted: false },
    ab_testes: { status: "ativo", iniciado_em: null },
    ...extra,
  };
}

beforeEach(() => {
  variantes = [variante()];
  falhaConsulta = false;
  falhaGravacao = false;
  consultas = 0;
  filtros.length = 0;
  gravados.length = 0;
  opcoesUpsert.length = 0;
  resetarCache();
  resetarContagens();
});

describe("POST /api/track", () => {
  it("grava o evento de página em teste ativo e responde 204 com CORS", async () => {
    const r = await POST(req(evento({ utm_source: " fb ", referrer: "https://google.com/x" })));
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
    expect(gravados).toHaveLength(1);
    expect(gravados[0]).toMatchObject({
      evento_id: "ev-00000001",
      teste_id: "teste-1",
      variante_id: "var-1",
      link_id: "link-1",
      visitante_id: "vis-00000001",
      tipo: "pageview",
      novo_visitante: true,
      utm_source: "fb",
      referrer_host: "google.com",
      dispositivo: "desktop",
      navegador: "Chrome",
      robo: false,
      pais: null,
    });
  });

  it("novo_visitante false ou ausente é gravado como false", async () => {
    await POST(req(evento({ novo_visitante: false, evento_id: "ev-nv-0001" })));
    await POST(req(evento({ novo_visitante: undefined, evento_id: "ev-nv-0002" })));
    expect(gravados.map((g) => g.novo_visitante)).toEqual([false, false]);
  });

  it("teste e variante vêm do servidor, mesmo que o cliente mande outros", async () => {
    await POST(req(evento({ teste_id: "falso", variante_id: "falsa", link_id: "falso" })));
    expect(gravados[0]).toMatchObject({ teste_id: "teste-1", variante_id: "var-1", link_id: "link-1" });
  });

  it("consulta só testes ativos e links não excluídos", async () => {
    await POST(req(evento()));
    expect(filtros).toEqual(
      expect.arrayContaining([
        ["ab_testes.status", "ativo"],
        ["central_links.deleted", false],
      ]),
    );
  });

  it.each(["rascunho", "encerrado"])("não grava quando o teste está %s", async (status) => {
    variantes = [variante({ ab_testes: { status, iniciado_em: null } })];
    const r = await POST(req(evento()));
    expect(r.status).toBe(204);
    expect(gravados).toHaveLength(0);
  });

  it("não grava quando o link está excluído", async () => {
    variantes = [variante({ central_links: { url: "https://pagina.com/oferta", deleted: true } })];
    expect((await POST(req(evento()))).status).toBe(204);
    expect(gravados).toHaveLength(0);
  });

  it("não grava página que não é de nenhum teste (204 sem revelar o motivo)", async () => {
    const r = await POST(req(evento({ url: "https://outra.com/qualquer" })));
    expect(r.status).toBe(204);
    expect(gravados).toHaveLength(0);
  });

  it("descarta a cópia arquivada (/p/…) da própria Central", async () => {
    const r = await POST(req(evento({ url: "https://painel.exemplo.com/p/oferta" })));
    expect(r.status).toBe(204);
    expect(gravados).toHaveLength(0);
  });

  it("casa a página ignorando www., barra final, query, hash e caixa", async () => {
    for (const [i, url] of [
      "https://pagina.com/oferta/",
      "http://WWW.pagina.com/Oferta?a=1#b",
      "https://pagina.com:443/oferta",
    ].entries()) {
      await POST(req(evento({ url, evento_id: "ev-0000000" + i })));
    }
    expect(gravados).toHaveLength(3);
  });

  it("não grava antes de o teste ter iniciado", async () => {
    variantes = [variante({ ab_testes: { status: "ativo", iniciado_em: new Date(Date.now() + 3600_000).toISOString() } })];
    expect((await POST(req(evento()))).status).toBe(204);
    expect(gravados).toHaveLength(0);
  });

  it("grava depois do início do teste", async () => {
    variantes = [variante({ ab_testes: { status: "ativo", iniciado_em: new Date(Date.now() - 3600_000).toISOString() } })];
    await POST(req(evento()));
    expect(gravados).toHaveLength(1);
  });

  it("NÃO grava IP: nem no objeto gravado, nem em qualquer valor", async () => {
    await POST(req(evento(), { "x-forwarded-for": "203.0.113.77, 10.0.0.1", "x-real-ip": "203.0.113.77" }));
    expect(gravados).toHaveLength(1);
    const linha = gravados[0];
    expect(Object.keys(linha).filter((k) => /^(ip|.*_ip|ip_.*|.*addr.*|.*forwarded.*)$/i.test(k))).toEqual([]);
    expect(JSON.stringify(linha)).not.toContain("203.0.113.77");
  });

  it("deduplica por evento_id (reenvio não vira segunda linha)", async () => {
    await POST(req(evento()));
    await POST(req(evento()));
    expect(gravados).toHaveLength(1);
    expect(opcoesUpsert[0]).toEqual({ onConflict: "evento_id", ignoreDuplicates: true });
  });

  it("marca robô em vez de descartar, e classifica celular", async () => {
    await POST(req(evento({ evento_id: "ev-robo-001" }), { "user-agent": "Googlebot/2.1" }));
    await POST(req(evento({ evento_id: "ev-cel-0001" }), { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile Safari/604.1" }));
    expect(gravados[0]).toMatchObject({ robo: true });
    expect(gravados[1]).toMatchObject({ robo: false, dispositivo: "celular", navegador: "Safari" });
  });

  it("referrer do mesmo host da página é descartado; país vem do cabeçalho da Vercel", async () => {
    await POST(req(evento({ referrer: "https://pagina.com/outra" }), { "x-vercel-ip-country": "br" }));
    expect(gravados[0]).toMatchObject({ referrer_host: null, pais: "BR" });
  });

  it("aceita form_inicio e lead e recusa tipo desconhecido", async () => {
    expect((await POST(req(evento({ tipo: "form_inicio", evento_id: "ev-fi-0001" })))).status).toBe(204);
    expect((await POST(req(evento({ tipo: "lead", evento_id: "ev-lead-001" })))).status).toBe(204);
    expect(gravados.map((g) => g.tipo)).toEqual(["form_inicio", "lead"]);
    expect((await POST(req(evento({ tipo: "compra" })))).status).toBe(400);
  });

  describe("validação (400)", () => {
    it.each([
      ["evento_id curto", { evento_id: "abc" }],
      ["evento_id com caractere inválido", { evento_id: "evento com espaço" }],
      ["visitante_id ausente", { visitante_id: undefined }],
      ["url não texto", { url: 5 }],
      ["url enorme", { url: "https://pagina.com/" + "a".repeat(2100) }],
      ["novo_visitante não booleano", { novo_visitante: "sim" }],
    ])("%s", async (_n, extra) => {
      expect((await POST(req(evento(extra)))).status).toBe(400);
      expect(gravados).toHaveLength(0);
    });

    it("corpo que não é JSON, array ou nulo", async () => {
      expect((await POST(req(null, {}, "isto não é json"))).status).toBe(400);
      expect((await POST(req([]))).status).toBe(400);
      expect((await POST(req(null))).status).toBe(400);
    });
  });

  it("corpo maior que 4096 caracteres dá 413", async () => {
    expect((await POST(req(evento({ referrer: "x".repeat(5000) })))).status).toBe(413);
    expect(gravados).toHaveLength(0);
  });

  it("content-length declarado acima do teto dá 413", async () => {
    expect((await POST(req(evento(), { "content-length": "99999" }))).status).toBe(413);
  });

  describe("rate limit", () => {
    it("61º evento do mesmo visitante no minuto dá 429", async () => {
      let ultimo = 0;
      for (let i = 0; i < 61; i++) {
        ultimo = (await POST(req(evento({ evento_id: "ev-" + String(i).padStart(8, "0") })))).status;
      }
      expect(ultimo).toBe(429);
    });

    it("o 60º ainda passa", async () => {
      let ultimo = 0;
      for (let i = 0; i < 60; i++) {
        ultimo = (await POST(req(evento({ evento_id: "ev-" + String(i).padStart(8, "0") })))).status;
      }
      expect(ultimo).toBe(204);
    });

    it("241º evento do mesmo IP dá 429, mesmo com visitantes diferentes", async () => {
      let ultimo = 0;
      for (let i = 0; i < 241; i++) {
        ultimo = (
          await POST(
            req(evento({ evento_id: "ev-" + String(i).padStart(8, "0"), visitante_id: "vis-" + String(i).padStart(8, "0") }), {
              "x-forwarded-for": "198.51.100.9",
            }),
          )
        ).status;
      }
      expect(ultimo).toBe(429);
    });
  });

  it("cacheia a consulta de variantes por alguns segundos", async () => {
    await POST(req(evento({ evento_id: "ev-cache-001" })));
    await POST(req(evento({ evento_id: "ev-cache-002" })));
    expect(consultas).toBe(1);
  });

  it("falha na consulta de variantes responde 204 e não grava", async () => {
    falhaConsulta = true;
    expect((await POST(req(evento()))).status).toBe(204);
    expect(gravados).toHaveLength(0);
  });

  it("falha na gravação responde 502", async () => {
    falhaGravacao = true;
    expect((await POST(req(evento()))).status).toBe(502);
  });
});

describe("OPTIONS /api/track", () => {
  it("responde o preflight com 204 e os cabeçalhos CORS", async () => {
    const r = await OPTIONS();
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-origin")).toBe("*");
    expect(r.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
    expect(r.headers.get("access-control-allow-headers")).toBe("Content-Type");
    expect(r.headers.get("access-control-max-age")).toBe("86400");
  });
});
