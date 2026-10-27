import {
  montarGrupos,
  ordemDasPastas,
  nomesDaPasta,
  ordemDeGrupos,
  linksDoGrupo,
  contarPorGrupo,
  buscarLinks,
  mover,
  proximaPosicao,
} from "../organizacao";
import type { LinkDaCentral } from "../tipos";

function link(p: Partial<LinkDaCentral>): LinkDaCentral {
  return {
    id: "i", label: "L", url: "https://x.com", grupo: "G", tipo: "cap", deleted: false,
    slug: null, pagina_ativa: false, arquivo_path: null, arquivo_tam: null,
    arquivado_em: null, arquivo_status: null, arquivo_erro: null, arquivo_tentativa_em: null,
    ...p,
  };
}

describe("montarGrupos", () => {
  it("indexa as linhas e cria grupo órfão com 9999 e sem pasta", () => {
    const m = montarGrupos(
      [{ nome: "A", position: 2, pasta: "P" }],
      [link({ grupo: "A" }), link({ grupo: "Órfão" })],
    );
    expect(m).toEqual({
      A: { position: 2, pasta: "P", cor: null },
      "Órfão": { position: 9999, pasta: null },
    });
  });
});

describe("nomesDaPasta", () => {
  const pastas = [{ nome: "P", position: 0 }];
  const grupos = {
    B: { position: 1, pasta: "P" },
    A: { position: 1, pasta: "P" },
    C: { position: 0, pasta: "P" },
    Solto: { position: 0, pasta: null },
    Fantasma: { position: 3, pasta: "Inexistente" },
  };
  it("ordena por position e depois por nome", () => {
    expect(nomesDaPasta(grupos, pastas, "P")).toEqual(["C", "A", "B"]);
  });
  it("pasta null inclui soltos e grupos de pasta inexistente", () => {
    expect(nomesDaPasta(grupos, pastas, null)).toEqual(["Solto", "Fantasma"]);
  });
});

describe("ordemDeGrupos", () => {
  it("pastas em ordem, depois soltos", () => {
    const pastas = [{ nome: "Z", position: 1 }, { nome: "Y", position: 0 }];
    const grupos = {
      g1: { position: 0, pasta: "Z" },
      g2: { position: 0, pasta: "Y" },
      g3: { position: 0, pasta: null },
    };
    expect(ordemDeGrupos(grupos, pastas)).toEqual(["g2", "g1", "g3"]);
  });
});

describe("linksDoGrupo / contarPorGrupo / buscarLinks", () => {
  const ls = [
    link({ id: "1", label: "Zebra", grupo: "A", url: "https://a.com/zeta" }),
    link({ id: "2", label: "Água", grupo: "A", url: "https://b.com" }),
    link({ id: "3", label: "Outro", grupo: "B", url: "https://c.com" }),
  ];
  it("filtra pelo grupo e ordena por rótulo em pt-BR", () => {
    expect(linksDoGrupo(ls, "A").map((l) => l.id)).toEqual(["2", "1"]);
  });
  it("conta por grupo", () => {
    expect(contarPorGrupo(ls)).toEqual({ A: 2, B: 1 });
  });
  it("busca por rótulo ou URL, sem diferenciar caixa, ordenada", () => {
    expect(buscarLinks(ls, "ZEBRA").map((l) => l.id)).toEqual(["1"]);
    expect(buscarLinks(ls, "B.COM").map((l) => l.id)).toEqual(["2"]);
  });
  it("termo vazio devolve todos", () => {
    expect(buscarLinks(ls, "")).toHaveLength(3);
  });
});

describe("mover", () => {
  const itens = [
    { nome: "a", position: 5 },
    { nome: "b", position: 7 },
    { nome: "c", position: 9 },
  ];
  it("troca com o vizinho e reindexa 0..n-1", () => {
    expect(mover(itens, "b", -1)).toEqual([
      { nome: "b", position: 0 },
      { nome: "a", position: 1 },
      { nome: "c", position: 2 },
    ]);
    expect(mover(itens, "b", 1)!.map((i) => i.nome)).toEqual(["a", "c", "b"]);
  });
  it("devolve null nas bordas e para nome inexistente", () => {
    expect(mover(itens, "a", -1)).toBeNull();
    expect(mover(itens, "c", 1)).toBeNull();
    expect(mover(itens, "zz", 1)).toBeNull();
  });
  it("não muta a entrada", () => {
    mover(itens, "b", 1);
    expect(itens[1]).toEqual({ nome: "b", position: 7 });
  });
});

describe("proximaPosicao", () => {
  it("máximo + 1 ignorando 9999; vazio = 0", () => {
    expect(proximaPosicao([])).toBe(0);
    expect(proximaPosicao([0, 3, 9999])).toBe(4);
    expect(proximaPosicao([9999])).toBe(0);
  });
});

describe("ordemDasPastas", () => {
  it("é uma lista só: por posição e depois nome, sem olhar a pasta antiga", () => {
    const grupos = {
      Z: { position: 0, pasta: "Velha" },
      B: { position: 1, pasta: null },
      A: { position: 1, pasta: "Outra" },
      Solto: { position: 9999, pasta: null },
    };
    expect(ordemDasPastas(grupos)).toEqual(["Z", "A", "B", "Solto"]);
  });

  it("montarGrupos guarda a cor do grupo", () => {
    expect(montarGrupos([{ nome: "A", position: 0, pasta: null, cor: "rosa" }], [])).toEqual({
      A: { position: 0, pasta: null, cor: "rosa" },
    });
  });
});
