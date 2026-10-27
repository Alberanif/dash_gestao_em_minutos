import {
  arquivarNoServidor,
  executarFila,
  navegadorIndisponivel,
  pendentesParaArquivar,
  precisaTentarDeNovo,
} from "../central-de-links/fila-arquivamento";
import type { LinkDaCentral } from "@/lib/central-de-links/tipos";

function link(p: Partial<LinkDaCentral> = {}): LinkDaCentral {
  return {
    id: "i", label: "L", url: "https://x.com", grupo: "G", tipo: "cap", deleted: false,
    slug: null, pagina_ativa: false, arquivo_path: null, arquivo_tam: null,
    arquivado_em: null, arquivo_status: "pendente", arquivo_erro: null, arquivo_tentativa_em: null,
    ...p,
  };
}

describe("pendentesParaArquivar", () => {
  it("só pendentes sem cópia e não excluídos", () => {
    const todos = [
      link({ id: "a" }),
      link({ id: "b", arquivo_status: "ok", arquivo_path: "b.html" }),
      link({ id: "c", arquivo_path: "c.html" }), // pendente mas já tem cópia
      link({ id: "d", deleted: true }),
      link({ id: "e", arquivo_status: "ignorado" }),
      link({ id: "f", arquivo_status: "falhou" }),
      link({ id: "g", arquivo_status: "arquivando" }),
      link({ id: "h", arquivo_status: null }),
      link({ id: "i" }),
    ];
    expect(pendentesParaArquivar(todos).map((l) => l.id)).toEqual(["a", "i"]);
  });
});

describe("precisaTentarDeNovo", () => {
  const agora = new Date("2026-10-26T12:00:00Z");
  const ha = (min: number) => new Date(agora.getTime() - min * 60_000).toISOString();

  it("arquivando há mais de 6 minutos precisa", () => {
    expect(precisaTentarDeNovo(link({ arquivo_status: "arquivando", arquivo_tentativa_em: ha(7) }), agora)).toBe(true);
  });
  it("arquivando há menos de 6 minutos não precisa", () => {
    expect(precisaTentarDeNovo(link({ arquivo_status: "arquivando", arquivo_tentativa_em: ha(5) }), agora)).toBe(false);
  });
  it("exatamente 6 minutos ainda não precisa", () => {
    expect(precisaTentarDeNovo(link({ arquivo_status: "arquivando", arquivo_tentativa_em: ha(6) }), agora)).toBe(false);
  });
  it("arquivando sem data de tentativa é trava obsoleta", () => {
    expect(precisaTentarDeNovo(link({ arquivo_status: "arquivando", arquivo_tentativa_em: null }), agora)).toBe(true);
  });
  it("outros estados nunca", () => {
    for (const s of ["pendente", "ok", "falhou", "ignorado", null] as const) {
      expect(precisaTentarDeNovo(link({ arquivo_status: s, arquivo_tentativa_em: ha(60) }), agora)).toBe(false);
    }
  });
});

