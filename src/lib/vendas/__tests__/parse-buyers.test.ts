import { parseBuyers } from "../parse-buyers";

// Parser da base de compradores (PRD issue #114, seção 3.4, critério 3).
// Função pura: arquivo CSV e colagem TSV do Sheets/Excel devem produzir o
// MESMO resultado lógico; aspas RFC 4180; cabeçalho case-insensitive; coluna
// contendo "email" é a chave; demais colunas viram `extra` sem perda;
// inválidas reportadas com nº da linha; duplicados dedupados (última vence).

describe("parseBuyers — equivalência CSV × TSV (critério 3: arquivo = colagem)", () => {
  const csv = "email,nome,telefone\nmaria@example.com,Maria,11999990000\njoao@example.com,João,11888880000";
  const tsv = "email\tnome\ttelefone\nmaria@example.com\tMaria\t11999990000\njoao@example.com\tJoão\t11888880000";

  it("produz as MESMAS linhas para CSV e TSV com o mesmo conteúdo lógico", () => {
    const fromCsv = parseBuyers(csv);
    const fromTsv = parseBuyers(tsv);
    expect(fromCsv.rows).toEqual(fromTsv.rows);
    expect(fromCsv.invalidRows).toEqual(fromTsv.invalidRows);
    expect(fromCsv.duplicates).toEqual(fromTsv.duplicates);
  });

  it("detecta o separador: TAB na primeira linha ⇒ TSV, senão CSV", () => {
    expect(parseBuyers(csv).delimiter).toBe(",");
    expect(parseBuyers(tsv).delimiter).toBe("\t");
  });

  it("mapeia as colunas conhecidas para email/name/phone", () => {
    const { rows } = parseBuyers(csv);
    expect(rows[0]).toEqual({ email: "maria@example.com", name: "Maria", phone: "11999990000", extra: {} });
  });
});

describe("parseBuyers — cabeçalho case-insensitive e aliases", () => {
  it("reconhece EMAIL/Nome/Name/Telefone/Phone/Celular em qualquer caixa", () => {
    const { rows, error } = parseBuyers("EMAIL,Nome,Celular\nA@Ex.com,Ana,119");
    expect(error).toBeNull();
    expect(rows[0]).toEqual({ email: "a@ex.com", name: "Ana", phone: "119", extra: {} });
  });

  it("aceita 'name' e 'phone' como aliases de nome/telefone", () => {
    const { rows } = parseBuyers("Email,Name,Phone\nb@ex.com,Bob,1");
    expect(rows[0]).toEqual({ email: "b@ex.com", name: "Bob", phone: "1", extra: {} });
  });

  it("usa a coluna que CONTÉM 'email' como chave (ex: 'E-mail principal')", () => {
    const { rows } = parseBuyers("E-mail principal,Nome\nc@ex.com,Carla");
    expect(rows[0].email).toBe("c@ex.com");
  });
});

describe("parseBuyers — colunas extras preservadas sem perda", () => {
  it("joga colunas desconhecidas em extra com a chave = cabeçalho original", () => {
    const { rows } = parseBuyers("email,cidade,plano\nd@ex.com,São Paulo,Anual");
    expect(rows[0].extra).toEqual({ cidade: "São Paulo", plano: "Anual" });
  });

  it("preserva o cabeçalho original (com caixa) na chave de extra", () => {
    const { rows } = parseBuyers("Email,Origem UTM\ne@ex.com,facebook");
    expect(rows[0].extra).toEqual({ "Origem UTM": "facebook" });
  });
});

describe("parseBuyers — aspas RFC 4180 no CSV", () => {
  it("respeita separador dentro de aspas", () => {
    const { rows } = parseBuyers('email,nome\nf@ex.com,"Silva, Junior"');
    expect(rows[0].name).toBe("Silva, Junior");
  });

  it("desdobra aspas internas duplicadas", () => {
    const { rows } = parseBuyers('email,nome\ng@ex.com,"Maria ""M."" Silva"');
    expect(rows[0].name).toBe('Maria "M." Silva');
  });

  it("aceita quebra de linha dentro de campo entre aspas", () => {
    const { rows } = parseBuyers('email,obs\nh@ex.com,"linha1\nlinha2"');
    expect(rows).toHaveLength(1);
    expect(rows[0].extra.obs).toBe("linha1\nlinha2");
  });
});

describe("parseBuyers — erro de cabeçalho (sem coluna de email)", () => {
  it("retorna erro claro quando não há coluna de email", () => {
    const { rows, error } = parseBuyers("nome,telefone\nAna,119");
    expect(rows).toHaveLength(0);
    expect(error).toMatch(/email/i);
  });

  it("retorna erro para entrada vazia", () => {
    expect(parseBuyers("").error).toBeTruthy();
    expect(parseBuyers("   \n  ").error).toBeTruthy();
  });
});

describe("parseBuyers — linhas inválidas reportadas e ignoradas", () => {
  it("lista linhas sem email válido com nº da linha e as ignora", () => {
    const { rows, invalidRows } = parseBuyers(
      "email,nome\n,SemEmail\nbademail,Bad\nok@ex.com,Ok"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("ok@ex.com");
    expect(invalidRows).toHaveLength(2);
    // Cabeçalho é a linha 1; primeira linha de dados é a 2.
    expect(invalidRows[0].line).toBe(2);
    expect(invalidRows[1].line).toBe(3);
    expect(invalidRows[0].content).toContain("SemEmail");
  });

  it("ignora linhas totalmente em branco sem marcá-las como inválidas", () => {
    const { rows, invalidRows } = parseBuyers("email\nok@ex.com\n\n\n");
    expect(rows).toHaveLength(1);
    expect(invalidRows).toHaveLength(0);
  });
});

describe("parseBuyers — dedupe última ocorrência vence", () => {
  it("dedupa por email e reporta os duplicados; a última linha vence", () => {
    const { rows, duplicates } = parseBuyers(
      "email,nome\ndup@ex.com,Primeiro\ndup@ex.com,Ultimo\nunico@ex.com,Único"
    );
    expect(rows).toHaveLength(2);
    const dup = rows.find((r) => r.email === "dup@ex.com");
    expect(dup?.name).toBe("Ultimo");
    expect(duplicates).toEqual(["dup@ex.com"]);
  });

  it("dedupa case-insensitive no email (normaliza para minúsculas)", () => {
    const { rows, duplicates } = parseBuyers("email\nDup@Ex.com\ndup@ex.com");
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("dup@ex.com");
    expect(duplicates).toEqual(["dup@ex.com"]);
  });
});

describe("parseBuyers — normalização e campos vazios", () => {
  it("faz trim e lowercase do email", () => {
    const { rows } = parseBuyers("email\n  MAIÚSCULO@Ex.com  ");
    expect(rows[0].email).toBe("maiúsculo@ex.com");
  });

  it("nome/telefone vazios viram null", () => {
    const { rows } = parseBuyers("email,nome,telefone\nz@ex.com,,");
    expect(rows[0].name).toBeNull();
    expect(rows[0].phone).toBeNull();
  });

  it("aceita CRLF (Windows) além de LF", () => {
    const { rows } = parseBuyers("email,nome\r\ncrlf@ex.com,Win");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ email: "crlf@ex.com", name: "Win", phone: null, extra: {} });
  });
});
