import {
  calcPlatformScore,
  derivePulseBanner,
  deriveTiles,
  type MetricRow,
  type PlatformHealth,
} from "../logic";

const ytRows: MetricRow[] = [
  { label: "Inscritos", help: "Total acumulado", value: "--", status: "amber" },
  { label: "Visualizações", help: "Período selecionado", value: "--", status: "amber" },
  { label: "Tempo assistido", help: "Horas totais", value: "--", status: "amber" },
  { label: "Engajamento", help: "Likes + comentários", value: "--", status: "amber" },
];

const igRows: MetricRow[] = [
  { label: "Seguidores", help: "Total acumulado", value: "--", status: "amber" },
  { label: "Alcance", help: "Contas únicas", value: "--", status: "amber" },
  { label: "Engajamento Reels", help: "Likes + comentários", value: "--", status: "amber" },
  { label: "Comentários", help: "Total do período", value: "--", status: "amber" },
];

const mixedRows: MetricRow[] = [
  { label: "A", help: "", value: "1", status: "green" },
  { label: "B", help: "", value: "2", status: "green" },
  { label: "C", help: "", value: "--", status: "amber" },
  { label: "D", help: "", value: "--", status: "red" },
];

describe("calcPlatformScore", () => {
  it("retorna 0 quando todas as métricas são amber (sem dados reais)", () => {
    expect(calcPlatformScore(ytRows)).toBe(0);
  });

  it("retorna 100 quando todas as métricas são green", () => {
    const rows: MetricRow[] = ytRows.map((r) => ({ ...r, status: "green" as const }));
    expect(calcPlatformScore(rows)).toBe(100);
  });

  it("retorna 50 quando metade das métricas são green", () => {
    const rows: MetricRow[] = [
      { label: "A", help: "", value: "1", status: "green" },
      { label: "B", help: "", value: "--", status: "amber" },
    ];
    expect(calcPlatformScore(rows)).toBe(50);
  });

  it("retorna 0 quando lista vazia", () => {
    expect(calcPlatformScore([])).toBe(0);
  });

  it("ignora métricas red no score positivo (conta como não-green)", () => {
    expect(calcPlatformScore(mixedRows)).toBe(50);
  });
});

describe("derivePulseBanner", () => {
  const platforms: PlatformHealth[] = [
    { platform: "yt", score: 0, status: "amber", rows: ytRows },
    { platform: "ig", score: 0, status: "amber", rows: igRows },
  ];

  it("status amber quando não há métricas red nem green", () => {
    const { status } = derivePulseBanner(platforms);
    expect(status).toBe("amber");
  });

  it("status red quando há pelo menos uma métrica red", () => {
    const withRed: PlatformHealth[] = [
      {
        platform: "yt",
        score: 0,
        status: "red",
        rows: [{ label: "X", help: "", value: "--", status: "red" }],
      },
      { platform: "ig", score: 0, status: "amber", rows: igRows },
    ];
    const { status } = derivePulseBanner(withRed);
    expect(status).toBe("red");
  });

  it("status green quando todas as métricas são green", () => {
    const allGreen: PlatformHealth[] = [
      {
        platform: "yt",
        score: 100,
        status: "green",
        rows: ytRows.map((r) => ({ ...r, status: "green" as const })),
      },
      {
        platform: "ig",
        score: 100,
        status: "green",
        rows: igRows.map((r) => ({ ...r, status: "green" as const })),
      },
    ];
    const { status } = derivePulseBanner(allGreen);
    expect(status).toBe("green");
  });

  it("inclui chip para cada plataforma", () => {
    const { chips } = derivePulseBanner(platforms);
    expect(chips.length).toBe(2);
  });

  it("headline não é vazia", () => {
    const { headline } = derivePulseBanner(platforms);
    expect(headline.length).toBeGreaterThan(0);
  });
});

describe("deriveTiles", () => {
  it("retorna exatamente 3 tiles", () => {
    const platforms: PlatformHealth[] = [
      { platform: "yt", score: 0, status: "amber", rows: ytRows },
      { platform: "ig", score: 0, status: "amber", rows: igRows },
    ];
    expect(deriveTiles(platforms)).toHaveLength(3);
  });

  it("primeiro tile é critical quando há métrica red", () => {
    const platforms: PlatformHealth[] = [
      {
        platform: "yt",
        score: 0,
        status: "red",
        rows: [{ label: "Engajamento", help: "", value: "--", status: "red" }],
      },
      { platform: "ig", score: 0, status: "amber", rows: igRows },
    ];
    const tiles = deriveTiles(platforms);
    expect(tiles[0].severity).toBe("critical");
  });

  it("primeiro tile é attention quando não há red mas há amber", () => {
    const platforms: PlatformHealth[] = [
      { platform: "yt", score: 0, status: "amber", rows: ytRows },
      { platform: "ig", score: 0, status: "amber", rows: igRows },
    ];
    const tiles = deriveTiles(platforms);
    expect(tiles[0].severity).toBe("attention");
  });

  it("tile tem label, value e description não vazios", () => {
    const platforms: PlatformHealth[] = [
      { platform: "yt", score: 50, status: "amber", rows: mixedRows },
      { platform: "ig", score: 0, status: "amber", rows: igRows },
    ];
    const tiles = deriveTiles(platforms);
    tiles.forEach((t) => {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.value.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
    });
  });
});
