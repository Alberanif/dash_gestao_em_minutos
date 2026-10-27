/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { FilterRecord } from "@/types/indicadores";
import { EventosLista } from "../eventos/eventos-lista";
import { estadoDoEvento } from "../eventos/novo-evento/estado";
import { mockReducedMotion } from "./helpers";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), refresh }) }));

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const alfa: FilterRecord = {
  id: "a1",
  account_id: "acc",
  name: "Imersão Alfa",
  hotmart_products: [{ product_id: "1", product_name: "Produto 1" }],
  meta_ads_terms: ["PC"],
  captacao_leads_eventos: [],
  is_organic: false,
  start_date: "2026-06-01",
  end_date: "2026-06-20",
  status: "ativo",
  status_changed_at: null,
  created_at: "2026-06-01T15:00:00Z",
  updated_at: "2026-07-02T15:00:00Z",
};

let chamadas: { url: string; method?: string; body?: Record<string, unknown> }[];

beforeEach(() => {
  mockReducedMotion(true);
  refresh.mockReset();
  chamadas = [];
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    chamadas.push({ url: String(url), method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (String(url).includes("/api/indicadores/leads/events")) return { ok: true, json: async () => [] } as Response;
    if (String(url).includes("/api/funnels/products")) return { ok: true, json: async () => [] } as Response;
    return { ok: true, status: init?.method === "DELETE" ? 204 : 200, json: async () => ({}) } as Response;
  }) as unknown as typeof fetch;
});

function abrirMenu() {
  render(<EventosLista accountId="acc" filters={[alfa]} />);
  fireEvent.click(within(screen.getByTestId("evento-card-a1")).getByRole("button", { name: "Opções de Imersão Alfa" }));
}

describe("menu de três pontos do cartão do evento", () => {
  it("oferece editar, adicionar a uma pasta e excluir; o botão de pasta não existe mais", () => {
    render(
      <EventosLista
        accountId="acc"
        filters={[alfa]}
        pastasDisponiveis
        acoes={{
          criar: jest.fn(),
          atualizar: jest.fn(),
          excluir: jest.fn(),
          definirPastasDoEvento: jest.fn(),
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: /^Pastas de/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Opções de Imersão Alfa" }));
    expect(screen.getByRole("button", { name: "Editar evento" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Adicionar a uma pasta" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Excluir evento" })).toBeTruthy();
  });

  it("sem pastas disponíveis o menu mantém só editar e excluir", () => {
    abrirMenu();
    expect(screen.queryByRole("button", { name: "Adicionar a uma pasta" })).toBeNull();
    expect(screen.getByRole("button", { name: "Editar evento" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Excluir evento" })).toBeTruthy();
  });

  it("excluir pede confirmação e só então apaga o evento e atualiza a lista", async () => {
    abrirMenu();
    fireEvent.click(screen.getByRole("button", { name: "Excluir evento" }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText(/Excluir o evento “Imersão Alfa”\?/)).toBeTruthy();
    expect(chamadas.some((c) => c.method === "DELETE")).toBe(false);

    await act(async () => {
      fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir evento" }));
    });
    expect(chamadas).toContainEqual(expect.objectContaining({ url: "/api/indicadores/filters/a1", method: "DELETE" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("cancelar a exclusão não apaga nada", async () => {
    abrirMenu();
    fireEvent.click(screen.getByRole("button", { name: "Excluir evento" }));
    const dialogo = await screen.findByRole("dialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(chamadas.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("editar abre o assistente já preenchido e salva com PUT, sem sair da lista", async () => {
    abrirMenu();
    fireEvent.click(screen.getByRole("button", { name: "Editar evento" }));
    const nome = (await screen.findByLabelText("Nome do evento")) as HTMLInputElement;
    expect(nome.value).toBe("Imersão Alfa");
    expect((screen.getByLabelText("Data de início") as HTMLInputElement).value).toBe("2026-06-01");

    fireEvent.change(nome, { target: { value: "Imersão Alfa 2" } });
    // Evento existente: as etapas já estão liberadas no trilho.
    fireEvent.click(screen.getByRole("button", { name: /Revisão/ }));
    const salvar = screen.getByRole("button", { name: "Salvar alterações" }) as HTMLButtonElement;
    expect(salvar.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(salvar);
    });

    const put = chamadas.find((c) => c.method === "PUT");
    expect(put?.url).toBe("/api/indicadores/filters/a1");
    expect(put?.body).toMatchObject({ name: "Imersão Alfa 2", start_date: "2026-06-01", end_date: "2026-06-20", is_organic: false });
    expect(chamadas.some((c) => c.method === "POST")).toBe(false);
    expect(refresh).toHaveBeenCalled();
  });
});

describe("estadoDoEvento", () => {
  it("traz o evento salvo para o estado do assistente", () => {
    expect(estadoDoEvento({ ...alfa, is_organic: true, meta_ads_terms: [] })).toMatchObject({
      nome: "Imersão Alfa",
      inicio: "2026-06-01",
      fim: "2026-06-20",
      organico: true,
      termos: [""],
      produtosCaptura: [{ product_id: "1", product_name: "Produto 1" }],
    });
  });

  it("evento sem período vira datas vazias", () => {
    expect(estadoDoEvento({ ...alfa, start_date: null, end_date: undefined })).toMatchObject({ inicio: "", fim: "" });
  });
});
