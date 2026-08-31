import { buildSixDadosPrompt } from "../prompt";
import type { AiReportKpiBlock } from "@/types/indicadores";

const LIFETIME: AiReportKpiBlock = {
  roas: 4.2,
  revenueBrl: 48200,
  leads: 1840,
  cpl: 9.5,
  spend: 17480,
  sales: 120,
  startDate: "2020-01-01",
  endDate: "2026-07-16",
};

const LAST_7D: AiReportKpiBlock = {
  roas: 3.1,
  revenueBrl: 6200,
  leads: 210,
  cpl: 11.2,
  spend: 2352,
  sales: 15,
  startDate: "2026-07-09",
  endDate: "2026-07-16",
};

describe("buildSixDadosPrompt", () => {
  it("inclui o nome do Evento", () => {
    const prompt = buildSixDadosPrompt({ eventoName: "Ingresso PC Ao Vivo", lifetime: LIFETIME, last7d: LAST_7D });
    expect(prompt).toContain("Ingresso PC Ao Vivo");
  });

  it("inclui os números fornecidos dos dois blocos", () => {
    const prompt = buildSixDadosPrompt({ eventoName: "Evento", lifetime: LIFETIME, last7d: LAST_7D });

    expect(prompt).toContain("4.2");
    expect(prompt).toContain("48200");
    expect(prompt).toContain("1840");
    expect(prompt).toContain("9.5");
    expect(prompt).toContain("3.1");
    expect(prompt).toContain("6200");
    expect(prompt).toContain("210");
    expect(prompt).toContain("11.2");
  });

  it("inclui as datas dos dois períodos", () => {
    const prompt = buildSixDadosPrompt({ eventoName: "Evento", lifetime: LIFETIME, last7d: LAST_7D });

    expect(prompt).toContain("2020-01-01");
    expect(prompt).toContain("2026-07-16");
    expect(prompt).toContain("2026-07-09");
  });

  it("contém as REGRAS DURAS: não estimar, fonte ausente é indisponível, pt-BR, timezone", () => {
    const prompt = buildSixDadosPrompt({ eventoName: "Evento", lifetime: LIFETIME, last7d: LAST_7D });

    expect(prompt).toMatch(/nunca estime|nunca invente/i);
    expect(prompt).toMatch(/português brasileiro|pt-BR/i);
    expect(prompt).toMatch(/America\/Sao_Paulo/);
  });

  it("instrui o formato: 3 a 5 frases, tom executivo", () => {
    const prompt = buildSixDadosPrompt({ eventoName: "Evento", lifetime: LIFETIME, last7d: LAST_7D });

    expect(prompt).toMatch(/3 a 5 frases/i);
    expect(prompt).toMatch(/executivo/i);
  });

  it("null aparece como indisponível — nunca como 0", () => {
    const comNulos: AiReportKpiBlock = {
      roas: null,
      revenueBrl: null,
      leads: null,
      cpl: null,
      spend: null,
      sales: null,
      startDate: "2020-01-01",
      endDate: "2026-07-16",
    };

    const prompt = buildSixDadosPrompt({ eventoName: "Evento", lifetime: comNulos, last7d: LAST_7D });

    // Nenhum "0" solto representando os campos nulos do bloco vitalício.
    expect(prompt).toMatch(/indisponível/i);
    expect(prompt).not.toMatch(/ROAS:\s*0\b/i);
    expect(prompt).not.toMatch(/Receita[^:]*:\s*0\b/i);
    expect(prompt).not.toMatch(/Leads:\s*0\b/i);
    expect(prompt).not.toMatch(/CPL:\s*0\b/i);
  });
});
