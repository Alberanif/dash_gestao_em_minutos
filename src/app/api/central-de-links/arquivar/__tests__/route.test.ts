import fs from "fs";

const mockExigir = jest.fn();
jest.mock("@/lib/central-de-links/papel-servidor", () => ({
  exigirPapelCentral: (...a: unknown[]) => mockExigir(...a),
}));

const mockStatus = jest.fn();
jest.mock("@/lib/central-de-links/ssrf", () => ({
  statusDaPagina: (...a: unknown[]) => mockStatus(...a),
}));

const mockCapturar = jest.fn();
const mockNavegador = jest.fn();
const mockMiniatura = jest.fn();
jest.mock("@/lib/central-de-links/captura", () => ({
  capturar: (...a: unknown[]) => mockCapturar(...a),
  capturarMiniatura: (...a: unknown[]) => mockMiniatura(...a),
  localizarNavegador: (...a: unknown[]) => mockNavegador(...a),
}));

// --- Supabase falso: registra updates e responde leitura/trava/upload conforme o cenário
interface Cenario {
  link: Record<string, unknown> | null;
  trava: unknown[];
  upload: { error: { message: string } | null };
}
let cenario: Cenario;
const updates: { campos: Record<string, unknown>; filtros: string[] }[] = [];
const mockUpload = jest.fn();

function construtor() {
  let modo: "select" | "update" = "select";
  let campos: Record<string, unknown> = {};
  const filtros: string[] = [];
  const q: Record<string, unknown> = {};
  const resolver = () => {
    if (modo === "select") return { data: cenario.link, error: null };
    updates.push({ campos, filtros });
    return { data: cenario.trava, error: null };
  };
  q.select = () => q;
  q.update = (c: Record<string, unknown>) => {
    modo = "update";
    campos = c;
    return q;
  };
  q.eq = (c: string, v: unknown) => {
    filtros.push(`${c}=${String(v)}`);
    return q;
  };
  q.or = (e: string) => {
    filtros.push(`or:${e}`);
    return q;
  };
  q.maybeSingle = async () => resolver();
  q.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(resolver()).then(ok, ko);
  return q;
}

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: jest.fn(() => ({
    from: () => construtor(),
    storage: { from: () => ({ upload: (...a: unknown[]) => mockUpload(...a) }) },
  })),
}));

import { NextRequest, NextResponse } from "next/server";
import { POST } from "../route";
import { FalhaDeArquivamento } from "@/lib/central-de-links/arquivamento";

const ID = "11111111-2222-4333-8444-555555555555";
const HTML = "<html><body>" + "x".repeat(200) + "</body></html>";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/central-de-links/arquivar", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
function comoAdmin() {
  mockExigir.mockResolvedValue({ error: null, userId: "u", papel: "admin" });
}
let destinoUsado = "";

beforeEach(() => {
  jest.clearAllMocks();
  updates.length = 0;
  destinoUsado = "";
  cenario = {
    link: { id: ID, url: "https://do-banco.com/p", arquivo_path: null, arquivo_tam: null },
    trava: [{ id: ID }],
    upload: { error: null },
  };
  comoAdmin();
  mockStatus.mockResolvedValue(200);
  mockNavegador.mockResolvedValue({ exe: "/chrome", args: [] });
  mockCapturar.mockImplementation(async (_url: string, destino: string) => {
    destinoUsado = destino;
    fs.writeFileSync(destino, HTML);
  });
  mockUpload.mockImplementation(async () => cenario.upload);
  mockMiniatura.mockImplementation(async (_html: string, destino: string) => {
    fs.writeFileSync(destino, "PNG");
  });
});

