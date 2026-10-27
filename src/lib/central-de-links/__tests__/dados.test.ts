import {
  lerTudo, salvarLink, excluirLink, criarPasta, excluirPasta, criarGrupo,
  moverGrupoDePasta, excluirGrupo, reordenarPastas, reordenarGrupos, type Cliente,
  validarPaginaAtiva, LIMITE_ARQUIVO, enviarArquivo, removerArquivo, baixarCopia, definirPaginaAtiva, lerLink,
  renomearPasta, definirCorDaPasta, urlsDeMiniaturas, SEM_MIGRATION,
} from "../dados";
import type { LinkDaCentral } from "../tipos";

type Op = { m: string; a: unknown[] };
type Chamada = { tabela: string; ops: Op[] };
type Resposta = { data?: unknown; error?: { message: string } | null };

/** Dublê do cliente Supabase: registra o encadeamento e responde via `resolver`. */
function duble(resolver: (c: Chamada) => Resposta) {
  const chamadas: Chamada[] = [];
  const sb = {
    from(tabela: string) {
      const c: Chamada = { tabela, ops: [] };
      chamadas.push(c);
      const b: Record<string, unknown> = {};
      for (const m of ["select", "insert", "update", "upsert", "delete", "eq", "neq", "order", "range", "limit"]) {
        b[m] = (...a: unknown[]) => { c.ops.push({ m, a }); return b; };
      }
      b.then = (ok: (r: Resposta) => unknown, ko: (e: unknown) => unknown) =>
        Promise.resolve({ error: null, ...resolver(c) }).then(ok, ko);
      return b;
    },
  };
  return { sb: sb as unknown as Cliente, chamadas };
}
const op = (c: Chamada, m: string) => c.ops.find((o) => o.m === m);
const temOp = (c: Chamada, m: string) => !!op(c, m);

function link(p: Partial<LinkDaCentral> = {}): LinkDaCentral {
  return {
    id: "i", label: "L", url: "https://x.com", grupo: "G", tipo: "cap", deleted: false,
    slug: null, pagina_ativa: false, arquivo_path: null, arquivo_tam: null,
    arquivado_em: null, arquivo_status: null, arquivo_erro: null, arquivo_tentativa_em: null,
    ...p,
  };
}

describe("lerTudo", () => {
  it("pagina de 1000 em 1000, filtra deleted=false e mapeia grupo -> nome", async () => {
    const cheio = Array.from({ length: 1000 }, (_, i) => ({ id: String(i) }));
    const { sb, chamadas } = duble((c) => {
      if (c.tabela === "central_links") {
        const de = (op(c, "range")!.a as number[])[0];
        return { data: de === 0 ? cheio : [{ id: "ultimo" }] };
      }
      if (c.tabela === "central_grupo_order") return { data: [{ grupo: "A", position: 1, pasta: "P" }] };
      return { data: [{ nome: "P", position: 0 }] };
    });
    const r = await lerTudo(sb);
    expect(r.links).toHaveLength(1001);
    expect(r.grupos).toEqual([{ nome: "A", position: 1, pasta: "P", cor: null }]);
    expect(r.pastas).toEqual([{ nome: "P", position: 0 }]);
    const doLinks = chamadas.filter((c) => c.tabela === "central_links");
    expect(doLinks.map((c) => op(c, "range")!.a)).toEqual([[0, 999], [1000, 1999]]);
    expect(op(doLinks[0], "eq")!.a).toEqual(["deleted", false]);
  });

  it("propaga erro em português", async () => {
    const { sb } = duble(() => ({ data: null, error: { message: "boom" } }));
    await expect(lerTudo(sb)).rejects.toThrow(/Erro ao carregar/);
  });
});

