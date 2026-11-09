/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { FilterRecord } from "@/types/indicadores";
import { ProvedorEvento } from "../evento/contexto";
import { ControlesDoEvento } from "../evento/controles";
import { CorpoDoEvento } from "../evento/corpo-do-evento";
import { visaoDaUrl } from "../evento/visao";
import { mockReducedMotion } from "./helpers";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function Falso() {
      return <div data-testid="tela-debriefing" />;
    },
}));

const HOJE = "2026-07-28";
const PERIODO = { startDate: "2026-07-01", endDate: "2026-07-28", preset: "28d" as const };
const filtro = {
  id: "11111111-1111-4111-8111-111111111111",
  account_id: "acc",
  name: "Imersão",
  hotmart_products: [],
  meta_ads_terms: [],
  captacao_leads_eventos: [],
  is_organic: false,
  status: "ativo",
  status_changed_at: null,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
} as unknown as FilterRecord;

function montar(visaoInicial?: "dashboard" | "debriefing") {
  return render(
    <ProvedorEvento filter={filtro} filters={[filtro]} periodoInicial={PERIODO} hoje={HOJE} visaoInicial={visaoInicial}>
      <ControlesDoEvento />
      <CorpoDoEvento dashboard={<p>blocos do dashboard</p>} />
    </ProvedorEvento>,
  );
}

beforeEach(() => {
  mockReducedMotion(true);
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })) as unknown as typeof fetch;
  window.history.replaceState(null, "", "/v2/indicadores/x");
});

describe("visaoDaUrl", () => {
  it("aceita debriefing; ausente, inválido ou repetido cai em dashboard", () => {
    expect(visaoDaUrl({ view: "debriefing" })).toBe("debriefing");
    expect(visaoDaUrl({ view: ["debriefing", "x"] })).toBe("debriefing");
    expect(visaoDaUrl({})).toBe("dashboard");
    expect(visaoDaUrl({ view: "qualquer-coisa" })).toBe("dashboard");
    expect(visaoDaUrl({ view: "planilha" })).toBe("dashboard");
  });
});

describe("Switch Dashboard | Debriefing", () => {
  it("começa no Dashboard, com o switch rotulado 'Visão'", () => {
    montar();
    expect(screen.getByRole("tablist", { name: "Visão" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Dashboard" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("blocos do dashboard").parentElement?.hidden).toBe(false);
    expect(screen.queryByTestId("tela-debriefing")).toBeNull();
  });

  it("abre direto no Debriefing quando a URL pede", () => {
    montar("debriefing");
    expect(screen.getByRole("tab", { name: "Debriefing" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("tela-debriefing")).toBeTruthy();
  });

  it("alternar grava ?view= preservando de/ate, e voltar remove só o view", () => {
    window.history.replaceState(null, "", "/v2/indicadores/x?de=2026-07-02&ate=2026-07-10");
    montar();
    fireEvent.click(screen.getByRole("tab", { name: "Debriefing" }));
    let q = new URLSearchParams(window.location.search);
    expect(q.get("view")).toBe("debriefing");
    expect(q.get("de")).toBe("2026-07-02");
    expect(q.get("ate")).toBe("2026-07-10");
    expect(screen.getByTestId("tela-debriefing")).toBeTruthy();
    expect(screen.getByText("blocos do dashboard").parentElement?.hidden).toBe(true);

    fireEvent.click(screen.getByRole("tab", { name: "Dashboard" }));
    q = new URLSearchParams(window.location.search);
    expect(q.has("view")).toBe(false);
    expect(q.get("de")).toBe("2026-07-02");
    expect(screen.queryByTestId("tela-debriefing")).toBeNull();
  });

  it("trocar o período depois preserva o view", () => {
    montar("debriefing");
    window.history.replaceState(null, "", "/v2/indicadores/x?view=debriefing");
    fireEvent.click(screen.getByRole("tab", { name: "7 dias" }));
    const q = new URLSearchParams(window.location.search);
    expect(q.get("view")).toBe("debriefing");
    expect(q.get("de")).toBeTruthy();
  });

  it("teclado: setas, Home e End movem a visão", () => {
    montar();
    const dash = screen.getByRole("tab", { name: "Dashboard" });
    fireEvent.keyDown(dash, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Debriefing" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Debriefing" }), { key: "Home" });
    expect(screen.getByRole("tab", { name: "Dashboard" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Dashboard" }), { key: "End" });
    expect(screen.getByRole("tab", { name: "Debriefing" }).getAttribute("aria-selected")).toBe("true");
  });

  it("alternar não faz requisição", () => {
    montar();
    (global.fetch as jest.Mock).mockClear();
    fireEvent.click(screen.getByRole("tab", { name: "Debriefing" }));
    const dados = (global.fetch as jest.Mock).mock.calls.filter((c) => !String(c[0]).startsWith("/api/indicadores/refresh"));
    expect(dados).toHaveLength(0);
  });
});

describe("orçamento da rota do evento", () => {
  it("a tela do Debriefing só entra por import() dinâmico, nunca estático", () => {
    const { readFileSync } = jest.requireActual("node:fs") as typeof import("node:fs");
    const { join } = jest.requireActual("node:path") as typeof import("node:path");
    const src = readFileSync(join(__dirname, "../evento/corpo-do-evento.tsx"), "utf8");
    expect(src).not.toMatch(/^import .*tela-debriefing/m);
    expect(src).toMatch(/import\(["']\.\/debriefing\/tela-debriefing["']\)/);
  });
});
