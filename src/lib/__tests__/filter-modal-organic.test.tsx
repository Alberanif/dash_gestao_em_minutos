/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FilterModal } from "@/components/indicadores/filter-modal";
import type { FilterRecord } from "@/types/indicadores";

const BASE: FilterRecord = {
  id: "f-1",
  account_id: "acc-1",
  name: "Evento",
  hotmart_products: [{ product_id: "1", product_name: "Curso Captura" }],
  debriefing_products: [],
  meta_ads_terms: [],
  captacao_leads_eventos: [],
  status: "ativo",
  is_organic: false,
} as unknown as FilterRecord;

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST" || init?.method === "PUT") {
      return { ok: true, json: async () => ({ ...BASE }) };
    }
    return { ok: true, json: async () => [] };
  });
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
});

function saveCalls() {
  return fetchMock.mock.calls.filter(([, init]) => init?.method === "POST" || init?.method === "PUT");
}

function open(editTarget: FilterRecord | null) {
  return render(
    <FilterModal accountId="acc-1" editTarget={editTarget} onSave={jest.fn()} onCancel={jest.fn()} />
  );
}

describe("FilterModal — switch Captação orgânica", () => {
  it("existe ao criar (desligado) e reflete o valor salvo ao editar", () => {
    const { unmount } = open(null);
    expect(screen.getByTestId("organic-switch").getAttribute("aria-checked")).toBe("false");
    unmount();
    open({ ...BASE, is_organic: true });
    expect(screen.getByTestId("organic-switch").getAttribute("aria-checked")).toBe("true");
  });

  it("ligar oculta o campo de captura e desligar restaura os produtos de antes", () => {
    open(BASE);
    expect(screen.getByText("Produtos Hotmart (Captura)")).toBeTruthy();
    expect(screen.getByText("Curso Captura")).toBeTruthy();
    fireEvent.click(screen.getByTestId("organic-switch"));
    expect(screen.queryByText("Produtos Hotmart (Captura)")).toBeNull();
    expect(screen.queryByText("Curso Captura")).toBeNull();
    fireEvent.click(screen.getByTestId("organic-switch"));
    expect(screen.getByText("Curso Captura")).toBeTruthy();
  });

  it("organico so com produto Hotmart exibe erro e não salva", async () => {
    open({ ...BASE, is_organic: true });
    fireEvent.click(screen.getByText("Salvar"));
    await waitFor(() => expect(screen.getByText(/Captação orgânica exige/)).toBeTruthy());
    expect(saveCalls()).toHaveLength(0);
  });

  it("organico com evento de leads salva enviando is_organic e preservando hotmart_products", async () => {
    open({ ...BASE, is_organic: true, captacao_leads_eventos: ["Webinar"], meta_ads_terms: ["t"] });
    fireEvent.click(screen.getByText("Salvar"));
    await waitFor(() => expect(saveCalls()).toHaveLength(1));
    const [url, init] = saveCalls()[0];
    expect(url).toBe("/api/indicadores/filters/f-1");
    const body = JSON.parse(init.body);
    expect(body.is_organic).toBe(true);
    expect(body.hotmart_products).toEqual(BASE.hotmart_products);
  });

  it("organico com termo Meta Ads salva (POST envia is_organic)", async () => {
    open(null);
    fireEvent.change(screen.getByPlaceholderText("Ex: Produto Principal"), { target: { value: "Novo" } });
    fireEvent.click(screen.getByTestId("organic-switch"));
    fireEvent.change(screen.getByPlaceholderText("Ex: lançamento"), { target: { value: "termo" } });
    fireEvent.click(screen.getByText("Salvar"));
    // Aviso de fonte parcial (falta Leads) exige segundo clique; não cita Hotmart.
    await waitFor(() => expect(screen.getByText(/Clique em Salvar novamente/)).toBeTruthy());
    expect(screen.getByText(/Clique em Salvar novamente/).textContent).not.toContain("Hotmart");
    fireEvent.click(screen.getByText("Salvar"));
    await waitFor(() => expect(saveCalls().length).toBeGreaterThan(0));
    const [, init] = saveCalls()[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body).is_organic).toBe(true);
  });

  it("pago continua exigindo ao menos uma fonte e envia is_organic=false", async () => {
    open({ ...BASE, is_organic: false });
    fireEvent.click(screen.getByText("Salvar"));
    await waitFor(() => expect(screen.getByText(/Clique em Salvar novamente/)).toBeTruthy());
    fireEvent.click(screen.getByText("Salvar"));
    await waitFor(() => expect(saveCalls()).toHaveLength(1));
    expect(JSON.parse(saveCalls()[0][1].body).is_organic).toBe(false);
  });
});