describe("salvarLink", () => {
  const base = { label: " Meu ", url: " https://a.com ", grupo: " G1 ", tipo: "vnd" as const };

  it("valida nome, grupo e URL sem tocar no banco", async () => {
    const { sb, chamadas } = duble(() => ({ data: [] }));
    await expect(salvarLink(sb, { ...base, label: " " }, [])).rejects.toThrow("Preencha nome e grupo.");
    await expect(salvarLink(sb, { ...base, grupo: "" }, [])).rejects.toThrow("Preencha nome e grupo.");
    await expect(salvarLink(sb, { ...base, url: "a.com" }, [])).rejects.toThrow("Informe uma URL válida, com http:// ou https://.");
    expect(chamadas).toHaveLength(0);
  });

  it("cria link novo e cria o grupo ausente na posição seguinte dos soltos", async () => {
    const { sb, chamadas } = duble((c) => {
      if (c.tabela === "central_links" && temOp(c, "insert")) return { data: [{ id: "novo" }] };
      if (c.tabela === "central_links") return { data: [] };
      return { data: [{ grupo: "X", position: 4, pasta: null }, { grupo: "Y", position: 9, pasta: "P" }] };
    });
    await expect(salvarLink(sb, base, [])).resolves.toBe("novo");
    const ins = chamadas.find((c) => temOp(c, "insert"))!;
    expect(op(ins, "insert")!.a[0]).toEqual({ label: "Meu", url: "https://a.com", grupo: "G1", tipo: "vnd", deleted: false, slug: "meu" });
    const up = chamadas.find((c) => c.tabela === "central_grupo_order" && temOp(c, "upsert"))!;
    expect(op(up, "upsert")!.a).toEqual([
      { grupo: "G1", position: 5, pasta: null },
      { onConflict: "grupo", ignoreDuplicates: true },
    ]);
  });

  it("não recria grupo existente", async () => {
    const { sb, chamadas } = duble((c) => {
      if (temOp(c, "insert")) return { data: [{ id: "n" }] };
      if (c.tabela === "central_links") return { data: [] };
      return { data: [{ grupo: "G1", position: 0, pasta: null }] };
    });
    await salvarLink(sb, base, []);
    expect(chamadas.some((c) => c.tabela === "central_grupo_order" && temOp(c, "upsert"))).toBe(false);
  });

  it("grupo existente mas sem ordem (9999) é recriado na posição seguinte", async () => {
    const { sb, chamadas } = duble((c) => {
      if (temOp(c, "insert")) return { data: [{ id: "n" }] };
      if (c.tabela === "central_links") return { data: [] };
      return { data: [{ grupo: "G1", position: 9999, pasta: null }, { grupo: "X", position: 2, pasta: null }] };
    });
    await salvarLink(sb, base, []);
    const up = chamadas.find((c) => c.tabela === "central_grupo_order" && temOp(c, "upsert"))!;
    expect((op(up, "upsert")!.a[0] as { position: number }).position).toBe(3);
  });

  it("edita pelo id e barra sem permissão quando 0 linhas voltam", async () => {
    const { sb } = duble(() => ({ data: [] }));
    await expect(salvarLink(sb, { ...base, id: "a1" }, [])).rejects.toThrow("Sem permissão para esta ação.");
  });

  it("atualiza com eq id quando edita", async () => {
    const { sb, chamadas } = duble((c) => {
      if (temOp(c, "update")) return { data: [{ id: "a1" }] };
      if (c.tabela === "central_links") return { data: [] };
      return { data: [{ grupo: "G1", position: 0, pasta: null }] };
    });
    await salvarLink(sb, { ...base, id: "a1" }, []);
    const up = chamadas.find((c) => temOp(c, "update"))!;
    expect(op(up, "eq")!.a).toEqual(["id", "a1"]);
    expect(op(up, "update")!.a[0]).toMatchObject({ deleted: false, grupo: "G1" });
  });

  it("bloqueia URL já cadastrada (local) em outro link", async () => {
    const { sb, chamadas } = duble(() => ({ data: [] }));
    await expect(
      salvarLink(sb, base, [link({ id: "o", url: "https://a.com" })]),
    ).rejects.toThrow("Essa URL já está cadastrada.");
    expect(chamadas.some((c) => temOp(c, "insert"))).toBe(false);
  });

  it("bloqueia URL duplicada ativa vista no banco", async () => {
    const { sb } = duble((c) =>
      c.tabela === "central_links" ? { data: [{ id: "o", deleted: false }] } : { data: [] });
    await expect(salvarLink(sb, base, [])).rejects.toThrow("Essa URL já está cadastrada.");
  });

  it("reaproveita a linha excluída com a mesma URL (update, não insert)", async () => {
    const { sb, chamadas } = duble((c) => {
      if (temOp(c, "update")) return { data: [{ id: "morto" }] };
      if (c.tabela === "central_links") return { data: [{ id: "morto", deleted: true }] };
      return { data: [{ grupo: "G1", position: 0, pasta: null }] };
    });
    await salvarLink(sb, base, []);
    expect(chamadas.some((c) => temOp(c, "insert"))).toBe(false);
    const up = chamadas.find((c) => temOp(c, "update"))!;
    expect(op(up, "eq")!.a).toEqual(["id", "morto"]);
    expect(op(up, "update")!.a[0]).toMatchObject({ deleted: false, label: "Meu", url: "https://a.com" });
  });

  it("editar o próprio link com a mesma URL não é duplicata", async () => {
    const { sb } = duble((c) => {
      if (temOp(c, "update")) return { data: [{ id: "a1" }] };
      if (c.tabela === "central_links") return { data: [{ id: "a1", deleted: false }] };
      return { data: [{ grupo: "G1", position: 0, pasta: null }] };
    });
    await expect(
      salvarLink(sb, { ...base, id: "a1" }, [link({ id: "a1", url: "https://a.com" })]),
    ).resolves.toBe("a1");
  });
});