describe("executarFila", () => {
  it("processa um por vez, na ordem", async () => {
    let emAndamento = 0;
    let maximo = 0;
    const ordem: string[] = [];
    const r = await executarFila(["a", "b", "c"], async (id) => {
      emAndamento++;
      maximo = Math.max(maximo, emAndamento);
      await new Promise((ok) => setTimeout(ok, 5));
      ordem.push(id);
      emAndamento--;
      return { ok: true };
    });
    expect(maximo).toBe(1);
    expect(ordem).toEqual(["a", "b", "c"]);
    expect(r).toMatchObject({ feitos: 3, falhas: 0, parou: false });
  });

  it("continua após erro (resposta ruim ou exceção) e conta as falhas", async () => {
    const chamados: string[] = [];
    const r = await executarFila(["a", "b", "c", "d"], async (id) => {
      chamados.push(id);
      if (id === "a") return { ok: false, erro: "A página respondeu com erro HTTP 404." };
      if (id === "c") throw new Error("rede caiu");
      return { ok: true };
    });
    expect(chamados).toEqual(["a", "b", "c", "d"]);
    expect(r).toMatchObject({ feitos: 2, falhas: 2, parou: false });
    expect(r.erros).toEqual([
      { id: "a", erro: "A página respondeu com erro HTTP 404." },
      { id: "c", erro: "rede caiu" },
    ]);
  });

  it("para quando deveParar vira verdadeiro e não inicia o próximo", async () => {
    let parar = false;
    const chamados: string[] = [];
    const r = await executarFila(
      ["a", "b", "c"],
      async (id) => {
        chamados.push(id);
        if (id === "a") parar = true; // o pedido chega durante o item atual
        return { ok: true };
      },
      { deveParar: () => parar },
    );
    expect(chamados).toEqual(["a"]);
    expect(r).toMatchObject({ feitos: 1, falhas: 0, parou: true });
  });

  it("deveParar já verdadeiro no início não processa nada", async () => {
    const arquivarUm = jest.fn().mockResolvedValue({ ok: true });
    const r = await executarFila(["a"], arquivarUm, { deveParar: () => true });
    expect(arquivarUm).not.toHaveBeenCalled();
    expect(r).toMatchObject({ feitos: 0, falhas: 0, parou: true });
  });

  it("fila toda processada não marca parou, mesmo com deveParar falso", async () => {
    const r = await executarFila(["a"], async () => ({ ok: true }), { deveParar: () => false });
    expect(r.parou).toBe(false);
  });

  it("aoTerminarItem roda depois de cada item, antes do próximo, com id e resultado", async () => {
    const eventos: string[] = [];
    await executarFila(
      ["a", "b"],
      async (id) => {
        eventos.push(`arquiva ${id}`);
        return id === "a" ? { ok: true } : { ok: false, erro: "x" };
      },
      { aoTerminarItem: async (id, res) => void eventos.push(`fim ${id} ${res.ok}`) },
    );
    expect(eventos).toEqual(["arquiva a", "fim a true", "arquiva b", "fim b false"]);
  });

  it("aoTerminarItem que lança não derruba a fila", async () => {
    const r = await executarFila(["a", "b"], async () => ({ ok: true }), {
      aoTerminarItem: async () => {
        throw new Error("falha ao reler");
      },
    });
    expect(r).toMatchObject({ feitos: 2, falhas: 0 });
  });

  it("lista vazia termina sem chamar nada", async () => {
    expect(await executarFila([], jest.fn())).toMatchObject({ feitos: 0, falhas: 0, parou: false });
  });
});

describe("arquivarNoServidor", () => {
  const resposta = (status: number, corpo: unknown) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => corpo }) as unknown as Response;

  it("POST com { id } e cookie de sessão, sem Bearer", async () => {
    const buscar = jest.fn().mockResolvedValue(resposta(200, { ok: true, tamanho: 10 }));
    await expect(arquivarNoServidor("abc", buscar)).resolves.toEqual({ ok: true });
    const [url, init] = buscar.mock.calls[0];
    expect(url).toBe("/api/central-de-links/arquivar");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ id: "abc" });
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.stringify(init.headers)).not.toMatch(/authorization|bearer/i);
    expect(init.credentials).toBe("same-origin");
  });

  it("erro do servidor devolve a mensagem de { erro }", async () => {
    const buscar = jest.fn().mockResolvedValue(resposta(422, { erro: "A captura veio vazia ou inválida." }));
    await expect(arquivarNoServidor("abc", buscar)).resolves.toEqual({ ok: false, erro: "A captura veio vazia ou inválida." });
  });

  it("erro sem corpo legível vira mensagem genérica com o status", async () => {
    const buscar = jest.fn().mockResolvedValue({
      ok: false, status: 502, json: async () => { throw new Error("html"); },
    });
    const r = await arquivarNoServidor("abc", buscar);
    expect(r.ok).toBe(false);
    expect(r.erro).toContain("502");
  });

  it("falha de rede vira { ok: false } em vez de lançar", async () => {
    const buscar = jest.fn().mockRejectedValue(new Error("Failed to fetch"));
    const r = await arquivarNoServidor("abc", buscar);
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/conectar|rede/i);
  });
});

describe("navegadorIndisponivel", () => {
  it("reconhece a mensagem do servidor", () => {
    expect(
      navegadorIndisponivel([{ id: "a", erro: "O navegador de captura não está disponível neste ambiente. Tente de novo." }]),
    ).toBe(true);
  });
  it("outras falhas não", () => {
    expect(navegadorIndisponivel([{ id: "a", erro: "A página respondeu com erro HTTP 500." }])).toBe(false);
    expect(navegadorIndisponivel([])).toBe(false);
  });
});
