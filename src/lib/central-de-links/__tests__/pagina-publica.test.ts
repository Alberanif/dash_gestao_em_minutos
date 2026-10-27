import {
  escaparHtml,
  idPublicoValido,
  ehUuid,
  injetarTitulo,
  montarSelo,
  injetarSelo,
  transformarPagina,
} from "../pagina-publica";

describe("idPublicoValido", () => {
  it("aceita slug e uuid", () => {
    expect(idPublicoValido("minha-pagina-2")).toBe(true);
    expect(idPublicoValido("0b8f2a4e-1111-4222-8333-444455556666")).toBe(true);
  });
  it("recusa vazio, caracteres estranhos e mais de 120", () => {
    expect(idPublicoValido("")).toBe(false);
    expect(idPublicoValido("a/b")).toBe(false);
    expect(idPublicoValido("a b")).toBe(false);
    expect(idPublicoValido("a".repeat(121))).toBe(false);
    expect(idPublicoValido("a".repeat(120))).toBe(true);
  });
});

describe("ehUuid", () => {
  it("distingue uuid de slug", () => {
    expect(ehUuid("0B8F2A4E-1111-4222-8333-444455556666")).toBe(true);
    expect(ehUuid("minha-pagina")).toBe(false);
  });
});

describe("escaparHtml", () => {
  it("escapa os cinco caracteres perigosos", () => {
    expect(escaparHtml(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
  });
});

describe("injetarTitulo", () => {
  it("troca o <title> existente", () => {
    const r = injetarTitulo("<html><head><title>Velho</title></head></html>", "Novo");
    expect(r).toBe("<html><head><title>Novo</title></head></html>");
  });
  it("sem <title>, coloca logo após <head>", () => {
    expect(injetarTitulo('<head lang="pt"><meta></head>', "X")).toBe('<head lang="pt"><title>X</title><meta></head>');
  });
  it("sem <title> nem <head>, prefixa", () => {
    expect(injetarTitulo("<p>oi</p>", "X")).toBe("<title>X</title><p>oi</p>");
  });
  it("escapa rótulo com <script>", () => {
    const r = injetarTitulo("<p/>", "<script>alert(1)</script>");
    expect(r).not.toContain("<script>");
    expect(r).toContain("&lt;script&gt;");
  });
  it("não interpreta $& do rótulo como padrão de substituição", () => {
    expect(injetarTitulo("<title>a</title>", "$&")).toBe("<title>$&amp;</title>");
  });
});

describe("montarSelo / injetarSelo", () => {
  it("mostra a data em America/Sao_Paulo", () => {
    // 02:00 UTC de 16/10 ainda é 15/10 em São Paulo
    expect(montarSelo("2026-10-16T02:00:00Z")).toContain("Página arquivada em 15/10/2026");
  });
  it("sem data, só 'Página arquivada'", () => {
    const s = montarSelo(null);
    expect(s).toContain("Página arquivada</div>");
    expect(s).not.toContain(" em ");
  });
  it("entra antes de </body>", () => {
    const r = injetarSelo("<body>x</body>", "<S>");
    expect(r).toBe("<body>x<S></body>");
  });
  it("sem </body>, vai ao final", () => {
    expect(injetarSelo("<p>x</p>", "<S>")).toBe("<p>x</p><S>");
  });
});

describe("transformarPagina", () => {
  it("aplica título e selo", () => {
    const r = transformarPagina("<head><title>a</title></head><body></body>", {
      label: "Meu <b>",
      arquivado_em: "2026-10-16T15:00:00Z",
    });
    expect(r).toContain("<title>Meu &lt;b&gt;</title>");
    expect(r).toContain("Página arquivada em 16/10/2026");
    expect(r.indexOf("Página arquivada")).toBeLessThan(r.indexOf("</body>"));
  });
});