describe("salvarLink: slug e página pública", () => {
  const base = { label: "Aula Grátis", url: "https://a.com", grupo: "G1", tipo: "vnd" as const };
  const grupoOk = { grupo: "G1", position: 0, pasta: null };
  const dubleOk = (id = "n") =>
    duble((c) => {
      if (temOp(c, "insert") || temOp(c, "update")) return { data: [{ id }] };
      if (c.tabela === "central_links") return { data: [] };
      return { data: [grupoOk] };
    });
  const campos = (chamadas: Chamada[]) => {
    const c = chamadas.find((x) => temOp(x, "insert") || temOp(x, "update"))!;
    return (op(c, "insert") ?? op(c, "update"))!.a[0] as Record<string, unknown>;
  };

  it("link novo sem slug ganha slug do nome, evitando os ocupados (inclusive excluídos)", async () => {
    const { sb, chamadas } = dubleOk();
    await salvarLink(sb, base, [
      link({ id: "1", slug: "aula-gratis" }),
      link({ id: "2", slug: "aula-gratis-2", deleted: true, url: "https://z.com" }),
    ]);
    expect(campos(chamadas).slug).toBe("aula-gratis-3");
  });

  it("slug informado e válido é gravado", async () => {
    const { sb, chamadas } = dubleOk();
    await salvarLink(sb, { ...base, slug: "meu-apelido" }, []);
    expect(campos(chamadas).slug).toBe("meu-apelido");
  });

  it("slug inválido é recusado sem tocar no banco", async () => {
    const { sb, chamadas } = dubleOk();
    await expect(salvarLink(sb, { ...base, slug: "Meu Apelido" }, [])).rejects.toThrow(/Endereço inválido/);
    expect(chamadas).toHaveLength(0);
  });

  it("slug de OUTRO link é recusado; do próprio link passa", async () => {
    const { sb, chamadas } = dubleOk("a1");
    const outros = [link({ id: "o", url: "https://o.com", slug: "x" }), link({ id: "a1", slug: "meu" })];
    await expect(salvarLink(sb, { ...base, slug: "x" }, outros)).rejects.toThrow(/já está em uso/);
    expect(chamadas).toHaveLength(0);
    await expect(salvarLink(sb, { ...base, id: "a1", slug: "meu" }, outros)).resolves.toBe("a1");
  });

  it("slug ocupado por link excluído também é recusado", async () => {
    const { sb } = dubleOk();
    await expect(
      salvarLink(sb, { ...base, slug: "x" }, [link({ id: "o", url: "https://o.com", slug: "x", deleted: true })]),
    ).rejects.toThrow(/já está em uso/);
  });

  it("erro 23505 do banco vira a mesma mensagem", async () => {
    const { sb } = duble((c) =>
      temOp(c, "insert")
        ? { data: null, error: { message: "duplicate key value violates unique constraint", code: "23505" } as never }
        : { data: [] });
    await expect(salvarLink(sb, { ...base, slug: "x" }, [])).rejects.toThrow(/já está em uso/);
  });

  it("sem slug informado na edição, não mexe no slug", async () => {
    const { sb, chamadas } = dubleOk("a1");
    await salvarLink(sb, { ...base, id: "a1" }, [link({ id: "a1", slug: "meu" })]);
    expect("slug" in campos(chamadas)).toBe(false);
  });

  it("paginaAtiva true sem arquivo atual nem novo é recusada; com um dos dois passa e é gravada", async () => {
    const a = dubleOk();
    await expect(salvarLink(a.sb, { ...base, paginaAtiva: true }, [])).rejects.toThrow(
      "A página pública precisa de um arquivo arquivado.");
    expect(a.chamadas).toHaveLength(0);
    const b = dubleOk();
    await salvarLink(b.sb, { ...base, paginaAtiva: true }, [], true);
    expect(campos(b.chamadas).pagina_ativa).toBe(true);
    const c = dubleOk("a1");
    await salvarLink(c.sb, { ...base, id: "a1", paginaAtiva: true }, [link({ id: "a1", arquivo_path: "a1.html" })]);
    expect(campos(c.chamadas).pagina_ativa).toBe(true);
  });

  it("paginaAtiva false é gravada; omitida não aparece", async () => {
    const a = dubleOk();
    await salvarLink(a.sb, { ...base, paginaAtiva: false }, []);
    expect(campos(a.chamadas).pagina_ativa).toBe(false);
    const b = dubleOk();
    await salvarLink(b.sb, base, []);
    expect("pagina_ativa" in campos(b.chamadas)).toBe(false);
  });
});

