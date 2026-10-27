import {
  FalhaDeArquivamento,
  LIMITE_BYTES,
  TEMPO_CAPTURA_MS,
  TRAVA_OBSOLETA_MS,
  ENCOLHEU_ABAIXO,
  validarCaptura,
  statusAposFalha,
  limitarMensagem,
  travaObsoleta,
} from "../arquivamento";

const html = (n: number) => {
  const base = "<html><body>";
  return Buffer.from(base + "x".repeat(Math.max(0, n - base.length)));
};
const sem = { temCopia: false, tamanhoAtual: null };

describe("constantes", () => {
  it("batem com o contrato", () => {
    expect(LIMITE_BYTES).toBe(50 * 1024 * 1024);
    expect(TEMPO_CAPTURA_MS).toBe(240_000);
    expect(TRAVA_OBSOLETA_MS).toBe(6 * 60_000);
    expect(ENCOLHEU_ABAIXO).toBe(0.5);
  });
});

describe("validarCaptura", () => {
  it("aceita captura válida sem cópia", () => {
    expect(() => validarCaptura(html(1000), sem)).not.toThrow();
  });
  it("recusa vazia", () => {
    expect(() => validarCaptura(Buffer.alloc(0), sem)).toThrow(FalhaDeArquivamento);
    expect(() => validarCaptura(Buffer.alloc(0), sem)).toThrow("A captura veio vazia ou inválida.");
  });
  it("recusa sem <html", () => {
    expect(() => validarCaptura(Buffer.from("só texto"), sem)).toThrow("A captura veio vazia ou inválida.");
  });
  it("aceita <HTML em maiúsculas", () => {
    expect(() => validarCaptura(Buffer.from("<!DOCTYPE html><HTML><body>a"), sem)).not.toThrow();
  });
  it("só procura <html nos primeiros 4096 bytes", () => {
    const dentro = Buffer.concat([Buffer.alloc(4091, "a"), Buffer.from("<html>")]);
    const fora = Buffer.concat([Buffer.alloc(4092, "a"), Buffer.from("<html>")]);
    expect(() => validarCaptura(dentro, sem)).not.toThrow();
    expect(() => validarCaptura(fora, sem)).toThrow("A captura veio vazia ou inválida.");
  });
  it("limite de 50 MB: exato passa, 1 byte a mais falha", () => {
    const exato = Buffer.alloc(LIMITE_BYTES, "a");
    exato.write("<html>");
    expect(() => validarCaptura(exato, sem)).not.toThrow();
    const demais = Buffer.alloc(LIMITE_BYTES + 1, "a");
    demais.write("<html>");
    expect(() => validarCaptura(demais, sem)).toThrow(FalhaDeArquivamento);
    expect(() => validarCaptura(demais, sem)).toThrow("A cópia passa de 50 MB.");
  });
  it("encolher abaixo de 50% da cópia atual falha", () => {
    const msg = "A nova captura ficou muito menor que a cópia atual; a cópia anterior foi mantida.";
    expect(() => validarCaptura(html(499), { temCopia: true, tamanhoAtual: 1000 })).toThrow(msg);
  });
  it("exatamente 50% passa", () => {
    expect(() => validarCaptura(html(500), { temCopia: true, tamanhoAtual: 1000 })).not.toThrow();
  });
  it("sem cópia atual não aplica o limiar de encolhimento", () => {
    expect(() => validarCaptura(html(100), { temCopia: false, tamanhoAtual: 1000 })).not.toThrow();
  });
  it("com cópia mas tamanho desconhecido não aplica o limiar", () => {
    expect(() => validarCaptura(html(100), { temCopia: true, tamanhoAtual: null })).not.toThrow();
  });
  it("cópia que cresce passa", () => {
    expect(() => validarCaptura(html(5000), { temCopia: true, tamanhoAtual: 1000 })).not.toThrow();
  });
});

describe("statusAposFalha", () => {
  it("com cópia anterior segue ok", () => expect(statusAposFalha(true)).toBe("ok"));
  it("sem cópia vira falhou", () => expect(statusAposFalha(false)).toBe("falhou"));
});

describe("limitarMensagem", () => {
  it("mantém mensagem curta", () => expect(limitarMensagem("oi")).toBe("oi"));
  it("300 caracteres passam inteiros", () => expect(limitarMensagem("a".repeat(300))).toHaveLength(300));
  it("301 é cortado em 300", () => expect(limitarMensagem("a".repeat(301))).toBe("a".repeat(300)));
});

describe("travaObsoleta", () => {
  const agora = new Date("2026-10-26T12:00:00Z");
  const ha = (ms: number) => new Date(agora.getTime() - ms).toISOString();
  it("sem data é obsoleta", () => expect(travaObsoleta(null, agora)).toBe(true));
  it("recente não é obsoleta", () => expect(travaObsoleta(ha(60_000), agora)).toBe(false));
  it("exatamente 6 min ainda não é obsoleta", () => expect(travaObsoleta(ha(TRAVA_OBSOLETA_MS), agora)).toBe(false));
  it("passou de 6 min é obsoleta", () => expect(travaObsoleta(ha(TRAVA_OBSOLETA_MS + 1), agora)).toBe(true));
  it("data inválida é obsoleta", () => expect(travaObsoleta("lixo", agora)).toBe(true));
});
