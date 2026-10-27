import {
  ErroDeRegra,
  MAX_VARIANTES,
  MIN_VARIANTES,
  checarEdicao,
  checarExclusao,
  checarInicio,
  conferirLinks,
  erroDoBanco,
  montarEncerramento,
  validarDados,
  validarIdTeste,
} from "../ab-testes";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function falha(fn: () => unknown): ErroDeRegra {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ErroDeRegra);
    return e as ErroDeRegra;
  }
  throw new Error("não lançou");
}

describe("ErroDeRegra", () => {
  it("carrega status e mensagem", () => {
    const e = new ErroDeRegra(409, "x");
    expect(e.status).toBe(409);
    expect(e.mensagem).toBe("x");
    expect(e.message).toBe("x");
    expect(e).toBeInstanceOf(Error);
  });
});

describe("constantes", () => {
  it("2 a 8 variantes", () => {
    expect([MIN_VARIANTES, MAX_VARIANTES]).toEqual([2, 8]);
  });
});

describe("validarDados", () => {
  it("normaliza: apara nome e rótulo, minusculiza link_id, controle só com true", () => {
    const r = validarDados({
      nome: "  T  ",
      variantes: [
        { link_id: A.toUpperCase(), rotulo: " A ", controle: true },
        { link_id: B, rotulo: "B", controle: "sim" },
      ],
    });
    expect(r).toEqual({
      nome: "T",
      variantes: [
        { link_id: A, rotulo: "A", controle: true },
        { link_id: B, rotulo: "B", controle: false },
      ],
    });
  });

  it("corpo nulo ou não objeto cai em 'Informe o nome'", () => {
    expect(falha(() => validarDados(null)).mensagem).toBe("Informe o nome do teste.");
    expect(falha(() => validarDados("x")).status).toBe(400);
  });

  it("variantes que não são objetos caem em página inválida", () => {
    const e = falha(() => validarDados({ nome: "t", variantes: [null, 3] }));
    expect(e.mensagem).toBe("Página inválida em uma das variantes.");
  });

  it("limites: nome 120 ok/121 não", () => {
    const v = [
      { link_id: A, rotulo: "A", controle: true },
      { link_id: B, rotulo: "B" },
    ];
    expect(() => validarDados({ nome: "x".repeat(120), variantes: v })).not.toThrow();
    expect(falha(() => validarDados({ nome: "x".repeat(121), variantes: v })).status).toBe(400);
  });

  it("limites: rótulo 20 ok/21 não", () => {
    const mk = (n: number) => ({
      nome: "t",
      variantes: [
        { link_id: A, rotulo: "r".repeat(n), controle: true },
        { link_id: B, rotulo: "B" },
      ],
    });
    expect(() => validarDados(mk(20))).not.toThrow();
    expect(falha(() => validarDados(mk(21))).mensagem).toBe("O rótulo da variante pode ter no máximo 20 caracteres.");
  });
});

describe("duplicidade sem diferenciar caixa", () => {
  const H = "abcdefab-abcd-4bcd-8bcd-abcdefabcdef";
  it("link e rótulo repetidos em caixas diferentes", () => {
    expect(
      falha(() => validarDados({ nome: "t", variantes: [{ link_id: H, rotulo: "A", controle: true }, { link_id: H.toUpperCase(), rotulo: "B" }] })).mensagem,
    ).toBe("A mesma página não pode aparecer duas vezes no teste.");
    expect(
      falha(() => validarDados({ nome: "t", variantes: [{ link_id: A, rotulo: "a", controle: true }, { link_id: B, rotulo: "A" }] })).mensagem,
    ).toBe("Os rótulos das variantes precisam ser diferentes.");
  });
});

describe("validarIdTeste", () => {
  it("aceita uuid e recusa o resto", () => {
    expect(validarIdTeste(A)).toBe(A);
    expect(falha(() => validarIdTeste("abc")).mensagem).toBe("Teste inválido.");
    expect(falha(() => validarIdTeste(undefined)).status).toBe(400);
    expect(falha(() => validarIdTeste(A + "x")).status).toBe(400);
  });
});

