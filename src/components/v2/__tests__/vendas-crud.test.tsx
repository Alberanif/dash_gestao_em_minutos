/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TelaDeVendas } from "../vendas/tela-de-vendas";
import type { UserRole } from "@/types/auth";
import { mockReducedMotion } from "./helpers";
import { PRODUCTS, PASTA, makeView, instalaFetch, polyfillsDoRadix } from "./vendas-helpers";

// O chunk lazy dos gráficos vira o gráfico real.
jest.mock("../evento/charts-lazy", () => {
  const c = jest.requireActual("../charts");
  return { LineChartLazy: c.LineChart, BarChartDiarioLazy: c.BarChartDiario };
});

const SEM_EDICAO = "leitor" as unknown as UserRole;

let confirmSpy: jest.SpyInstance;
let alertSpy: jest.SpyInstance;

beforeEach(() => {
  mockReducedMotion(false);
  polyfillsDoRadix();
  confirmSpy = jest.spyOn(window, "confirm").mockImplementation(() => true);
  alertSpy = jest.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  // Nenhum fluxo da tela pode recorrer aos diálogos nativos.
  expect(confirmSpy).not.toHaveBeenCalled();
  expect(alertSpy).not.toHaveBeenCalled();
  jest.restoreAllMocks();
});

async function escolher(rotulo: string, opcao: string) {
  const campo = screen.getByRole("combobox", { name: rotulo });
  fireEvent.focus(campo);
  const alvo = (await screen.findAllByRole("option")).find((o) => o.textContent?.startsWith(opcao));
  fireEvent.mouseDown(alvo!);
}