describe("POST /api/central-de-links/arquivar", () => {
  it("sem sessão: 401 e nada acontece", async () => {
    mockExigir.mockResolvedValue({ error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });
    const res = await POST(req({ id: ID }));
    expect(res.status).toBe(401);
    expect(mockCapturar).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("membro: 403 e nada acontece", async () => {
    mockExigir.mockResolvedValue({ error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
    const res = await POST(req({ id: ID }));
    expect(res.status).toBe(403);
    expect(mockCapturar).not.toHaveBeenCalled();
  });

  it("exige papel admin", async () => {
    await POST(req({ id: ID }));
    expect(mockExigir).toHaveBeenCalledWith("admin");
  });

  it.each([[{}], [{ id: "abc" }], [{ id: 5 }], ["não é json"]])("id inválido (%j): 400", async (corpo) => {
    const res = await POST(req(corpo));
    expect(res.status).toBe(400);
    expect(mockCapturar).not.toHaveBeenCalled();
  });

  it("link inexistente ou excluído: 404", async () => {
    cenario.link = null;
    const res = await POST(req({ id: ID }));
    expect(res.status).toBe(404);
    expect(mockCapturar).not.toHaveBeenCalled();
  });

  it("trava ocupada (0 linhas): 409 e não captura", async () => {
    cenario.trava = [];
    const res = await POST(req({ id: ID }));
    expect(res.status).toBe(409);
    expect((await res.json()).erro).toBe("Esta página já está sendo arquivada.");
    expect(mockCapturar).not.toHaveBeenCalled();
  });

  it("a trava é condicional: ignora só 'arquivando' recente (6 min)", async () => {
    await POST(req({ id: ID }));
    const trava = updates[0];
    expect(trava.campos.arquivo_status).toBe("arquivando");
    const ou = trava.filtros.find((f) => f.startsWith("or:"))!;
    expect(ou).toContain("arquivo_status.neq.arquivando");
    expect(ou).toContain("arquivo_status.is.null");
    expect(ou).toContain("arquivo_tentativa_em.lt.");
    const limite = new Date(ou.match(/lt\.([^,]+)/)![1]).getTime();
    expect(Date.now() - limite).toBeGreaterThan(6 * 60_000 - 5_000);
    expect(Date.now() - limite).toBeLessThan(6 * 60_000 + 5_000);
  });

  it("usa a URL do banco, nunca a do corpo", async () => {
    await POST(req({ id: ID, url: "http://interno.local/segredo" }));
    expect(mockStatus).toHaveBeenCalledWith("https://do-banco.com/p");
    expect(mockCapturar.mock.calls[0][0]).toBe("https://do-banco.com/p");
  });

  it("página que responde 404: falha 422 e não captura", async () => {
    mockStatus.mockResolvedValue(404);
    const res = await POST(req({ id: ID }));
    expect(res.status).toBe(422);
    expect((await res.json()).erro).toBe("A página respondeu com erro HTTP 404.");
    expect(mockCapturar).not.toHaveBeenCalled();
  });

  it("sucesso: 200, sobe em paginas/<id>.html com upsert e NÃO liga pagina_ativa", async () => {
    const res = await POST(req({ id: ID }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, tamanho: Buffer.byteLength(HTML) });
    expect(mockUpload).toHaveBeenCalledWith(`${ID}.html`, expect.any(Buffer), {
      upsert: true,
      contentType: "text/html",
    });
    const final = updates.find((u) => u.campos.arquivo_status === "ok")!.campos;
    expect(final).toMatchObject({
      arquivo_path: `${ID}.html`,
      arquivo_tam: Buffer.byteLength(HTML),
      arquivo_status: "ok",
      arquivo_erro: null,
    });
    expect(final.arquivado_em).toEqual(expect.any(String));
    for (const u of updates) expect(u.campos).not.toHaveProperty("pagina_ativa");
  });

  it("sucesso: tira a miniatura da cópia salva, guarda em miniaturas/<id>.png e grava o caminho", async () => {
    const res = await POST(req({ id: ID }));
    expect(res.status).toBe(200);
    // a miniatura sai do arquivo local da cópia, não da página na rede
    expect(mockMiniatura.mock.calls[0][0]).toBe(destinoUsado);
    expect(mockMiniatura.mock.calls[0][2]).toEqual({ exe: "/chrome", args: [] });
    expect(mockUpload).toHaveBeenCalledWith(`miniaturas/${ID}.png`, expect.any(Buffer), { upsert: true, contentType: "image/png" });
    expect(updates[updates.length - 1].campos).toEqual({ miniatura_path: `miniaturas/${ID}.png` });
  });

  it("falha na miniatura não derruba o arquivamento nem apaga o que já foi gravado", async () => {
    mockMiniatura.mockRejectedValue(new FalhaDeArquivamento("sem navegador"));
    const res = await POST(req({ id: ID }));
    expect(res.status).toBe(200);
    expect(updates.some((u) => "miniatura_path" in u.campos)).toBe(false);
    expect(updates.some((u) => u.campos.arquivo_status === "ok")).toBe(true);
    expect(updates.some((u) => u.campos.arquivo_status === "falhou")).toBe(false);
  });

  it("erro ao guardar a miniatura no Storage também não derruba o arquivamento", async () => {
    mockUpload.mockImplementation(async (caminho: string) =>
      caminho.startsWith("miniaturas/") ? { error: { message: "cheio" } } : { error: null },
    );
    const res = await POST(req({ id: ID }));
    expect(res.status).toBe(200);
    expect(updates.some((u) => "miniatura_path" in u.campos)).toBe(false);
  });

  it("captura que falha não gera miniatura", async () => {
    mockCapturar.mockRejectedValue(new FalhaDeArquivamento("quebrou"));
    await POST(req({ id: ID }));
    expect(mockMiniatura).not.toHaveBeenCalled();
  });

  it("o arquivo temporário é removido no sucesso e na falha", async () => {
    await POST(req({ id: ID }));
    expect(fs.existsSync(destinoUsado)).toBe(false);

    mockCapturar.mockImplementation(async (_u: string, destino: string) => {
      destinoUsado = destino;
      fs.writeFileSync(destino, "<html>");
      throw new FalhaDeArquivamento("quebrou");
    });
    await POST(req({ id: ID }));
    expect(fs.existsSync(destinoUsado)).toBe(false);
  });

  it("captura vazia vira 422 'falhou' quando não há cópia", async () => {
    mockCapturar.mockImplementation(async (_u: string, d: string) => fs.writeFileSync(d, ""));
    const res = await POST(req({ id: ID }));
    expect(res.status).toBe(422);
    expect(mockUpload).not.toHaveBeenCalled();
    expect(updates[updates.length - 1].campos).toEqual({
      arquivo_status: "falhou",
      arquivo_erro: "A captura veio vazia ou inválida.",
    });
  });

  it("falha com cópia anterior mantém status 'ok', guarda o motivo e não mexe na cópia", async () => {
    cenario.link = { id: ID, url: "https://do-banco.com/p", arquivo_path: `${ID}.html`, arquivo_tam: 1000 };
    mockCapturar.mockImplementation(async (_u: string, d: string) => fs.writeFileSync(d, HTML)); // 200+ < 500
    const res = await POST(req({ id: ID }));
    expect(res.status).toBe(422);
    expect(mockUpload).not.toHaveBeenCalled();
    const final = updates[updates.length - 1].campos;
    expect(final.arquivo_status).toBe("ok");
    expect(final.arquivo_erro).toMatch(/cópia anterior foi mantida/);
    expect(final).not.toHaveProperty("arquivo_path");
    expect(final).not.toHaveProperty("pagina_ativa");
  });

  it("erro inesperado: 500, mensagem genérica (sem vazar detalhe) e status de falha", async () => {
    mockCapturar.mockRejectedValue(new Error("segredo interno /var/task"));
    const res = await POST(req({ id: ID }));
    expect(res.status).toBe(500);
    expect((await res.json()).erro).toBe("Erro inesperado ao arquivar.");
    expect(updates[updates.length - 1].campos.arquivo_status).toBe("falhou");
  });

  it("navegador indisponível: 422 com a mensagem clara", async () => {
    mockNavegador.mockRejectedValue(
      new FalhaDeArquivamento("O navegador de captura não está disponível neste ambiente."),
    );
    const res = await POST(req({ id: ID }));
    expect(res.status).toBe(422);
    expect((await res.json()).erro).toMatch(/navegador de captura não está disponível/);
  });

  it("falha no upload: 500 e status de falha", async () => {
    cenario.upload = { error: { message: "cheio" } };
    const res = await POST(req({ id: ID }));
    expect(res.status).toBe(500);
    expect(updates[updates.length - 1].campos.arquivo_status).toBe("falhou");
  });
});
