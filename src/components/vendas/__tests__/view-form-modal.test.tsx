/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ViewFormModal } from "../view-form-modal";
import type { VendasViewRecord } from "@/types/vendas";

const PRODUCTS = [
  { product_id: "p1", product_name: "Produto Um", account_id: "acc-1" },
  { product_id: "p2", product_name: "Produto Dois", account_id: "acc-1" },
  { product_id: "p3", product_name: "Produto Outra Conta", account_id: "acc-2" },
];

const EXISTING: VendasViewRecord = {
  id: "v1",
  name: "Visão 1",
  account_id: "acc-1",
  product_id: "p1",
  offer_codes: ["OF-1"],
  products: [{ product_id: "p1", offer_codes: ["OF-1"] }],
  folder_id: null,
  view_start_date: null,
  view_end_date: null,
  refresh_started_at: null,
  last_refresh_at: null,
  backfill_status: "done",
  backfill_from: null,
  migrated_from_cycle_id: null,
  created_by: "u1",
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
};

let calls: { method: string; url: string; body?: Record<string, unknown> }[];

beforeEach(() => {
  calls = [];
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
    return { ok: true, status: method === "POST" ? 201 : 200, json: async () => ({ view: { ...EXISTING, id: "novo" } }) };
  }) as unknown as typeof global.fetch;
});

afterEach(() => jest.restoreAllMocks());

const add = (id: string) => fireEvent.change(screen.getByTestId("view-form-add-product"), { target: { value: id } });
const offer = (pid: string, code: string) => screen.findByTestId(`view-form-offer-${pid}-${code}`);