describe("Papéis: quem não edita não vê nenhuma ação de gestão", () => {
  it("sem botões de criar, editar, menu de pasta nem convite no estado vazio", async () => {
    instalaFetch({ views: [makeView({ folder_id: "f1" })], folders: [PASTA] });
    render(<TelaDeVendas role={SEM_EDICAO} products={PRODUCTS} />);
    await screen.findByTestId("view-dashboard");
    expect(screen.queryByTestId("vendas-new-view-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vendas-new-folder-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vendas-edit-view-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("folder-menu-btn-f1")).not.toBeInTheDocument();
  });

  it("sem convite para criar no estado vazio", async () => {
    instalaFetch({ views: [] });
    render(<TelaDeVendas role={SEM_EDICAO} products={PRODUCTS} />);
    await screen.findByTestId("vendas-empty-state");
    expect(screen.queryByTestId("vendas-create-cta")).not.toBeInTheDocument();
  });

  it("gestor e analista veem criar visualização, criar pasta e editar", async () => {
    for (const role of ["gestor", "analista"] as const) {
      instalaFetch({ views: [makeView()] });
      const { unmount } = render(<TelaDeVendas role={role} products={PRODUCTS} />);
      await screen.findByTestId("view-dashboard");
      expect(screen.getByTestId("vendas-new-view-btn")).toBeInTheDocument();
      expect(screen.getByTestId("vendas-new-folder-btn")).toBeInTheDocument();
      expect(screen.getByTestId("vendas-edit-view-btn")).toBeInTheDocument();
      unmount();
    }
  });
});

describe("Visualização: criar e editar", () => {
  it("o botão do estado vazio abre o modal; criar seleciona a nova visualização e fecha", async () => {
    const nova = makeView({ id: "nova", name: "Nova visão", offer_codes: ["OF-2"] });
    const calls = instalaFetch({
      views: [],
      overrides: { "POST /api/vendas/views": { status: 201, body: { view: nova } } },
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    fireEvent.click(await screen.findByTestId("vendas-create-cta"));

    fireEvent.change(await screen.findByTestId("view-form-name"), { target: { value: "Nova visão" } });
    await escolher("Produto", "Produto Um");
    fireEvent.click(await screen.findByTestId("view-form-offer-OF-2"));
    fireEvent.click(screen.getByTestId("view-form-save"));

    await waitFor(() => expect(screen.queryByTestId("view-form-modal")).not.toBeInTheDocument());
    expect(await screen.findByTestId("view-selected-name")).toHaveTextContent("Nova visão");
    expect(calls.find((c) => c.method === "POST")?.body).toMatchObject({ name: "Nova visão", product_id: "p1", offer_codes: ["OF-2"] });
  });

  it("devolve o foco ao botão que abriu o modal", async () => {
    instalaFetch({ views: [makeView()] });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    const gatilho = await screen.findByTestId("vendas-new-view-btn");
    gatilho.focus();
    fireEvent.click(gatilho);
    const modal = await screen.findByTestId("view-form-modal");
    expect(modal).toContainElement(document.activeElement as HTMLElement);

    fireEvent.keyDown(modal, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("view-form-modal")).not.toBeInTheDocument());
    await waitFor(() => expect(gatilho).toHaveFocus());
  });

  it("editar atualiza a visualização na tela", async () => {
    const editada = makeView({ name: "Nome novo" });
    const calls = instalaFetch({
      views: [makeView()],
      overrides: { "PATCH /api/vendas/views/v1": { body: { view: editada } } },
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    fireEvent.click(await screen.findByTestId("vendas-edit-view-btn"));
    fireEvent.change(await screen.findByTestId("view-form-name"), { target: { value: "Nome novo" } });
    await screen.findByTestId("view-form-offer-OF-1");
    fireEvent.click(screen.getByTestId("view-form-save"));

    await waitFor(() => expect(screen.queryByTestId("view-form-modal")).not.toBeInTheDocument());
    expect(screen.getByTestId("view-selected-name")).toHaveTextContent("Nome novo");
    expect(calls.find((c) => c.method === "PATCH")?.body).toMatchObject({ name: "Nome novo" });
  });
});

describe("Visualização: excluir", () => {
  async function abrirEditarEExcluir() {
    fireEvent.click(await screen.findByTestId("vendas-edit-view-btn"));
    await screen.findByTestId("view-form-offer-OF-1");
    fireEvent.click(await screen.findByTestId("view-form-delete-open"));
  }

  it("cancelar não chama a API; confirmar faz DELETE, remove da lista e reseleciona", async () => {
    const calls = instalaFetch({
      views: [
        makeView({ id: "v1", name: "Visão 1", created_at: "2026-08-02T00:00:00Z" }),
        makeView({ id: "v2", name: "Visão 2", created_at: "2026-08-01T00:00:00Z" }),
      ],
      overrides: { "DELETE /api/vendas/views/v1": { body: { ok: true } } },
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    await abrirEditarEExcluir();

    const confirmacao = await screen.findByRole("dialog", { name: "Excluir visualização" });
    expect(confirmacao).toHaveTextContent('Excluir a visualização "Visão 1"?');
    expect(confirmacao).toHaveTextContent("As vendas coletadas da Hotmart não são apagadas");
    fireEvent.click(within(confirmacao).getByRole("button", { name: "Cancelar" }));
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Excluir visualização", hidden: false })).toBeNull());
    fireEvent.click(screen.getByTestId("view-form-delete-open"));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Excluir visualização" })).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.url === "/api/vendas/views/v1")).toBe(true));
    await waitFor(() => expect(screen.getByTestId("view-selected-name")).toHaveTextContent("Visão 2"));
    expect(screen.queryByTestId("view-form-modal")).not.toBeInTheDocument();
  });

  it("depois de excluir a selecionada, abre a mais recente das que sobram (não a primeira da lista)", async () => {
    instalaFetch({
      views: [
        makeView({ id: "velha", name: "Velha", created_at: "2026-01-01T00:00:00Z" }),
        makeView({ id: "nova", name: "Nova", created_at: "2026-08-05T00:00:00Z" }),
        makeView({ id: "meio", name: "Meio", created_at: "2026-05-01T00:00:00Z" }),
      ],
      overrides: { "DELETE /api/vendas/views/nova": { body: { ok: true } } },
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    await abrirEditarEExcluir();
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Excluir visualização" })).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(screen.getByTestId("view-selected-name")).toHaveTextContent("Meio"));
  });

  it("erro da API fica no diálogo, que permanece aberto (sem alert)", async () => {
    instalaFetch({
      views: [makeView()],
      overrides: { "DELETE /api/vendas/views/v1": { status: 500, body: { error: "Falha no banco" } } },
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    await abrirEditarEExcluir();
    const confirmacao = await screen.findByRole("dialog", { name: "Excluir visualização" });
    fireEvent.click(within(confirmacao).getByRole("button", { name: "Excluir" }));
    expect(await within(confirmacao).findByRole("alert")).toHaveTextContent("Falha no banco");
    expect(screen.getByRole("dialog", { name: "Excluir visualização" })).toBeInTheDocument();
  });

  it("excluir a última visualização leva ao estado vazio", async () => {
    instalaFetch({
      views: [makeView()],
      overrides: { "DELETE /api/vendas/views/v1": { body: { ok: true } } },
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    await abrirEditarEExcluir();
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Excluir visualização" })).getByRole("button", { name: "Excluir" }));
    expect(await screen.findByTestId("vendas-empty-state")).toBeInTheDocument();
  });
});

describe("Pastas", () => {
  it("criar pasta: POST e a pasta aparece no painel", async () => {
    const calls = instalaFetch({
      views: [makeView()],
      overrides: {
        "POST /api/vendas/folders": {
          status: 201,
          body: { folder: { ...PASTA, id: "f9", name: "Nova pasta" } },
        },
      },
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    fireEvent.click(await screen.findByTestId("vendas-new-folder-btn"));
    fireEvent.change(await screen.findByTestId("folder-name-input"), { target: { value: "Nova pasta" } });
    fireEvent.click(screen.getByTestId("folder-form-submit"));

    await waitFor(() => expect(screen.queryByTestId("folder-form-modal")).not.toBeInTheDocument());
    expect(screen.getByTestId("folder-section-f9")).toHaveTextContent("Nova pasta");
    expect(calls.find((c) => c.method === "POST" && c.url === "/api/vendas/folders")?.body).toEqual({ name: "Nova pasta" });
  });

  it("erro da API ao criar pasta fica no modal, que continua aberto", async () => {
    instalaFetch({
      views: [makeView()],
      overrides: { "POST /api/vendas/folders": { status: 409, body: { error: "Já existe uma pasta com esse nome" } } },
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    fireEvent.click(await screen.findByTestId("vendas-new-folder-btn"));
    fireEvent.change(await screen.findByTestId("folder-name-input"), { target: { value: "Repetida" } });
    fireEvent.click(screen.getByTestId("folder-form-submit"));
    expect(await screen.findByTestId("folder-form-error")).toHaveTextContent("Já existe uma pasta com esse nome");
    expect(screen.getByTestId("folder-form-modal")).toBeInTheDocument();
  });

  it("renomear pasta: PATCH e o novo nome aparece", async () => {
    const calls = instalaFetch({
      views: [makeView({ folder_id: "f1" })],
      folders: [PASTA],
      overrides: { "PATCH /api/vendas/folders/f1": { body: { folder: { ...PASTA, name: "Renomeada" } } } },
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    fireEvent.click(await screen.findByTestId("folder-menu-btn-f1"));
    fireEvent.click(await screen.findByTestId("folder-rename-btn-f1"));
    const campo = await screen.findByTestId("folder-name-input");
    expect(campo).toHaveValue("Lançamentos");
    fireEvent.change(campo, { target: { value: "Renomeada" } });
    fireEvent.click(screen.getByTestId("folder-form-submit"));

    await waitFor(() => expect(screen.queryByTestId("folder-form-modal")).not.toBeInTheDocument());
    expect(screen.getByTestId("folder-section-f1")).toHaveTextContent("Renomeada");
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ name: "Renomeada" });
  });

  it("deletar pasta usa a confirmação e solta as visualizações para 'Sem pasta'", async () => {
    const calls = instalaFetch({
      views: [makeView({ folder_id: "f1" })],
      folders: [PASTA],
      overrides: { "DELETE /api/vendas/folders/f1": { body: { ok: true } } },
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    fireEvent.click(await screen.findByTestId("folder-menu-btn-f1"));
    fireEvent.click(await screen.findByTestId("folder-delete-btn-f1"));

    const confirmacao = await screen.findByRole("dialog", { name: "Deletar pasta" });
    expect(confirmacao).toHaveTextContent("Lançamentos");
    expect(confirmacao).toHaveTextContent('voltarão para "Sem pasta"');
    fireEvent.click(within(confirmacao).getByRole("button", { name: "Deletar" }));

    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.url === "/api/vendas/folders/f1")).toBe(true));
    await waitFor(() => expect(screen.queryByTestId("folder-section-f1")).not.toBeInTheDocument());
    expect(screen.getByTestId("folder-section-unfoldered")).toBeInTheDocument();
    expect(screen.getByTestId("vendas-view-option-v1")).toBeInTheDocument();

    // A visualização deixou de apontar para a pasta apagada: editar mostra "Sem pasta".
    fireEvent.click(screen.getByTestId("vendas-edit-view-btn"));
    await screen.findByTestId("view-form-modal");
    expect(screen.getByRole("combobox", { name: "Pasta" })).toHaveTextContent("Sem pasta");
  });

  it("erro ao deletar a pasta fica no diálogo e a pasta continua na tela", async () => {
    instalaFetch({
      views: [makeView({ folder_id: "f1" })],
      folders: [PASTA],
      overrides: { "DELETE /api/vendas/folders/f1": { status: 500, body: { error: "Falha ao deletar" } } },
    });
    render(<TelaDeVendas role="gestor" products={PRODUCTS} />);
    fireEvent.click(await screen.findByTestId("folder-menu-btn-f1"));
    fireEvent.click(await screen.findByTestId("folder-delete-btn-f1"));
    const confirmacao = await screen.findByRole("dialog", { name: "Deletar pasta" });
    fireEvent.click(within(confirmacao).getByRole("button", { name: "Deletar" }));
    expect(await within(confirmacao).findByRole("alert")).toHaveTextContent("Falha ao deletar");
    expect(screen.getByTestId("folder-section-f1")).toBeInTheDocument();
  });
});