describe("salvarLink: arquivamento automático", () => {
  const base = { label: "Aula", url: "https://a.com", grupo: "G1", tipo: "vnd" as const };
  const grupoOk = { grupo: "G1", position: 0, pasta: null };
  const campos = (chamadas: Chamada[]) => {
    const c = chamadas.find((x) => temOp(x, "insert") || temOp(x, "update"))!;
    return (op(c, "insert") ?? op(c, "update"))!.a[0] as Record<string, unknown>;
  };
  const dubleOk = () =>
    duble((c) => {
      if (temOp(c, "insert") || temOp(c, "update")) return { data: [{ id: "n" }] };
      if (c.tabela === "central_links") return { data: [] };
      return { data: [grupoOk] };
    });

  it("link novo com arquivoAutomatico grava pendente", async () => {
    const { sb, chamadas } = dubleOk();
    await salvarLink(sb, { ...base, arquivoAutomatico: true }, []);
    expect(campos(chamadas).arquivo_status).toBe("pendente");
  });

  it("link novo sem arquivoAutomatico grava ignorado", async () => {
    const { sb, chamadas } = dubleOk();
    await salvarLink(sb, { ...base, arquivoAutomatico: false }, []);
    expect(campos(chamadas).arquivo_status).toBe("ignorado");
  });

  it("sem informar arquivoAutomatico, não mexe em arquivo_status", async () => {
    const { sb, chamadas } = dubleOk();
    await salvarLink(sb, base, []);
    expect(campos(chamadas)).not.toHaveProperty("arquivo_status");
  });

  it("edição de link existente não mexe em arquivo_status, mesmo com a opção", async () => {
    const { sb, chamadas } = dubleOk();
    await salvarLink(sb, { ...base, id: "a1", arquivoAutomatico: true }, []);
    expect(campos(chamadas)).not.toHaveProperty("arquivo_status");
  });

  it("editar com id, mas a URL é de uma linha excluída (reaproveitada), conta como novo", async () => {
    const { sb, chamadas } = duble((c) => {
      if (temOp(c, "update")) return { data: [{ id: "morto" }] };
      if (c.tabela === "central_links") return { data: [{ id: "morto", deleted: true }] };
      return { data: [grupoOk] };
    });
    await salvarLink(sb, { ...base, id: "a1", arquivoAutomatico: true }, []);
    expect(op(chamadas.find((c) => temOp(c, "update"))!, "eq")!.a).toEqual(["id", "morto"]);
    expect(campos(chamadas).arquivo_status).toBe("pendente");
  });

  it("linha excluída reaproveitada conta como link novo", async () => {
    const { sb, chamadas } = duble((c) => {
      if (temOp(c, "update")) return { data: [{ id: "morto" }] };
      if (c.tabela === "central_links") return { data: [{ id: "morto", deleted: true }] };
      return { data: [grupoOk] };
    });
    await salvarLink(sb, { ...base, arquivoAutomatico: true }, []);
    expect(campos(chamadas).arquivo_status).toBe("pendente");
  });
});

describe("lerLink", () => {
  it("lê uma linha pelo id", async () => {
    const { sb, chamadas } = duble(() => ({ data: [{ id: "a1", arquivo_status: "ok" }] }));
    await expect(lerLink(sb, "a1")).resolves.toMatchObject({ id: "a1", arquivo_status: "ok" });
    expect(chamadas[0].tabela).toBe("central_links");
    expect(op(chamadas[0], "eq")!.a).toEqual(["id", "a1"]);
  });
  it("devolve null quando não existe", async () => {
    const { sb } = duble(() => ({ data: [] }));
    await expect(lerLink(sb, "x")).resolves.toBeNull();
  });
  it("devolve null quando o link foi excluído", async () => {
    const { sb } = duble(() => ({ data: [{ id: "a1", deleted: true }] }));
    await expect(lerLink(sb, "a1")).resolves.toBeNull();
  });
});

describe("validarPaginaAtiva", () => {
  it("exige arquivo atual ou novo", () => {
    expect(() => validarPaginaAtiva(null, false)).toThrow("A página pública precisa de um arquivo arquivado.");
    expect(() => validarPaginaAtiva("a.html", false)).not.toThrow();
    expect(() => validarPaginaAtiva(null, true)).not.toThrow();
  });
});

/** Dublê do cliente com Storage além do banco. */
function dubleComStorage(opts: {
  upload?: { error: { message: string } | null };
  remove?: { error: { message: string } | null };
  download?: { data: unknown; error: { message: string } | null };
  resolver?: (c: Chamada) => Resposta;
} = {}) {
  const { sb, chamadas } = duble(opts.resolver ?? (() => ({ data: [{ id: "x" }] })));
  const storage: { bucket?: string; uploads: unknown[][]; removes: unknown[][]; downloads: unknown[][] } =
    { uploads: [], removes: [], downloads: [] };
  (sb as unknown as { storage: unknown }).storage = {
    from(bucket: string) {
      storage.bucket = bucket;
      return {
        upload: async (...a: unknown[]) => { storage.uploads.push(a); return opts.upload ?? { error: null }; },
        remove: async (...a: unknown[]) => { storage.removes.push(a); return opts.remove ?? { error: null }; },
        download: async (...a: unknown[]) => {
          storage.downloads.push(a);
          return opts.download ?? { data: { text: async () => "<p>oi</p>" }, error: null };
        },
      };
    },
  };
  return { sb, chamadas, storage };
}

