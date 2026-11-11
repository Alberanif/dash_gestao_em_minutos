/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ModalDeVisualizacao } from "../vendas/modal-de-visualizacao";
import { ModalDePasta } from "../vendas/modal-de-pasta";
import type { VendasViewRecord } from "@/types/vendas";
import { makeView, polyfillsDoRadix } from "./vendas-helpers";

const PRODUCTS = [
  { product_id: "p1", product_name: "Produto Um", account_id: "acc-1" },
  { product_id: "p2", product_name: "Produto Dois", account_id: "acc-1" },
];

const EXISTENTE: VendasViewRecord = makeView({ offer_codes: ["OF-1"] });

let calls: { method: string; url: string; body?: Record<string, unknown> }[];
let respostaDoSalvar: { status: number; body: unknown } | null;

beforeEach(() => {
  polyfillsDoRadix();
  calls = [];
  respostaDoSalvar = null;
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.startsWith("/api/vendas/offer-options")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          offers: [
            { offer_code: "OF-1", offer_name: "Oferta Um", sales_count: 10 },
            { offer_code: "OF-2", offer_name: "Oferta Dois", sales_count: 3 },
          ],
        }),
      };
    }
    if (respostaDoSalvar) {
      return { ok: respostaDoSalvar.status < 400, status: respostaDoSalvar.status, json: async () => respostaDoSalvar!.body };
    }
    return { ok: true, status: method === "POST" ? 201 : 200, json: async () => ({ view: { ...EXISTENTE, id: "novo" } }) };
  }) as unknown as typeof global.fetch;
});

afterEach(() => jest.restoreAllMocks());

async function escolherNoSelect(rotulo: string, opcao: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: rotulo }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("option", { name: opcao }));
}

async function escolher(rotulo: string, opcao: string) {
  const campo = screen.getByRole("combobox", { name: rotulo });
  fireEvent.focus(campo);
  const alvo = (await screen.findAllByRole("option")).find((o) => o.textContent?.startsWith(opcao));
  fireEvent.mouseDown(alvo!);
}