describe("conferirLinks", () => {
  const ok = { id: A, label: "P", tipo: "cap", deleted: false };
  it("passa com link cap vivo (id em outra caixa)", () => {
    expect(() => conferirLinks([A.toUpperCase()], [ok])).not.toThrow();
  });
  it("recusa ausente, excluído e não-cap", () => {
    expect(falha(() => conferirLinks([A], [])).mensagem).toBe("Uma das páginas escolhidas não existe mais.");
    expect(falha(() => conferirLinks([A], null)).status).toBe(400);
    expect(falha(() => conferirLinks([A], [{ ...ok, deleted: true }])).status).toBe(400);
    expect(falha(() => conferirLinks([A], [{ ...ok, tipo: "link", label: "Meu" }])).mensagem).toBe(
      'A página "Meu" não é uma página de captura.',
    );
  });
});

describe("ciclo de vida", () => {
  const vs = (n: number, controles = 1) =>
    Array.from({ length: n }, (_, i) => ({ id: "v" + i, link_id: "l" + i, controle: i < controles }));

  it("checarEdicao: só rascunho", () => {
    expect(() => checarEdicao({ id: "t", status: "rascunho" })).not.toThrow();
    expect(falha(() => checarEdicao({ id: "t", status: "ativo" })).status).toBe(409);
  });

  it("checarInicio: rascunho, 2+ variantes, 1 controle", () => {
    expect(() => checarInicio({ id: "t", status: "rascunho", ab_variantes: vs(2) })).not.toThrow();
    expect(falha(() => checarInicio({ id: "t", status: "ativo", ab_variantes: vs(2) })).status).toBe(409);
    expect(falha(() => checarInicio({ id: "t", status: "rascunho", ab_variantes: vs(1) })).status).toBe(400);
    expect(falha(() => checarInicio({ id: "t", status: "rascunho" })).status).toBe(400);
    expect(falha(() => checarInicio({ id: "t", status: "rascunho", ab_variantes: vs(2, 0) })).status).toBe(400);
    expect(falha(() => checarInicio({ id: "t", status: "rascunho", ab_variantes: vs(2, 2) })).status).toBe(400);
  });

  it("montarEncerramento: ativo; vencedor minúsculo ou null; anotação aparada", () => {
    const t = { id: "t", status: "ativo", ab_variantes: [{ id: "AbC", link_id: "l", controle: true }] };
    const agora = new Date("2026-01-02T03:04:05.000Z");
    expect(montarEncerramento(t, { vencedor_variante: "ABC", anotacao: " ok " }, agora)).toEqual({
      status: "encerrado",
      encerrado_em: "2026-01-02T03:04:05.000Z",
      vencedor_variante: "abc",
      anotacao: "ok",
    });
    expect(montarEncerramento(t, {}, agora).vencedor_variante).toBeNull();
    expect(falha(() => montarEncerramento({ ...t, status: "rascunho" }, {})).status).toBe(409);
    expect(falha(() => montarEncerramento(t, { vencedor_variante: "zzz" })).status).toBe(400);
    expect(falha(() => montarEncerramento(t, { anotacao: "x".repeat(2001) })).status).toBe(400);
  });

  it("checarExclusao: ativo nunca; encerrado só com confirmar === true; rascunho livre", () => {
    expect(() => checarExclusao({ id: "t", status: "rascunho" }, {})).not.toThrow();
    expect(falha(() => checarExclusao({ id: "t", status: "ativo" }, { confirmar: true })).status).toBe(409);
    expect(falha(() => checarExclusao({ id: "t", status: "encerrado" }, {})).status).toBe(400);
    expect(() => checarExclusao({ id: "t", status: "encerrado" }, { confirmar: true })).not.toThrow();
  });
});

describe("erroDoBanco", () => {
  it("23505 -> 409 com a mensagem; outro -> 500 genérico", () => {
    const a = erroDoBanco({ code: "23505", message: "msg" });
    expect([a.status, a.mensagem]).toEqual([409, "msg"]);
    expect(erroDoBanco({ code: "23505" }).mensagem).toBe("Já existe um registro igual a este.");
    const b = erroDoBanco({ code: "42P01", message: "tabela" });
    expect([b.status, b.mensagem]).toEqual([500, "Erro ao acessar o banco de dados."]);
    expect(erroDoBanco(null).status).toBe(500);
  });
});