describe("arquivo da página", () => {
  it("LIMITE_ARQUIVO é 50 MB", () => expect(LIMITE_ARQUIVO).toBe(50 * 1024 * 1024));

  it("enviarArquivo recusa acima de 50 MB sem tocar em nada", async () => {
    const { sb, chamadas, storage } = dubleComStorage();
    const grande = { size: LIMITE_ARQUIVO + 1 } as unknown as Blob;
    await expect(enviarArquivo(sb, "i1", grande)).rejects.toThrow(/50 MB/);
    expect(storage.uploads).toHaveLength(0);
    expect(chamadas).toHaveLength(0);
  });

  it("enviarArquivo aceita exatamente 50 MB", async () => {
    const { sb } = dubleComStorage();
    await expect(enviarArquivo(sb, "i1", { size: LIMITE_ARQUIVO } as unknown as Blob)).resolves.toBeDefined();
  });

  it("enviarArquivo sobe para paginas/<id>.html e grava os campos", async () => {
    const { sb, chamadas, storage } = dubleComStorage();
    const arq = new Blob(["<p>oi</p>"], { type: "text/html" });
    const r = await enviarArquivo(sb, "i1", arq);
    expect(storage.bucket).toBe("paginas");
    expect(storage.uploads[0]).toEqual(["i1.html", arq, { upsert: true, contentType: "text/html" }]);
    expect(r.arquivo_path).toBe("i1.html");
    expect(r.arquivo_tam).toBe(arq.size);
    expect(Number.isNaN(Date.parse(r.arquivado_em))).toBe(false);
    const up = chamadas.find((c) => temOp(c, "update"))!;
    expect(up.tabela).toBe("central_links");
    expect(op(up, "update")!.a[0]).toEqual({
      arquivo_path: "i1.html", arquivo_tam: arq.size, arquivado_em: r.arquivado_em,
      arquivo_status: "ok", arquivo_erro: null,
    });
    expect(op(up, "eq")!.a).toEqual(["id", "i1"]);
  });

  it("enviarArquivo: falha do upload não grava no banco; 0 linhas = sem permissão", async () => {
    const a = dubleComStorage({ upload: { error: { message: "boom" } } });
    await expect(enviarArquivo(a.sb, "i1", new Blob(["x"]))).rejects.toThrow(/boom/);
    expect(a.chamadas).toHaveLength(0);
    const b = dubleComStorage({ resolver: () => ({ data: [] }) });
    await expect(enviarArquivo(b.sb, "i1", new Blob(["x"]))).rejects.toThrow("Sem permissão para esta ação.");
  });

  it("removerArquivo remove do Storage e zera os campos, desativando a página", async () => {
    const { sb, chamadas, storage } = dubleComStorage();
    await removerArquivo(sb, "i1", "i1.html");
    expect(storage.removes[0]).toEqual([["i1.html"]]);
    const up = chamadas.find((c) => temOp(c, "update"))!;
    expect(op(up, "update")!.a[0]).toEqual({
      arquivo_path: null, arquivo_tam: null, arquivado_em: null, arquivo_erro: null,
      pagina_ativa: false, arquivo_status: "ignorado",
    });
    expect(op(up, "eq")!.a).toEqual(["id", "i1"]);
  });

  it("removerArquivo: erro no Storage aborta antes do banco; 0 linhas = sem permissão", async () => {
    const a = dubleComStorage({ remove: { error: { message: "nao" } } });
    await expect(removerArquivo(a.sb, "i1", "i1.html")).rejects.toThrow(/nao/);
    expect(a.chamadas).toHaveLength(0);
    const b = dubleComStorage({ resolver: () => ({ data: [] }) });
    await expect(removerArquivo(b.sb, "i1", "i1.html")).rejects.toThrow("Sem permissão para esta ação.");
  });

  it("baixarCopia devolve o texto do arquivo", async () => {
    const { sb, storage } = dubleComStorage();
    await expect(baixarCopia(sb, "i1.html")).resolves.toBe("<p>oi</p>");
    expect(storage.bucket).toBe("paginas");
    expect(storage.downloads[0]).toEqual(["i1.html"]);
  });

  it("baixarCopia propaga erro em português", async () => {
    const { sb } = dubleComStorage({ download: { data: null, error: { message: "x" } } });
    await expect(baixarCopia(sb, "i1.html")).rejects.toThrow(/Erro ao baixar/);
  });

  it("definirPaginaAtiva liga só com arquivo e desliga sempre", async () => {
    const a = dubleComStorage();
    await expect(definirPaginaAtiva(a.sb, "i1", true, null)).rejects.toThrow(
      "A página pública precisa de um arquivo arquivado.");
    expect(a.chamadas).toHaveLength(0);
    await definirPaginaAtiva(a.sb, "i1", true, "i1.html");
    const up = a.chamadas.find((c) => temOp(c, "update"))!;
    expect(op(up, "update")!.a[0]).toEqual({ pagina_ativa: true });
    expect(op(up, "eq")!.a).toEqual(["id", "i1"]);
    const b = dubleComStorage();
    await definirPaginaAtiva(b.sb, "i1", false, null);
    expect(op(b.chamadas[0], "update")!.a[0]).toEqual({ pagina_ativa: false });
    const c = dubleComStorage({ resolver: () => ({ data: [] }) });
    await expect(definirPaginaAtiva(c.sb, "i1", false, null)).rejects.toThrow("Sem permissão para esta ação.");
  });
});