describe("ModalDeVisualizacao: criar", () => {
  it("lista as ofertas do produto escolhido e cria com POST, sem campos do modelo antigo", async () => {
    const onSaved = jest.fn();
    render(<ModalDeVisualizacao products={PRODUCTS} folders={[]} onSaved={onSaved} onCancel={() => {}} />);

    fireEvent.change(screen.getByTestId("view-form-name"), { target: { value: "  Minha visão  " } });
    await escolher("Produto", "Produto Um");
    expect(await screen.findByTestId("view-form-offer-OF-1")).toBeInTheDocument();
    expect(calls.some((c) => c.url === "/api/vendas/offer-options?product_id=p1")).toBe(true);
    fireEvent.click(screen.getByTestId("view-form-offer-OF-2"));
    fireEvent.click(screen.getByTestId("view-form-save"));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "novo" }), "created"));
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.url).toBe("/api/vendas/views");
    expect(post.body).toEqual({
      name: "Minha visão",
      folder_id: null,
      product_id: "p1",
      offer_codes: ["OF-2"],
      view_start_date: null,
      view_end_date: null,
    });
  });

  it("o botão de confirmação usa o verbo da ação", () => {
    render(<ModalDeVisualizacao products={PRODUCTS} folders={[]} onSaved={jest.fn()} onCancel={() => {}} />);
    expect(screen.getByTestId("view-form-save")).toHaveTextContent("Criar visualização");
    expect(screen.getByTestId("view-form-save")).not.toHaveTextContent(/enviar/i);
  });

  it("a pasta escolhida vai no POST", async () => {
    render(
      <ModalDeVisualizacao
        products={PRODUCTS}
        folders={[{ id: "f1", name: "Lançamentos", account_id: "acc-1", created_at: "x", updated_at: "x" }]}
        onSaved={jest.fn()}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByTestId("view-form-name"), { target: { value: "X" } });
    await escolherNoSelect("Pasta", "Lançamentos");
    await escolher("Produto", "Produto Um");
    await screen.findByTestId("view-form-offer-OF-1");
    fireEvent.click(screen.getByTestId("view-form-offer-OF-1"));
    fireEvent.click(screen.getByTestId("view-form-save"));
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    expect(calls.find((c) => c.method === "POST")!.body).toMatchObject({ folder_id: "f1" });
  });

  it("exige nome, produto e ao menos uma oferta", async () => {
    render(<ModalDeVisualizacao products={PRODUCTS} folders={[]} onSaved={jest.fn()} onCancel={() => {}} />);
    fireEvent.click(screen.getByTestId("view-form-save"));
    expect(screen.getByTestId("view-form-error")).toHaveTextContent("Nome é obrigatório.");
    fireEvent.change(screen.getByTestId("view-form-name"), { target: { value: "X" } });
    fireEvent.click(screen.getByTestId("view-form-save"));
    expect(screen.getByTestId("view-form-error")).toHaveTextContent("Selecione um produto.");
    await escolher("Produto", "Produto Um");
    await screen.findByTestId("view-form-offer-OF-1");
    fireEvent.click(screen.getByTestId("view-form-save"));
    expect(screen.getByTestId("view-form-error")).toHaveTextContent("ao menos uma oferta");
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("código manual: trim, aceita sem venda conhecida, recusa duplicado e vazio", async () => {
    render(<ModalDeVisualizacao products={PRODUCTS} folders={[]} onSaved={jest.fn()} onCancel={() => {}} />);
    await escolher("Produto", "Produto Um");
    await screen.findByTestId("view-form-offer-OF-1");

    fireEvent.click(screen.getByTestId("view-form-manual-add"));
    expect(screen.getByTestId("view-form-offer-message")).toHaveTextContent("Informe um código");

    fireEvent.change(screen.getByTestId("view-form-manual-input"), { target: { value: "  ZZ9  " } });
    fireEvent.click(screen.getByTestId("view-form-manual-add"));
    expect(screen.getByTestId("view-form-offer-ZZ9")).toBeChecked();

    fireEvent.change(screen.getByTestId("view-form-manual-input"), { target: { value: "ZZ9" } });
    fireEvent.click(screen.getByTestId("view-form-manual-add"));
    expect(screen.getByTestId("view-form-offer-message")).toHaveTextContent("já está na lista");
  });

  it("a busca filtra a lista por nome ou código", async () => {
    render(<ModalDeVisualizacao products={PRODUCTS} folders={[]} onSaved={jest.fn()} onCancel={() => {}} />);
    await escolher("Produto", "Produto Um");
    await screen.findByTestId("view-form-offer-OF-1");
    fireEvent.change(screen.getByTestId("view-form-offer-search"), { target: { value: "dois" } });
    expect(screen.queryByTestId("view-form-offer-OF-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("view-form-offer-OF-2")).toBeInTheDocument();
  });

  it("período com uma data só ou invertido é recusado", async () => {
    render(<ModalDeVisualizacao products={PRODUCTS} folders={[]} onSaved={jest.fn()} onCancel={() => {}} />);
    fireEvent.change(screen.getByTestId("view-form-name"), { target: { value: "X" } });
    await escolher("Produto", "Produto Um");
    await screen.findByTestId("view-form-offer-OF-1");
    fireEvent.click(screen.getByTestId("view-form-offer-OF-1"));
    fireEvent.change(screen.getByTestId("view-form-start"), { target: { value: "2026-08-10" } });
    fireEvent.click(screen.getByTestId("view-form-save"));
    expect(screen.getByTestId("view-form-error")).toHaveTextContent("duas datas");
    fireEvent.change(screen.getByTestId("view-form-end"), { target: { value: "2026-08-01" } });
    fireEvent.click(screen.getByTestId("view-form-save"));
    expect(screen.getByTestId("view-form-error")).toHaveTextContent("anterior");
  });

  it("erro da API aparece no modal, que continua aberto", async () => {
    respostaDoSalvar = { status: 400, body: { error: "Já existe uma visualização com esse nome" } };
    const onSaved = jest.fn();
    const onCancel = jest.fn();
    render(<ModalDeVisualizacao products={PRODUCTS} folders={[]} onSaved={onSaved} onCancel={onCancel} />);
    fireEvent.change(screen.getByTestId("view-form-name"), { target: { value: "X" } });
    await escolher("Produto", "Produto Um");
    await screen.findByTestId("view-form-offer-OF-1");
    fireEvent.click(screen.getByTestId("view-form-offer-OF-1"));
    fireEvent.click(screen.getByTestId("view-form-save"));
    expect(await screen.findByTestId("view-form-error")).toHaveTextContent("Já existe uma visualização com esse nome");
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByTestId("view-form-modal")).toBeInTheDocument();
  });

  it("Esc fecha o modal", () => {
    const onCancel = jest.fn();
    render(<ModalDeVisualizacao products={PRODUCTS} folders={[]} onSaved={jest.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });

  it("o foco entra no modal ao abrir", () => {
    render(<ModalDeVisualizacao products={PRODUCTS} folders={[]} onSaved={jest.fn()} onCancel={() => {}} />);
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
  });
});

describe("ModalDeVisualizacao: editar", () => {
  it("produto travado com explicação e botão 'Salvar alterações'", async () => {
    render(<ModalDeVisualizacao products={PRODUCTS} folders={[]} editTarget={EXISTENTE} onSaved={jest.fn()} onCancel={() => {}} />);
    expect(screen.getByRole("combobox", { name: "Produto" })).toBeDisabled();
    expect(screen.getByTestId("view-form-product-locked")).toHaveTextContent("não pode ser alterado");
    expect(screen.getByTestId("view-form-save")).toHaveTextContent("Salvar alterações");
    await screen.findByTestId("view-form-offer-OF-1");
  });

  it("bloqueia remover a última oferta, com a mensagem do PRD", async () => {
    render(<ModalDeVisualizacao products={PRODUCTS} folders={[]} editTarget={EXISTENTE} onSaved={jest.fn()} onCancel={() => {}} />);
    const caixa = await screen.findByTestId("view-form-offer-OF-1");
    expect(caixa).toBeChecked();
    fireEvent.click(caixa);
    expect(caixa).toBeChecked();
    expect(screen.getByTestId("view-form-offer-message")).toHaveTextContent(
      "Uma visualização precisa de pelo menos uma oferta; para descartar, exclua a visualização.",
    );
  });

  it("com 2 ofertas dá para remover uma; o PATCH não envia product_id", async () => {
    const onSaved = jest.fn();
    render(
      <ModalDeVisualizacao
        products={PRODUCTS}
        folders={[]}
        editTarget={{ ...EXISTENTE, offer_codes: ["OF-1", "OF-2"] }}
        onSaved={onSaved}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(await screen.findByTestId("view-form-offer-OF-2"));
    fireEvent.click(screen.getByTestId("view-form-save"));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.anything(), "edited"));
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.url).toBe("/api/vendas/views/v1");
    expect(patch.body).toEqual({
      name: "Visão 1",
      folder_id: null,
      offer_codes: ["OF-1"],
      view_start_date: null,
      view_end_date: null,
    });
    expect(patch.body).not.toHaveProperty("product_id");
  });

  it("oferta salva que a Hotmart não lista continua visível, como código manual", async () => {
    render(
      <ModalDeVisualizacao
        products={PRODUCTS}
        folders={[]}
        editTarget={{ ...EXISTENTE, offer_codes: ["OF-1", "SO-MANUAL"] }}
        onSaved={jest.fn()}
        onCancel={() => {}}
      />,
    );
    expect(await screen.findByTestId("view-form-offer-SO-MANUAL")).toBeChecked();
  });

  it("'Excluir visualização' pede a exclusão da visualização aberta", async () => {
    const onRequestDelete = jest.fn();
    render(
      <ModalDeVisualizacao
        products={PRODUCTS}
        folders={[]}
        editTarget={EXISTENTE}
        onSaved={jest.fn()}
        onCancel={() => {}}
        onRequestDelete={onRequestDelete}
      />,
    );
    await screen.findByTestId("view-form-offer-OF-1");
    fireEvent.click(screen.getByTestId("view-form-delete-open"));
    expect(onRequestDelete).toHaveBeenCalledWith(EXISTENTE);
  });

  it("criar não oferece excluir", () => {
    render(<ModalDeVisualizacao products={PRODUCTS} folders={[]} onSaved={jest.fn()} onCancel={() => {}} onRequestDelete={jest.fn()} />);
    expect(screen.queryByTestId("view-form-delete-open")).not.toBeInTheDocument();
  });
});

describe("ModalDePasta", () => {
  it("modo criação por padrão", () => {
    render(<ModalDePasta onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Nova pasta");
    expect(screen.getByTestId("folder-form-submit")).toHaveTextContent("Criar pasta");
  });

  it("modo edição com o nome preenchido", () => {
    const pasta = { id: "f1", name: "Pasta Existente", account_id: "acc-1", created_at: "x", updated_at: "x" };
    render(<ModalDePasta folderTarget={pasta} onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Renomear pasta");
    expect(screen.getByTestId("folder-name-input")).toHaveValue("Pasta Existente");
    expect(screen.getByTestId("folder-form-submit")).toHaveTextContent("Salvar nome");
  });

  it("nome vazio mostra o erro e não chama onSave", async () => {
    const onSave = jest.fn();
    render(<ModalDePasta onSave={onSave} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByTestId("folder-form-submit"));
    expect(await screen.findByTestId("folder-form-error")).toHaveTextContent("Nome da pasta é obrigatório");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("chama onSave com o nome aparado", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<ModalDePasta onSave={onSave} onCancel={jest.fn()} />);
    fireEvent.change(screen.getByTestId("folder-name-input"), { target: { value: "  Minha Pasta  " } });
    fireEvent.click(screen.getByTestId("folder-form-submit"));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("Minha Pasta"));
  });

  it("erro da API aparece no modal, que continua aberto e permite nova tentativa", async () => {
    const onSave = jest.fn().mockRejectedValueOnce(new Error("Já existe uma pasta com esse nome")).mockResolvedValueOnce(undefined);
    const onCancel = jest.fn();
    render(<ModalDePasta onSave={onSave} onCancel={onCancel} />);
    fireEvent.change(screen.getByTestId("folder-name-input"), { target: { value: "Repetida" } });
    fireEvent.click(screen.getByTestId("folder-form-submit"));
    expect(await screen.findByTestId("folder-form-error")).toHaveTextContent("Já existe uma pasta com esse nome");
    expect(onCancel).not.toHaveBeenCalled();
    expect(within(screen.getByRole("dialog")).getByTestId("folder-form-submit")).not.toBeDisabled();

    fireEvent.click(screen.getByTestId("folder-form-submit"));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  });

  it("Esc fecha", () => {
    const onCancel = jest.fn();
    render(<ModalDePasta onSave={jest.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});
