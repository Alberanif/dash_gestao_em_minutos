/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AssistenteNovoEvento } from "../eventos/novo-evento/assistente";

/** Assistente com as cinco etapas reais: só rede e roteador são simulados. */

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

let postBody: Record<string, unknown> | null;

beforeEach(() => {
  push.mockReset();
  postBody = null;
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/api/indicadores/leads/events")) return { ok: true, json: async () => ["Evento A", "Evento B"] } as Response;
    if (u.includes("/api/funnels/products")) return { ok: true, json: async () => [] } as Response;
    if (u === "/api/indicadores/filters" && init?.method === "POST") {
      postBody = JSON.parse(String(init.body));
      return { ok: true, status: 201, json: async () => ({ id: "11111111-1111-4111-8111-111111111111" }) } as Response;
    }
    return { ok: false, json: async () => ({}) } as Response;
  }) as unknown as typeof fetch;
});

const continuar = () => screen.getByRole("button", { name: "Continuar" });

describe("AssistenteNovoEvento com as etapas reais", () => {
  it("cria um evento orgânico com período e abre o dashboard novo", async () => {
    render(<AssistenteNovoEvento accountId="acc-1" onFechar={jest.fn()} />);

    fireEvent.change(screen.getByLabelText("Nome do evento"), { target: { value: "Imersão 2026" } });
    fireEvent.change(screen.getByLabelText("Data de início"), { target: { value: "2026-06-01" } });
    fireEvent.change(screen.getByLabelText("Data de fim"), { target: { value: "2026-06-20" } });
    fireEvent.click(continuar());

    // Captação: liga o orgânico e marca um evento de Leads.
    fireEvent.click(screen.getByRole("switch", { name: /Captação orgânica/ }));
    fireEvent.click(await screen.findByLabelText("Evento A"));
    fireEvent.click(continuar()); // produto principal
    fireEvent.click(continuar()); // tráfego
    fireEvent.click(continuar()); // revisão

    const criar = screen.getByRole("button", { name: "Criar dashboard" }) as HTMLButtonElement;
    expect(criar.disabled).toBe(false);
    fireEvent.click(criar);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/v2/indicadores/11111111-1111-4111-8111-111111111111"));
    expect(postBody).toMatchObject({
      account_id: "acc-1",
      name: "Imersão 2026",
      is_organic: true,
      captacao_leads_eventos: ["Evento A"],
      start_date: "2026-06-01",
      end_date: "2026-06-20",
    });
  });

  it("evento pago sem nenhuma fonte trava a criação e a Revisão aponta a Captação", () => {
    render(<AssistenteNovoEvento accountId="acc-1" onFechar={jest.fn()} />);
    fireEvent.change(screen.getByLabelText("Nome do evento"), { target: { value: "Sem fonte" } });
    for (let i = 0; i < 4; i++) fireEvent.click(continuar());

    expect((screen.getByRole("button", { name: "Criar dashboard" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: /Resolver em Captação/ })).toBeTruthy();
    expect(postBody).toBeNull();
  });
});
