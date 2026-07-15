import { buildSystemPrompt, todayInSaoPaulo, type AgentState } from "../prompt";

const STATE: AgentState = {
  today: "2026-07-14",
  period: { startDate: "2026-06-01", endDate: "2026-06-30" },
  filterName: "Ingresso PC Ao Vivo",
  offerCode: null,
  sources: { meta: true, hotmart: true, leads: true },
};

describe("todayInSaoPaulo", () => {
  it("resolve a data no fuso de São Paulo, não em UTC", () => {
    // 02:00 UTC de 15/07 ainda é 23:00 de 14/07 em São Paulo (UTC-3).
    expect(todayInSaoPaulo(new Date("2026-07-15T02:00:00Z"))).toBe("2026-07-14");
  });

  it("vira o dia quando já passou da meia-noite em São Paulo", () => {
    expect(todayInSaoPaulo(new Date("2026-07-15T03:30:00Z"))).toBe("2026-07-15");
  });
});

describe("buildSystemPrompt", () => {
  it("informa a data de hoje, para que 'últimos 7 dias' não vire data inventada", () => {
    expect(buildSystemPrompt(STATE)).toContain("2026-07-14");
  });

  it("informa o período selecionado na tela", () => {
    const prompt = buildSystemPrompt(STATE);
    expect(prompt).toContain("2026-06-01");
    expect(prompt).toContain("2026-06-30");
  });

  it("informa o nome do filtro ativo", () => {
    expect(buildSystemPrompt(STATE)).toContain("Ingresso PC Ao Vivo");
  });

  it("informa a oferta ativa quando há uma selecionada", () => {
    expect(buildSystemPrompt({ ...STATE, offerCode: "OFERTA-X" })).toContain("OFERTA-X");
  });

  it("declara explicitamente qual fonte não está configurada", () => {
    const prompt = buildSystemPrompt({
      ...STATE,
      sources: { meta: false, hotmart: true, leads: true },
    });

    expect(prompt).toMatch(/Meta Ads.*não (está )?configurad/i);
  });

  it("proíbe estimar ou lembrar números", () => {
    const prompt = buildSystemPrompt(STATE);
    expect(prompt).toMatch(/nunca estime/i);
    expect(prompt).toMatch(/todo número.*(tool|consulta)/i);
  });

  it("manda declarar fonte não configurada em vez de inferir valor", () => {
    expect(buildSystemPrompt(STATE)).toMatch(/nunca infira|nunca invente/i);
  });

  it("não injeta métrica nenhuma — o snapshot numérico era a segunda fonte de verdade", () => {
    const prompt = buildSystemPrompt(STATE);

    // O prompt não tem por onde receber uma métrica: AgentState não carrega
    // nenhuma. O que sobra é garantir que nada com cara de valor apareça.
    for (const metrica of ["meta_spend", "total_revenue", "total_sales", "meta_leads", "R$"]) {
      expect(prompt).not.toContain(metrica);
    }
    expect(prompt).not.toMatch(/(Receita|Investimento|CPL|ROAS|Vendas totais):\s*[\d.,]/i);
  });
});
