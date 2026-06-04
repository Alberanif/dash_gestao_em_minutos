import {
  calcPulseBanner,
  calcVerdict,
  calcPlatformStatus,
  type PlatformPct,
} from "../logic";

describe("calcPlatformStatus", () => {
  it("retorna green quando pct >= 5", () => {
    expect(calcPlatformStatus(10)).toBe("green");
  });

  it("retorna green quando pct exatamente 5", () => {
    expect(calcPlatformStatus(5)).toBe("green");
  });

  it("retorna amber quando pct entre -5 e 5 (exclusive)", () => {
    expect(calcPlatformStatus(0)).toBe("amber");
    expect(calcPlatformStatus(4.9)).toBe("amber");
    expect(calcPlatformStatus(-4.9)).toBe("amber");
  });

  it("retorna red quando pct < -5", () => {
    expect(calcPlatformStatus(-5.1)).toBe("red");
    expect(calcPlatformStatus(-10)).toBe("red");
  });

  it("retorna amber quando pct exatamente -5", () => {
    expect(calcPlatformStatus(-5)).toBe("amber");
  });
});

describe("calcPulseBanner", () => {
  it("status green quando ambos >= 5%", () => {
    const input: PlatformPct = { ytPct: 10, igPct: 8 };
    const { status } = calcPulseBanner(input);
    expect(status).toBe("green");
  });

  it("headline green menciona ambas as plataformas", () => {
    const { headline } = calcPulseBanner({ ytPct: 10, igPct: 8 });
    expect(headline).toContain("ambas");
  });

  it("status amber quando apenas yt >= 5% e ig < 5%", () => {
    const { status } = calcPulseBanner({ ytPct: 10, igPct: 2 });
    expect(status).toBe("amber");
  });

  it("status amber quando apenas ig >= 5% e yt < 5%", () => {
    const { status } = calcPulseBanner({ ytPct: 2, igPct: 8 });
    expect(status).toBe("amber");
  });

  it("status amber quando nenhum >= 5% mas nenhum < -5%", () => {
    const { status } = calcPulseBanner({ ytPct: 0, igPct: 0 });
    expect(status).toBe("amber");
  });

  it("status red quando yt < -5%", () => {
    const { status } = calcPulseBanner({ ytPct: -10, igPct: 5 });
    expect(status).toBe("red");
  });

  it("status red quando ig < -5%", () => {
    const { status } = calcPulseBanner({ ytPct: 5, igPct: -10 });
    expect(status).toBe("red");
  });

  it("status red quando ambos < -5%", () => {
    const { status } = calcPulseBanner({ ytPct: -10, igPct: -10 });
    expect(status).toBe("red");
  });

  it("headline red menciona perda de audiência", () => {
    const { headline } = calcPulseBanner({ ytPct: -10, igPct: -10 });
    expect(headline).toContain("perda");
  });

  it("chips tem exatamente 2 itens (YouTube e Instagram)", () => {
    const { chips } = calcPulseBanner({ ytPct: 5, igPct: 5 });
    expect(chips).toHaveLength(2);
    expect(chips[0].label).toBe("YouTube");
    expect(chips[1].label).toBe("Instagram");
  });

  it("chip YouTube green quando ytPct >= 5", () => {
    const { chips } = calcPulseBanner({ ytPct: 10, igPct: 0 });
    expect(chips[0].status).toBe("green");
  });

  it("chip Instagram red quando igPct < -5", () => {
    const { chips } = calcPulseBanner({ ytPct: 0, igPct: -10 });
    expect(chips[1].status).toBe("red");
  });
});

describe("calcVerdict", () => {
  it("retorna string não vazia para status green", () => {
    const v = calcVerdict("green", 1000, 1200);
    expect(v.length).toBeGreaterThan(0);
  });

  it("retorna string não vazia para status amber", () => {
    const v = calcVerdict("amber", 1000, 1050);
    expect(v.length).toBeGreaterThan(0);
  });

  it("retorna string não vazia para status red", () => {
    const v = calcVerdict("red", 1200, 1000);
    expect(v.length).toBeGreaterThan(0);
  });

  it("veredito green menciona crescimento", () => {
    const v = calcVerdict("green", 1000, 1200);
    expect(v.toLowerCase()).toContain("crescimento");
  });

  it("veredito red menciona queda ou redução", () => {
    const v = calcVerdict("red", 1200, 1000);
    expect(v.toLowerCase()).toMatch(/queda|redução|redu/);
  });
});