describe("excluirLink", () => {
  it("marca deleted e desativa a página pública", async () => {
    const { sb, chamadas } = duble(() => ({ data: [{ id: "x" }] }));
    await excluirLink(sb, "x");
    expect(op(chamadas[0], "update")!.a[0]).toEqual({ deleted: true, pagina_ativa: false });
    expect(op(chamadas[0], "eq")!.a).toEqual(["id", "x"]);
  });
  it("0 linhas = sem permissão", async () => {
    const { sb } = duble(() => ({ data: [] }));
    await expect(excluirLink(sb, "x")).rejects.toThrow("Sem permissão para esta ação.");
  });
});

describe("pastas", () => {
  it("criarPasta valida vazio e duplicata sem diferenciar caixa", async () => {
    const { sb, chamadas } = duble(() => ({ data: null }));
    const pastas = [{ nome: "Abc", position: 3 }];
    await expect(criarPasta(sb, "  ", pastas)).rejects.toThrow("Informe o nome da pasta.");
    await expect(criarPasta(sb, "aBC", pastas)).rejects.toThrow("Já existe uma pasta com esse nome.");
    expect(chamadas).toHaveLength(0);
  });
  it("criarPasta insere na próxima posição", async () => {
    const { sb, chamadas } = duble(() => ({ data: null }));
    await criarPasta(sb, " Nova ", [{ nome: "A", position: 3 }]);
    expect(op(chamadas[0], "insert")!.a[0]).toEqual({ nome: "Nova", position: 4 });
  });
  it("excluirPasta solta os grupos antes e depois apaga contando o retorno", async () => {
    const { sb, chamadas } = duble((c) => (temOp(c, "delete") ? { data: [{ nome: "P" }] } : { data: null }));
    await excluirPasta(sb, "P");
    expect(chamadas.map((c) => c.tabela)).toEqual(["central_grupo_order", "central_pastas"]);
    expect(op(chamadas[0], "update")!.a[0]).toEqual({ pasta: null });
    expect(op(chamadas[0], "eq")!.a).toEqual(["pasta", "P"]);
    expect(temOp(chamadas[1], "select")).toBe(true);
  });
  it("excluirPasta com 0 linhas apagadas lança erro de permissão", async () => {
    const { sb } = duble((c) => (temOp(c, "delete") ? { data: [] } : { data: null }));
    await expect(excluirPasta(sb, "P")).rejects.toThrow("Sem permissão para esta ação.");
  });
  it("reordenarPastas faz upsert por nome", async () => {
    const { sb, chamadas } = duble(() => ({ data: null }));
    await reordenarPastas(sb, [{ nome: "A", position: 0 }, { nome: "B", position: 1 }]);
    expect(op(chamadas[0], "upsert")!.a).toEqual([
      [{ nome: "A", position: 0 }, { nome: "B", position: 1 }],
      { onConflict: "nome" },
    ]);
  });
});