describe("ViewFormModal — criar", () => {
  it("cria com 2 produtos, cada um com as suas ofertas, no contrato novo", async () => {
    const onSaved = jest.fn();
    render(<ViewFormModal products={PRODUCTS} folders={[]} onSaved={onSaved} onCancel={() => {}} />);

    fireEvent.change(screen.getByTestId("view-form-name"), { target: { value: "  Minha visão  " } });
    add("p1");
    fireEvent.click(await offer("p1", "OF-2"));
    add("p2");
    fireEvent.click(await offer("p2", "OF-1"));
    fireEvent.click(screen.getByTestId("view-form-offer-p2-OF-2"));
    expect(calls.some((c) => c.url === "/api/vendas/offer-options?product_id=p2")).toBe(true);
    fireEvent.click(screen.getByTestId("view-form-save"));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "novo" }), "created"));
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.url).toBe("/api/vendas/views");
    expect(post.body).toEqual({
      name: "Minha visão",
      folder_id: null,
      products: [
        { product_id: "p1", offer_codes: ["OF-2"] },
        { product_id: "p2", offer_codes: ["OF-1", "OF-2"] },
      ],
      view_start_date: null,
      view_end_date: null,
    });
  });

  it("seletor exclui produtos já escolhidos e de outra conta", async () => {
    render(<ViewFormModal products={PRODUCTS} folders={[]} onSaved={jest.fn()} onCancel={() => {}} />);
    // Sem nenhum produto, todas as contas aparecem.
    expect(screen.getByRole("option", { name: "Produto Outra Conta" })).toBeInTheDocument();
    add("p1");
    await offer("p1", "OF-1");
    expect(screen.queryByRole("option", { name: "Produto Um" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Produto Outra Conta" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Produto Dois" })).toBeInTheDocument();
  });

  it("exige ao menos um produto e ao menos uma oferta em cada produto", async () => {
    render(<ViewFormModal products={PRODUCTS} folders={[]} onSaved={jest.fn()} onCancel={() => {}} />);
    fireEvent.change(screen.getByTestId("view-form-name"), { target: { value: "X" } });
    fireEvent.click(screen.getByTestId("view-form-save"));
    expect(screen.getByTestId("view-form-error")).toHaveTextContent("ao menos um produto");
    add("p1");
    await offer("p1", "OF-1");
    fireEvent.click(screen.getByTestId("view-form-save"));
    expect(screen.getByTestId("view-form-error")).toHaveTextContent("ao menos uma oferta em Produto Um");
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("código manual por produto: trim, aceita sem venda conhecida, recusa duplicado e vazio", async () => {
    render(<ViewFormModal products={PRODUCTS} folders={[]} onSaved={jest.fn()} onCancel={() => {}} />);
    add("p1");
    await offer("p1", "OF-1");

    fireEvent.click(screen.getByTestId("view-form-manual-add-p1"));
    expect(screen.getByTestId("view-form-offer-message-p1")).toHaveTextContent("Informe um código");

    fireEvent.change(screen.getByTestId("view-form-manual-input-p1"), { target: { value: "  ZZ9  " } });
    fireEvent.click(screen.getByTestId("view-form-manual-add-p1"));
    expect(screen.getByTestId("view-form-offer-p1-ZZ9")).toBeChecked();

    fireEvent.change(screen.getByTestId("view-form-manual-input-p1"), { target: { value: "ZZ9" } });
    fireEvent.click(screen.getByTestId("view-form-manual-add-p1"));
    expect(screen.getByTestId("view-form-offer-message-p1")).toHaveTextContent("já está na lista");
  });

  it("busca filtra a lista do produto por nome ou código", async () => {
    render(<ViewFormModal products={PRODUCTS} folders={[]} onSaved={jest.fn()} onCancel={() => {}} />);
    add("p1");
    await offer("p1", "OF-1");
    fireEvent.change(screen.getByTestId("view-form-offer-search-p1"), { target: { value: "dois" } });
    expect(screen.queryByTestId("view-form-offer-p1-OF-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("view-form-offer-p1-OF-2")).toBeInTheDocument();
  });

  it("bloco recolhe e expande, mostrando N ofertas selecionadas no cabeçalho", async () => {
    render(<ViewFormModal products={PRODUCTS} folders={[]} onSaved={jest.fn()} onCancel={() => {}} />);
    add("p1");
    fireEvent.click(await offer("p1", "OF-1"));
    expect(screen.getByTestId("view-form-product-count-p1")).toHaveTextContent("1 oferta selecionada");
    fireEvent.click(screen.getByTestId("view-form-product-toggle-p1"));
    expect(screen.queryByTestId("view-form-offer-p1-OF-1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("view-form-product-toggle-p1"));
    expect(screen.getByTestId("view-form-offer-p1-OF-1")).toBeChecked();
  });

  it("período com uma data só ou invertido é recusado", async () => {
    render(<ViewFormModal products={PRODUCTS} folders={[]} onSaved={jest.fn()} onCancel={() => {}} />);
    fireEvent.change(screen.getByTestId("view-form-name"), { target: { value: "X" } });
    add("p1");
    fireEvent.click(await offer("p1", "OF-1"));
    fireEvent.change(screen.getByTestId("view-form-start"), { target: { value: "2026-08-10" } });
    fireEvent.click(screen.getByTestId("view-form-save"));
    expect(screen.getByTestId("view-form-error")).toHaveTextContent("duas datas");
    fireEvent.change(screen.getByTestId("view-form-end"), { target: { value: "2026-08-01" } });
    fireEvent.click(screen.getByTestId("view-form-save"));
    expect(screen.getByTestId("view-form-error")).toHaveTextContent("anterior");
  });
});

describe("ViewFormModal — editar", () => {
  const TWO: VendasViewRecord = {
    ...EXISTING,
    products: [
      { product_id: "p1", offer_codes: ["OF-1", "OF-2"] },
      { product_id: "p2", offer_codes: ["OF-2"] },
    ],
  };

  it("produtos são editáveis: sem trava nem o texto antigo; primeiro bloco aberto, demais fechados", async () => {
    render(<ViewFormModal products={PRODUCTS} folders={[]} editTarget={TWO} onSaved={jest.fn()} onCancel={() => {}} />);
    expect(screen.queryByTestId("view-form-product-locked")).not.toBeInTheDocument();
    expect(screen.queryByText(/pertence a ele/)).not.toBeInTheDocument();
    expect(await offer("p1", "OF-1")).toBeChecked();
    expect(screen.queryByTestId("view-form-offer-p2-OF-2")).not.toBeInTheDocument();
    expect(screen.getByTestId("view-form-product-remove-p2")).toBeEnabled();
  });

  it("bloqueia remover a última oferta de um produto, com a mensagem do PRD", async () => {
    render(<ViewFormModal products={PRODUCTS} folders={[]} editTarget={EXISTING} onSaved={jest.fn()} onCancel={() => {}} />);
    const box = await offer("p1", "OF-1");
    fireEvent.click(box);
    expect(box).toBeChecked();
    expect(screen.getByTestId("view-form-offer-message-p1")).toHaveTextContent(
      "Uma visualização precisa de pelo menos uma oferta; para descartar, exclua a visualização."
    );
  });

  it("bloqueia remover o último produto com mensagem clara", async () => {
    render(<ViewFormModal products={PRODUCTS} folders={[]} editTarget={EXISTING} onSaved={jest.fn()} onCancel={() => {}} />);
    fireEvent.click(screen.getByTestId("view-form-product-remove-p1"));
    expect(screen.getByTestId("view-form-product-message")).toHaveTextContent("pelo menos um produto");
    expect(screen.getByTestId("view-form-product-block-p1")).toBeInTheDocument();
  });

  it("adiciona e remove produto; PATCH manda a lista completa sem product_id/offer_codes soltos", async () => {
    const onSaved = jest.fn();
    render(<ViewFormModal products={PRODUCTS} folders={[]} editTarget={EXISTING} onSaved={onSaved} onCancel={() => {}} />);
    add("p2");
    fireEvent.click(await offer("p2", "OF-2"));
    fireEvent.click(screen.getByTestId("view-form-product-remove-p1"));
    expect(screen.queryByTestId("view-form-product-block-p1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("view-form-save"));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.anything(), "edited"));
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.url).toBe("/api/vendas/views/v1");
    expect(patch.body).toEqual({
      name: "Visão 1",
      folder_id: null,
      products: [{ product_id: "p2", offer_codes: ["OF-2"] }],
      view_start_date: null,
      view_end_date: null,
    });
    expect(patch.body).not.toHaveProperty("product_id");
    expect(patch.body).not.toHaveProperty("offer_codes");
  });

  it("remover e readicionar um produto não vaza ofertas do anterior", async () => {
    render(<ViewFormModal products={PRODUCTS} folders={[]} editTarget={TWO} onSaved={jest.fn()} onCancel={() => {}} />);
    await offer("p1", "OF-1");
    fireEvent.click(screen.getByTestId("view-form-product-remove-p1"));
    add("p1");
    expect(await offer("p1", "OF-1")).not.toBeChecked();
    expect(screen.getByTestId("view-form-product-count-p2")).toHaveTextContent("1 oferta selecionada");
  });

  it("remover um bloco não passa busca/estado dele para o bloco seguinte", async () => {
    render(<ViewFormModal products={PRODUCTS} folders={[]} editTarget={TWO} onSaved={jest.fn()} onCancel={() => {}} />);
    await offer("p1", "OF-1");
    fireEvent.click(screen.getByTestId("view-form-product-toggle-p2"));
    await offer("p2", "OF-2");
    fireEvent.change(screen.getByTestId("view-form-offer-search-p1"), { target: { value: "dois" } });
    fireEvent.click(screen.getByTestId("view-form-product-remove-p1"));
    expect(screen.getByTestId("view-form-offer-search-p2")).toHaveValue("");
  });

  it("oferta salva que a Hotmart não lista continua visível (código manual)", async () => {
    render(
      <ViewFormModal
        products={PRODUCTS}
        folders={[]}
        editTarget={{ ...EXISTING, products: [{ product_id: "p1", offer_codes: ["OF-1", "SO-MANUAL"] }] }}
        onSaved={jest.fn()}
        onCancel={() => {}}
      />
    );
    expect(await offer("p1", "SO-MANUAL")).toBeChecked();
  });

  it("falha ao carregar ofertas não apaga as selecionadas", async () => {
    (global.fetch as jest.Mock).mockImplementation(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    render(<ViewFormModal products={PRODUCTS} folders={[]} editTarget={EXISTING} onSaved={jest.fn()} onCancel={() => {}} />);
    expect(await screen.findByTestId("view-form-offers-error-p1")).toBeInTheDocument();
    expect(screen.getByTestId("view-form-offer-p1-OF-1")).toBeChecked();
  });
});
