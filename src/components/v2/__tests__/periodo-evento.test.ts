import type { FilterRecord } from "@/types/indicadores";
import { periodoDoEvento } from "../eventos/periodo";

const base = { status: "finalizado", created_at: "2026-03-12T15:00:00Z", status_changed_at: "2026-06-30T15:00:00Z" } as FilterRecord;

describe("periodoDoEvento", () => {
  it("ativo diz só desde quando", () => {
    expect(periodoDoEvento({ ...base, status: "ativo", status_changed_at: null })).toBe("desde 12 mar 2026");
  });
  it("no mesmo ano, o ano aparece uma vez", () => {
    expect(periodoDoEvento(base)).toBe("12 mar – 30 jun 2026");
  });
  it("entre anos, os dois aparecem", () => {
    expect(periodoDoEvento({ ...base, status_changed_at: "2027-01-05T15:00:00Z" })).toBe("12 mar 2026 – 5 jan 2027");
  });
  it("usa o dia de Brasília", () => {
    expect(periodoDoEvento({ ...base, status: "ativo", created_at: "2026-03-12T01:00:00Z" })).toBe("desde 11 mar 2026");
  });
});
