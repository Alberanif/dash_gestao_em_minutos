/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ViewFormModal } from "../view-form-modal";
import type { VendasViewRecord } from "@/types/vendas";

const PRODUCTS = [
  { product_id: "p1", product_name: "Produto Um", account_id: "acc-1" },
  { product_id: "p2", product_name: "Produto Dois", account_id: "acc-1" },
];

const EXISTING: VendasViewRecord = {
  id: "v1",
  name: "Visão 1",
  account_id: "acc-1",
  product_id: "p1",
  offer_codes: ["OF-1"],
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

describe("ViewFormModal — criar", () => {
  it("lista ofertas do produto escolhido e cria com POST sem campos do modelo antigo", async () => {
    const onSaved = jest.fn();
    render(<ViewFormModal products={PRODUCTS} folders={[]} onSaved={onSaved} onCancel={() => {}} />);

    fireEvent.change(screen.getByTestId("view-form-name"), { target: { value: "  Minha visão  " } });
    fireEvent.change(screen.getByTestId("view-form-product"), { target: { value: "p1" } });
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

  it("exige ao menos uma oferta", async () => {
    render(<ViewFormModal products={PRODUCTS} folders={[]} onSaved={jest.fn()} onCancel={() => {}} />);
    fireEvent.change(screen.getByTestId("view-form-name"), { target: { value: "X" } });
    fireEvent.change(screen.getByTestId("view-form-product"), { target: { value: "p1" } });
    await screen.findByTestId("view-form-offer-OF-1");
    fireEvent.click(screen.getByTestId("view-form-save"));
    expect(screen.getByTestId("view-form-error")).toHaveTextContent("ao menos uma oferta");
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("código manual: trim, aceita sem venda conhecida, recusa duplicado e vazio", async () => {
    render(<ViewFormModal products={PRODUCTS} folders={[]} onSaved={jest.fn()} onCancel={() => {}} />);
    fireEvent.change(screen.getByTestId("view-form-product"), { target: { value: "p1" } });
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

  it("busca filtra a lista por nome ou código", async () => {
    render(<ViewFormModal products={PRODUCTS} folders={[]} onSaved={jest.fn()} onCancel={() => {}} />);
    fireEvent.change(screen.getByTestId("view-form-product"), { target: { value: "p1" } });
    await screen.findByTestId("view-form-offer-OF-1");
    fireEvent.change(screen.getByTestId("view-form-offer-search"), { target: { value: "dois" } });
    expect(screen.queryByTestId("view-form-offer-OF-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("view-form-offer-OF-2")).toBeInTheDocument();
  });

  it("período com uma data só ou invertido é recusado", async () => {
    render(<ViewFormModal products={PRODUCTS} folders={[]} onSaved={jest.fn()} onCancel={() => {}} />);
    fireEvent.change(screen.getByTestId("view-form-name"), { target: { value: "X" } });
    fireEvent.change(screen.getByTestId("view-form-product"), { target: { value: "p1" } });
    await screen.findByTestId("view-form-offer-OF-1");
    fireEvent.click(screen.getByTestId("view-form-offer-OF-1"));
    fireEvent.change(screen.getByTestId("view-form-start"), { target: { value: "2026-08-10" } });
    fireEvent.click(screen.getByTestId("view-form-save"));
    expect(screen.getByTestId("view-form-error")).toHaveTextContent("duas datas");
    fireEvent.change(screen.getByTestId("view-form-end"), { target: { value: "2026-08-01" } });
    fireEvent.click(screen.getByTestId("view-form-save"));
    expect(screen.getByTestId("view-form-error")).toHaveTextContent("anterior");
  });
});

describe("ViewFormModal — editar", () => {
  it("produto desabilitado com explicação", async () => {
    render(<ViewFormModal products={PRODUCTS} folders={[]} editTarget={EXISTING} onSaved={jest.fn()} onCancel={() => {}} />);
    expect(screen.getByTestId("view-form-product")).toBeDisabled();
    expect(screen.getByTestId("view-form-product-locked")).toHaveTextContent("não pode ser alterado");
    await screen.findByTestId("view-form-offer-OF-1");
  });

  it("bloqueia remover a última oferta, com a mensagem do PRD", async () => {
    render(<ViewFormModal products={PRODUCTS} folders={[]} editTarget={EXISTING} onSaved={jest.fn()} onCancel={() => {}} />);
    const box = await screen.findByTestId("view-form-offer-OF-1");
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(box).toBeChecked();
    expect(screen.getByTestId("view-form-offer-message")).toHaveTextContent(
      "Uma visualização precisa de pelo menos uma oferta; para descartar, exclua a visualização."
    );
  });

  it("com 2 ofertas dá para remover uma; PATCH não envia product_id", async () => {
    const onSaved = jest.fn();
    render(
      <ViewFormModal
        products={PRODUCTS}
        folders={[]}
        editTarget={{ ...EXISTING, offer_codes: ["OF-1", "OF-2"] }}
        onSaved={onSaved}
        onCancel={() => {}}
      />
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

  it("oferta salva que a Hotmart não lista continua visível (código manual)", async () => {
    render(
      <ViewFormModal products={PRODUCTS} folders={[]} editTarget={{ ...EXISTING, offer_codes: ["OF-1", "SO-MANUAL"] }} onSaved={jest.fn()} onCancel={() => {}} />
    );
    expect(await screen.findByTestId("view-form-offer-SO-MANUAL")).toBeChecked();
  });
});
