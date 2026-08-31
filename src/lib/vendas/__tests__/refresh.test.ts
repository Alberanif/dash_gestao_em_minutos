import { interpretRefreshResponse, formatRefreshedAgo, type RefreshOutcome } from "../refresh";

// Narrowing helper para os testes: os casos aqui exercitam kind !== "success"
// (o único sem `message`); falha alto e claro se isso mudar.
function messageOf(outcome: RefreshOutcome): string {
  if (outcome.kind === "success") throw new Error("outcome inesperado: success não tem message");
  return outcome.message;
}

describe("interpretRefreshResponse", () => {
  it("200 -> success com upserted e lastRefreshAt", () => {
    const outcome = interpretRefreshResponse(200, { upserted: 12, lastRefreshAt: "2026-07-19T10:00:00Z" });
    expect(outcome).toEqual({ kind: "success", upserted: 12, lastRefreshAt: "2026-07-19T10:00:00Z" });
  });

  it("200 sem upserted no corpo -> upserted 0", () => {
    const outcome = interpretRefreshResponse(200, {});
    expect(outcome).toEqual({ kind: "success", upserted: 0, lastRefreshAt: null });
  });

  it("429 -> throttled com mensagem amigável citando o retryAfterSeconds", () => {
    const outcome = interpretRefreshResponse(429, {
      error: "Atualização muito recente.",
      retryAfterSeconds: 42,
    });
    expect(outcome.kind).toBe("throttled");
    expect(messageOf(outcome)).toContain("42");
  });

  it("429 sem retryAfterSeconds ainda produz mensagem amigável", () => {
    const outcome = interpretRefreshResponse(429, {});
    expect(outcome.kind).toBe("throttled");
    expect(messageOf(outcome).length).toBeGreaterThan(0);
  });

  it("409 -> conflict repassando a mensagem do servidor (ex.: refresh em andamento)", () => {
    const outcome = interpretRefreshResponse(409, { error: "refresh em andamento" });
    expect(outcome).toEqual({ kind: "conflict", message: "refresh em andamento" });
  });

  it("409 com ciclo encerrado repassa a mensagem específica do servidor", () => {
    const outcome = interpretRefreshResponse(409, { error: "Ciclo encerrado não pode ser atualizado" });
    expect(outcome).toEqual({ kind: "conflict", message: "Ciclo encerrado não pode ser atualizado" });
  });

  it("409 sem corpo de erro usa fallback amigável", () => {
    const outcome = interpretRefreshResponse(409, {});
    expect(outcome.kind).toBe("conflict");
    expect(messageOf(outcome).length).toBeGreaterThan(0);
  });

  it("outros status (ex.: 500/502) -> error repassando mensagem do servidor ou fallback", () => {
    const withMessage = interpretRefreshResponse(502, { error: "Hotmart sales API error: 500" });
    expect(withMessage).toEqual({ kind: "error", message: "Hotmart sales API error: 500" });

    const withoutMessage = interpretRefreshResponse(500, {});
    expect(withoutMessage.kind).toBe("error");
    expect(messageOf(withoutMessage).length).toBeGreaterThan(0);
  });
});

describe("formatRefreshedAgo", () => {
  it("retorna null quando o timestamp é null (rótulo deve ser ocultado)", () => {
    expect(formatRefreshedAgo(null, new Date("2026-07-19T10:00:00Z"))).toBeNull();
  });

  it("retorna null quando o timestamp é inválido", () => {
    expect(formatRefreshedAgo("not-a-date", new Date("2026-07-19T10:00:00Z"))).toBeNull();
  });

  it("formata minutos decorridos", () => {
    const now = new Date("2026-07-19T10:05:00Z");
    expect(formatRefreshedAgo("2026-07-19T10:00:00Z", now)).toBe("Vendas atualizadas há 5 min");
  });

  it("usa mensagem 'agora' para menos de 1 minuto", () => {
    const now = new Date("2026-07-19T10:00:30Z");
    expect(formatRefreshedAgo("2026-07-19T10:00:00Z", now)).toBe("Vendas atualizadas agora");
  });

  it("nunca produz minutos negativos (clock drift)", () => {
    const now = new Date("2026-07-19T09:59:00Z");
    expect(formatRefreshedAgo("2026-07-19T10:00:00Z", now)).toBe("Vendas atualizadas agora");
  });
});
