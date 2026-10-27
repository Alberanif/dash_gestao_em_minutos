import { avisoFontes, estadoInicial, montarCorpo, problemasDoEstado, type EstadoAssistente } from "../estado";

const produto = { product_id: "10", product_name: "Mentoria" };
const base = (p: Partial<EstadoAssistente> = {}): EstadoAssistente => ({ ...estadoInicial, nome: "Evento", ...p });

describe("problemasDoEstado", () => {
  it("nome vazio ou só espaços aponta a identificação", () => {
    const p = problemasDoEstado(base({ nome: "   ", produtosCaptura: [produto] }));
    expect(p).toEqual([{ etapa: "identificacao", mensagem: "Dê um nome ao evento." }]);
  });

  it("período com só uma data é inválido na identificação", () => {
    const p = problemasDoEstado(base({ inicio: "2026-01-01", produtosCaptura: [produto] }));
    expect(p).toHaveLength(1);
    expect(p[0].etapa).toBe("identificacao");
  });

  it("período com início depois do fim é inválido", () => {
    const p = problemasDoEstado(base({ inicio: "2026-02-01", fim: "2026-01-01", produtosCaptura: [produto] }));
    expect(p.map((x) => x.etapa)).toEqual(["identificacao"]);
  });

  it("pago sem nenhuma fonte exige captação", () => {
    const p = problemasDoEstado(base());
    expect(p.map((x) => x.etapa)).toEqual(["captacao"]);
  });

  it("pago com termos em branco ainda não tem fonte", () => {
    expect(problemasDoEstado(base({ termos: ["  ", ""] })).map((x) => x.etapa)).toEqual(["captacao"]);
  });

  it("pago com um produto, um termo ou um evento de Leads é válido", () => {
    expect(problemasDoEstado(base({ produtosCaptura: [produto] }))).toEqual([]);
    expect(problemasDoEstado(base({ termos: ["camp"] }))).toEqual([]);
    expect(problemasDoEstado(base({ eventosLeads: ["lp"] }))).toEqual([]);
  });

  it("orgânico sem leads nem termos é inválido, mesmo COM produto de captura", () => {
    const p = problemasDoEstado(base({ organico: true, produtosCaptura: [produto] }));
    expect(p.map((x) => x.etapa)).toEqual(["captacao"]);
  });

  it("orgânico com evento de Leads ou termo é válido", () => {
    expect(problemasDoEstado(base({ organico: true, eventosLeads: ["lp"] }))).toEqual([]);
    expect(problemasDoEstado(base({ organico: true, termos: [" camp "] }))).toEqual([]);
  });
});

describe("avisoFontes", () => {
  it("pago com só uma fonte avisa o que será zerado", () => {
    expect(avisoFontes(base({ produtosCaptura: [produto] }))).toBe(
      "dados de Meta Ads e Captação de Leads serão zerados no dashboard.",
    );
  });

  it("pago com todas as fontes ou nenhuma não avisa", () => {
    expect(avisoFontes(base({ produtosCaptura: [produto], termos: ["c"], eventosLeads: ["l"] }))).toBeNull();
    expect(avisoFontes(base())).toBeNull();
  });

  it("orgânico ignora o produto de captura e avisa só da fonte que falta", () => {
    expect(avisoFontes(base({ organico: true, produtosCaptura: [produto], termos: ["c"] }))).toBe(
      "Captação de Leads serão zerados no dashboard.",
    );
    expect(avisoFontes(base({ organico: true, termos: ["c"], eventosLeads: ["l"] }))).toBeNull();
  });
});

describe("montarCorpo", () => {
  it("limpa os termos (trim e vazios fora) e apara o nome", () => {
    const c = montarCorpo(base({ nome: "  Evento  ", termos: [" a ", "", "  ", "b"] }), "acc");
    expect(c.name).toBe("Evento");
    expect(c.meta_ads_terms).toEqual(["a", "b"]);
    expect(c.account_id).toBe("acc");
  });

  it("datas vazias viram null e entram no corpo", () => {
    const c = montarCorpo(base(), "acc");
    expect(c).toHaveProperty("start_date", null);
    expect(c).toHaveProperty("end_date", null);
  });

  it("datas preenchidas vão no corpo", () => {
    const c = montarCorpo(base({ inicio: "2026-01-01", fim: "2026-01-10" }), "acc");
    expect(c).toMatchObject({ start_date: "2026-01-01", end_date: "2026-01-10" });
  });

  it("orgânico preserva os produtos de captura e marca is_organic", () => {
    const c = montarCorpo(base({ organico: true, produtosCaptura: [produto], eventosLeads: ["lp"] }), "acc");
    expect(c.is_organic).toBe(true);
    expect(c.hotmart_products).toEqual([produto]);
    expect(c.captacao_leads_eventos).toEqual(["lp"]);
  });

  it("pago tem is_organic falso e leva os produtos principais", () => {
    const dp = [{ product_id: "1", product_name: "P", offer_codes: ["x"] }];
    const c = montarCorpo(base({ produtosPrincipais: dp }), "acc");
    expect(c.is_organic).toBe(false);
    expect(c.debriefing_products).toEqual(dp);
  });
});
