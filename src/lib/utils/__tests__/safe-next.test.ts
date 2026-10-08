import { sanitizeNext } from "../safe-next";

describe("sanitizeNext", () => {
  it("aceita caminho interno com query", () => {
    expect(sanitizeNext("/indicadores/x?view=planilha")).toBe(
      "/indicadores/x?view=planilha"
    );
    expect(sanitizeNext("/ultimates")).toBe("/ultimates");
    expect(sanitizeNext("/")).toBe("/");
  });

  it.each([
    ["//evil.com"],
    ["///evil.com"],
    ["https://evil.com"],
    ["http://evil.com"],
    ["/\\evil.com"],
    ["\\evil.com"],
    ["\\\\evil.com"],
    ["javascript:alert(1)"],
    ["data:text/html,x"],
    ["evil.com"],
    ["indicadores"],
    ["/\t/evil.com"],
    ["/\n/evil.com"],
    [" //evil.com"],
    [""],
  ])("rejeita %j e devolve /", (raw) => {
    expect(sanitizeNext(raw)).toBe("/");
  });

  it("devolve / para ausente", () => {
    expect(sanitizeNext(null)).toBe("/");
    expect(sanitizeNext(undefined)).toBe("/");
  });
});