describe("grupos", () => {
  const grupos = { A: { position: 2, pasta: "P" }, S: { position: 9999, pasta: "P" }, Q: { position: 7, pasta: null } };

  it("criarGrupo valida nome e duplicata", async () => {
    const { sb } = duble(() => ({ data: null }));
    await expect(criarGrupo(sb, " ", null, grupos)).rejects.toThrow("Informe o nome do grupo.");
    await expect(criarGrupo(sb, "A", null, grupos)).rejects.toThrow("Já existe um grupo com esse nome.");
  });
  it("criarGrupo insere na próxima posição da pasta, ignorando 9999", async () => {
    const { sb, chamadas } = duble(() => ({ data: null }));
    await criarGrupo(sb, "N", "P", grupos);
    expect(op(chamadas[0], "insert")!.a[0]).toEqual({ grupo: "N", position: 3, pasta: "P" });
  });
  it("criarGrupo aceita lista de GrupoDaCentral", async () => {
    const { sb, chamadas } = duble(() => ({ data: null }));
    await criarGrupo(sb, "N", null, [{ nome: "Q", position: 7, pasta: null }]);
    expect(op(chamadas[0], "insert")!.a[0]).toEqual({ grupo: "N", position: 8, pasta: null });
  });

  it("moverGrupoDePasta manda para o fim da pasta destino", async () => {
    const { sb, chamadas } = duble((c) =>
      temOp(c, "upsert") ? { data: null }
        : { data: [{ grupo: "G", position: 0, pasta: null }, { grupo: "H", position: 4, pasta: "P" }] });
    await moverGrupoDePasta(sb, "G", "P");
    const up = chamadas.find((c) => temOp(c, "upsert"))!;
    expect(op(up, "upsert")!.a).toEqual([{ grupo: "G", position: 5, pasta: "P" }, { onConflict: "grupo" }]);
  });
  it("moverGrupoDePasta para a mesma pasta mantém a posição", async () => {
    const { sb, chamadas } = duble((c) =>
      temOp(c, "upsert") ? { data: null } : { data: [{ grupo: "G", position: 2, pasta: "P" }, { grupo: "H", position: 4, pasta: "P" }] });
    await moverGrupoDePasta(sb, "G", "P");
    const up = chamadas.find((c) => temOp(c, "upsert"))!;
    expect((op(up, "upsert")!.a[0] as { position: number }).position).toBe(2);
  });

  it("excluirGrupo recusa se ainda há links ativos", async () => {
    const { sb, chamadas } = duble(() => ({ data: [{ grupo: "G" }] }));
    await expect(excluirGrupo(sb, "G", [link({ grupo: "G" })])).rejects.toThrow(
      "Mova ou exclua os links do grupo antes de excluí-lo.");
    expect(chamadas).toHaveLength(0);
  });
  it("excluirGrupo apaga e conta o retorno", async () => {
    const ok = duble(() => ({ data: [{ grupo: "G" }] }));
    await excluirGrupo(ok.sb, "G", [link({ grupo: "Outro" })]);
    expect(op(ok.chamadas[0], "eq")!.a).toEqual(["grupo", "G"]);
    const sem = duble(() => ({ data: [] }));
    await expect(excluirGrupo(sem.sb, "G", [])).rejects.toThrow("Sem permissão para esta ação.");
  });
  it("reordenarGrupos faz upsert por grupo com a pasta", async () => {
    const { sb, chamadas } = duble(() => ({ data: null }));
    await reordenarGrupos(sb, [{ nome: "A", position: 0, pasta: "P" }, { nome: "B", position: 1, pasta: null }]);
    expect(op(chamadas[0], "upsert")!.a).toEqual([
      [{ grupo: "A", position: 0, pasta: "P" }, { grupo: "B", position: 1, pasta: null }],
      { onConflict: "grupo" },
    ]);
  });
  it("erros do banco viram Error em português", async () => {
    const { sb } = duble(() => ({ data: null, error: { message: "x" } }));
    await expect(reordenarGrupos(sb, [])).rejects.toThrow(/^Erro/);
  });
});

