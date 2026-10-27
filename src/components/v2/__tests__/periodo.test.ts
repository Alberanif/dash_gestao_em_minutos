import { periodoDaUrl } from "../evento/periodo";

const hoje = "2026-07-28";

describe("periodoDaUrl", () => {
  it("sem parâmetros usa os últimos 28 dias", () => {
    const p = periodoDaUrl({}, hoje);
    expect(p.preset).toBe("28d");
    expect(p.endDate).toBe(hoje);
  });

  it("aceita de e ate válidos", () => {
    expect(periodoDaUrl({ de: "2026-07-01", ate: "2026-07-10" }, hoje)).toMatchObject({
      startDate: "2026-07-01",
      endDate: "2026-07-10",
    });
  });

  it.each([
    ["formato errado", { de: "01/07/2026", ate: "2026-07-10" }],
    ["data impossível", { de: "2026-02-30", ate: "2026-03-10" }],
    ["início depois do fim", { de: "2026-07-10", ate: "2026-07-01" }],
    ["só um lado", { de: "2026-07-01" }],
    ["injeção", { de: "2026-07-01'; drop", ate: "2026-07-10" }],
  ])("%s volta ao padrão", (_nome, query) => {
    expect(periodoDaUrl(query, hoje).preset).toBe("28d");
  });

  describe("período configurado no evento", () => {
    const evento = { start_date: "2026-06-01", end_date: "2026-06-20" };

    it("sem parâmetros abre no período do evento", () => {
      expect(periodoDaUrl({}, hoje, evento)).toMatchObject({
        startDate: "2026-06-01",
        endDate: "2026-06-20",
        preset: null,
      });
    });

    it("a URL válida vence o período do evento", () => {
      expect(periodoDaUrl({ de: "2026-07-01", ate: "2026-07-10" }, hoje, evento).startDate).toBe("2026-07-01");
    });

    it("URL inválida cai no período do evento, não nos 28 dias", () => {
      expect(periodoDaUrl({ de: "x", ate: "y" }, hoje, evento).startDate).toBe("2026-06-01");
    });

    it.each([
      ["sem datas", { start_date: null, end_date: null }],
      ["só uma data", { start_date: "2026-06-01", end_date: null }],
      ["início depois do fim", { start_date: "2026-06-20", end_date: "2026-06-01" }],
    ])("evento %s mantém os 28 dias", (_n, padrao) => {
      expect(periodoDaUrl({}, hoje, padrao).preset).toBe("28d");
    });
  });

  it("usa o primeiro valor quando o parâmetro repete", () => {
    expect(periodoDaUrl({ de: ["2026-07-01", "x"], ate: "2026-07-10" }, hoje).startDate).toBe("2026-07-01");
  });
});
