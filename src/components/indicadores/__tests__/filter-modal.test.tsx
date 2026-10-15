/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FilterModal, offersBadgeLabel } from "../filter-modal";
import type { FilterRecord } from "@/types/indicadores";

const PRODUCTS = [
  { product_id: "111", product_name: "Produto A" },
  { product_id: "222", product_name: "Produto B" },
  { product_id: "333", product_name: "Produto C" },
];

let fetchMock: jest.Mock;

function installFetch() {
  fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith("/api/funnels/products")) {
      return { ok: true, json: async () => PRODUCTS };
    }
    if (url.startsWith("/api/indicadores/leads/events")) {
      return { ok: true, json: async () => [] };
    }
    return { ok: true, json: async () => ({ id: "saved", init }) };
  });
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
}

function writeCalls() {
  return fetchMock.mock.calls.filter(([, init]) => init && (init as RequestInit).method);
}

function baseFilter(over: Partial<FilterRecord> = {}): FilterRecord {
  return {
    id: "f-1",
    account_id: "acc-1",
    name: "Filtro",
    hotmart_products: [{ product_id: "999", product_name: "Captura" }],
    meta_ads_terms: ["x"],
    captacao_leads_eventos: ["ev"],
    status: "ativo",
    status_changed_at: null,
    ...over,
  } as FilterRecord;
}

async function addDebriefingProduct(name: string) {
  const input = screen.getByPlaceholderText("Adicionar produto principal...");
  fireEvent.focus(input);
  const option = await screen.findByText(name, { selector: "span" }, { timeout: 2000 });
  fireEvent.mouseDown(option.closest("button")!);
}

beforeEach(() => installFetch());

describe("offersBadgeLabel", () => {
  it("vazio, singular e plural", () => {
    expect(offersBadgeLabel([])).toBe("Todas as ofertas");
    expect(offersBadgeLabel(["a"])).toBe("1 oferta");
    expect(offersBadgeLabel(["a", "b"])).toBe("2 ofertas");
  });
});

describe("FilterModal — produtos principais do Debriefing", () => {
  it("adiciona 2 produtos, remove um e envia debriefing_products no POST sem campos legados", async () => {
    const onSave = jest.fn();
    render(<FilterModal accountId="acc-1" onSave={onSave} onCancel={jest.fn()} />);
    fireEvent.change(screen.getByPlaceholderText("Ex: Produto Principal"), { target: { value: "Novo" } });
    fireEvent.change(screen.getAllByPlaceholderText("Ex: lançamento")[0], { target: { value: "t" } });

    await addDebriefingProduct("Produto A");
    await addDebriefingProduct("Produto B");
    await addDebriefingProduct("Produto C");
    fireEvent.click(screen.getByLabelText("Remover Produto B"));
    expect(screen.queryByTestId("debriefing-chip-222")).toBeNull();

    // partial warning (só Meta configurado) exige 2 cliques
    fireEvent.click(screen.getByText("Salvar"));
    fireEvent.click(screen.getByText("Salvar"));
    await waitFor(() => expect(onSave).toHaveBeenCalled());

    const [url, init] = writeCalls()[0];
    expect(url).toBe("/api/indicadores/filters");
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.debriefing_products).toEqual([
      { product_id: "111", product_name: "Produto A", offer_codes: [] },
      { product_id: "333", product_name: "Produto C", offer_codes: [] },
    ]);
    expect(body).not.toHaveProperty("main_hotmart_product");
    expect(body).not.toHaveProperty("debriefing_offer_codes");
  });

  it("produto já escolhido não aparece nas opções", async () => {
    render(<FilterModal accountId="acc-1" onSave={jest.fn()} onCancel={jest.fn()} />);
    await addDebriefingProduct("Produto A");
    const input = screen.getByPlaceholderText("Adicionar produto principal...");
    fireEvent.focus(input);
    await screen.findByText("Produto B", { selector: "span" });
    const optionButtons = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.startsWith("Produto A#"));
    expect(optionButtons).toHaveLength(0);
  });

  it("filtro legado mostra o produto e as ofertas salvas; PUT envia debriefing_products", async () => {
    const legacy = baseFilter({
      main_hotmart_product: { product_id: "111", product_name: "Produto A" },
      debriefing_offer_codes: ["o1", "o2"],
    });
    const onSave = jest.fn();
    render(<FilterModal accountId="acc-1" editTarget={legacy} onSave={onSave} onCancel={jest.fn()} />);
    expect(screen.getByTestId("debriefing-chip-111")).toHaveTextContent("Produto A (#111)");
    expect(screen.getByTestId("debriefing-badge-111")).toHaveTextContent("2 ofertas");

    await waitFor(() => expect(screen.getByText("Salvar")).not.toBeDisabled());
    fireEvent.click(screen.getByText("Salvar"));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const [url, init] = writeCalls()[0];
    expect(url).toBe("/api/indicadores/filters/f-1");
    expect((init as RequestInit).method).toBe("PUT");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.debriefing_products).toEqual([
      { product_id: "111", product_name: "Produto A", offer_codes: ["o1", "o2"] },
    ]);
    expect(body).not.toHaveProperty("main_hotmart_product");
    expect(body).not.toHaveProperty("debriefing_offer_codes");
  });

  it("selo: vazio = Todas as ofertas, 1 = singular", () => {
    const f = baseFilter({
      debriefing_products: [
        { product_id: "111", product_name: "Produto A", offer_codes: [] },
        { product_id: "222", product_name: "Produto B", offer_codes: ["o1"] },
      ],
    });
    render(<FilterModal accountId="acc-1" editTarget={f} onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByTestId("debriefing-badge-111")).toHaveTextContent("Todas as ofertas");
    expect(screen.getByTestId("debriefing-badge-222")).toHaveTextContent("1 oferta");
  });

  it("remover e readicionar produto recomeça com Todas as ofertas", async () => {
    const f = baseFilter({
      debriefing_products: [{ product_id: "111", product_name: "Produto A", offer_codes: ["o1"] }],
    });
    render(<FilterModal accountId="acc-1" editTarget={f} onSave={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByLabelText("Remover Produto A"));
    await addDebriefingProduct("Produto A");
    expect(screen.getByTestId("debriefing-badge-111")).toHaveTextContent("Todas as ofertas");
  });

  it("Cancelar não faz requisição de gravação", async () => {
    const onCancel = jest.fn();
    render(<FilterModal accountId="acc-1" onSave={jest.fn()} onCancel={onCancel} />);
    await addDebriefingProduct("Produto A");
    fireEvent.click(screen.getByText("Cancelar"));
    expect(onCancel).toHaveBeenCalled();
    expect(writeCalls()).toHaveLength(0);
  });
});