describe("pastas da V2: cor, renomear e miniatura", () => {
  const semColuna = { message: "column does not exist", code: "42703" } as { message: string };

  it("lerTudo traz a cor do grupo (null quando a coluna não existe)", async () => {
    const { sb } = duble((c) => {
      if (c.tabela === "central_grupo_order") return { data: [{ grupo: "A", position: 0, pasta: null, cor: "rosa" }, { grupo: "B", position: 1, pasta: null }] };
      return { data: [] };
    });
    const r = await lerTudo(sb);
    expect(r.grupos.map((g) => g.cor)).toEqual(["rosa", null]);
  });

  it("criarGrupo grava a cor escolhida", async () => {
    const { sb, chamadas } = duble(() => ({ data: [] }));
    await criarGrupo(sb, "Nova", null, {}, "verde");
    const ins = chamadas.find((c) => temOp(c, "insert"))!;
    expect(op(ins, "insert")!.a[0]).toEqual({ grupo: "Nova", position: 0, pasta: null, cor: "verde" });
  });

  it("criarGrupo sem a migration 077 cria a pasta sem cor, em vez de falhar", async () => {
    let tentativas = 0;
    const { sb, chamadas } = duble((c) => {
      if (!temOp(c, "insert")) return { data: [] };
      tentativas++;
      return tentativas === 1 ? { data: null, error: semColuna } : { data: [] };
    });
    await criarGrupo(sb, "Nova", null, {}, "verde");
    const inserts = chamadas.filter((c) => temOp(c, "insert")).map((c) => op(c, "insert")!.a[0]);
    expect(inserts).toEqual([
      { grupo: "Nova", position: 0, pasta: null, cor: "verde" },
      { grupo: "Nova", position: 0, pasta: null },
    ]);
  });

  it("criarGrupo não esconde outro erro do banco", async () => {
    let inserts = 0;
    const { sb } = duble((c) => {
      if (!temOp(c, "insert")) return { data: [] };
      return ++inserts === 1 ? { data: null, error: { message: "boom" } } : { data: [] };
    });
    await expect(criarGrupo(sb, "Nova", null, {}, "verde")).rejects.toThrow(/boom/);
    expect(inserts).toBe(1); // não tenta de novo sem a cor: só a falta da coluna autoriza isso
  });

  it("renomearPasta chama a função do banco com os dois nomes", async () => {
    const rpc = jest.fn(async () => ({ data: null, error: null }));
    const { sb } = duble(() => ({ data: [] }));
    (sb as unknown as { rpc: unknown }).rpc = rpc;
    await renomearPasta(sb, "Velha", "Nova");
    expect(rpc).toHaveBeenCalledWith("central_renomear_pasta", { p_de: "Velha", p_para: "Nova" });
  });

  it("renomearPasta: função ausente pede a migration; erro do banco chega como está", async () => {
    const { sb } = duble(() => ({ data: [] }));
    (sb as unknown as { rpc: unknown }).rpc = async () => ({ data: null, error: { message: "nao existe", code: "PGRST202" } });
    await expect(renomearPasta(sb, "A", "B")).rejects.toThrow(SEM_MIGRATION);
    (sb as unknown as { rpc: unknown }).rpc = async () => ({ data: null, error: { message: "Já existe uma pasta com esse nome.", code: "23505" } });
    await expect(renomearPasta(sb, "A", "B")).rejects.toThrow("Já existe uma pasta com esse nome.");
  });

  it("definirCorDaPasta atualiza só a cor do grupo; 0 linhas = sem permissão; sem coluna pede a migration", async () => {
    const a = duble(() => ({ data: [{ grupo: "A" }] }));
    await definirCorDaPasta(a.sb, "A", "coral");
    const up = a.chamadas.find((c) => temOp(c, "update"))!;
    expect(up.tabela).toBe("central_grupo_order");
    expect(op(up, "update")!.a[0]).toEqual({ cor: "coral" });
    expect(op(up, "eq")!.a).toEqual(["grupo", "A"]);
    const b = duble(() => ({ data: [] }));
    await expect(definirCorDaPasta(b.sb, "A", "coral")).rejects.toThrow("Sem permissão para esta ação.");
    const c = duble(() => ({ data: null, error: semColuna }));
    await expect(definirCorDaPasta(c.sb, "A", "coral")).rejects.toThrow(SEM_MIGRATION);
  });

  it("urlsDeMiniaturas assina os caminhos em lote e ignora os que falharam", async () => {
    const criar = jest.fn(async () => ({
      data: [{ path: "miniaturas/a.png", signedUrl: "https://x/a" }, { path: "miniaturas/b.png", signedUrl: null, error: "nao" }],
      error: null,
    }));
    const { sb } = duble(() => ({ data: [] }));
    (sb as unknown as { storage: unknown }).storage = { from: () => ({ createSignedUrls: criar }) };
    await expect(urlsDeMiniaturas(sb, ["miniaturas/a.png", "miniaturas/b.png"])).resolves.toEqual({ "miniaturas/a.png": "https://x/a" });
    expect(criar).toHaveBeenCalledWith(["miniaturas/a.png", "miniaturas/b.png"], 3600);
    await expect(urlsDeMiniaturas(sb, [])).resolves.toEqual({});
  });

  it("urlsDeMiniaturas: erro do Storage vira mapa vazio (o cartão mostra o espaço ilustrado)", async () => {
    const { sb } = duble(() => ({ data: [] }));
    (sb as unknown as { storage: unknown }).storage = { from: () => ({ createSignedUrls: async () => ({ data: null, error: { message: "x" } }) }) };
    await expect(urlsDeMiniaturas(sb, ["miniaturas/a.png"])).resolves.toEqual({});
  });

  it("removerArquivo apaga também a miniatura quando existe, e só então mexe na coluna nova", async () => {
    const { sb, chamadas, storage } = dubleComStorage();
    await removerArquivo(sb, "i1", "i1.html", "miniaturas/i1.png");
    expect(storage.removes[0]).toEqual([["i1.html", "miniaturas/i1.png"]]);
    const up = chamadas.find((c) => temOp(c, "update"))!;
    expect(op(up, "update")!.a[0]).toMatchObject({ arquivo_path: null, miniatura_path: null });
  });
});
