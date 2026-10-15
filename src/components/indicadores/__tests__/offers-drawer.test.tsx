/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FilterModal } from "../filter-modal";
import type { FilterRecord } from "@/types/indicadores";

const OFFERS = [
  { offer_code: "act1", offer_name: "Oferta Ativa", is_active: true },
  { offer_code: "ina1", offer_name: "Oferta Velha", is_active: false },
  { offer_code: "act2", offer_name: "Segunda Ativa", is_active: true },
];

let fetchMock: jest.Mock;
let offersFail = false;

function installFetch() {
  offersFail = false;
  fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith("/api/hotmart/offers")) {
      return offersFail ? { ok: false, json: async () => ({}) } : { ok: true, json: async () => OFFERS };
    }
    if (url.startsWith("/api/funnels/products")) return { ok: true, json: async () => [] };
    if (url.startsWith("/api/indicadores/leads/events")) return { ok: true, json: async () => [] };
    return { ok: true, json: async () => ({ id: "saved", init }) };
  });
  (global as unknown as { fetch: unknown }).fetch = fetchMock;
}

function filter(codes: string[]): FilterRecord {
  return {
    id: "f-1",
    account_id: "acc-1",
    name: "Filtro",
    hotmart_products: [{ product_id: "999", product_name: "Captura" }],
    meta_ads_terms: ["x"],
    captacao_leads_eventos: ["ev"],
    status: "ativo",
    status_changed_at: null,
    debriefing_products: [{ product_id: "111", product_name: "Produto A", offer_codes: codes }],
  } as FilterRecord;
}

function setup(codes: string[] = [], onCancel = jest.fn(), onSave = jest.fn()) {
  render(<FilterModal accountId="acc-1" editTarget={filter(codes)} onSave={onSave} onCancel={onCancel} />);
  return { onCancel, onSave };
}

async function openDrawer() {
  fireEvent.click(screen.getByTestId("offers-arrow-111"));
  return screen.findByTestId("offers-drawer");
}

function offerCalls() {
  return fetchMock.mock.calls.filter(([u]) => String(u).startsWith("/api/hotmart/offers"));
}

beforeEach(() => installFetch());

describe("OffersDrawer", () => {
  it("abre, marca, conclui: selo vira N ofertas e o PUT leva os códigos", async () => {
    const { onSave } = setup();
    await openDrawer();
    expect(offerCalls()[0][0]).toBe(
      "/api/hotmart/offers?product_id=111&include_inactive=true"
    );
    fireEvent.click(await screen.findByLabelText("Oferta Ativa"));
    fireEvent.click(screen.getByLabelText("Sem oferta"));
    fireEvent.click(screen.getByText("Concluir"));
    expect(screen.queryByTestId("offers-drawer")).toBeNull();
    expect(screen.getByTestId("debriefing-badge-111")).toHaveTextContent("2 ofertas");

    fireEvent.click(screen.getByText("Salvar"));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const put = fetchMock.mock.calls.find(([, i]) => i && (i as RequestInit).method === "PUT")!;
    const body = JSON.parse((put[1] as RequestInit).body as string);
    expect(body.debriefing_products[0].offer_codes).toEqual(["act1", "Sem Oferta"]);
  });

  it("lista Sem oferta no topo e inativas ao final com selo", async () => {
    setup();
    await openDrawer();
    await screen.findByLabelText("Oferta Ativa");
    const rows = screen.getAllByTestId(/^offer-row-/).map((r) => r.getAttribute("data-testid"));
    expect(rows).toEqual(["offer-row-Sem Oferta", "offer-row-act1", "offer-row-act2", "offer-row-ina1"]);
    expect(screen.getByTestId("offer-row-ina1")).toHaveTextContent("inativa");
    expect(screen.getByTestId("offer-row-act1")).not.toHaveTextContent("inativa");
  });

  it("busca filtra por nome ou código", async () => {
    setup();
    await openDrawer();
    await screen.findByLabelText("Oferta Ativa");
    fireEvent.change(screen.getByPlaceholderText(/Buscar oferta/), { target: { value: "ina1" } });
    expect(screen.queryByLabelText("Oferta Ativa")).toBeNull();
    expect(screen.getByLabelText("Oferta Velha")).toBeInTheDocument();
  });

  it("Limpar volta a Todas as ofertas", async () => {
    setup(["act1", "act2"]);
    expect(screen.getByTestId("debriefing-badge-111")).toHaveTextContent("2 ofertas");
    await openDrawer();
    await screen.findByLabelText("Oferta Ativa");
    fireEvent.click(screen.getByText("Limpar"));
    fireEvent.click(screen.getByText("Concluir"));
    expect(screen.getByTestId("debriefing-badge-111")).toHaveTextContent("Todas as ofertas");
  });

  it("Esc com drawer aberto fecha só o drawer; sem drawer fecha o modal", async () => {
    const { onCancel } = setup();
    await openDrawer();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("offers-drawer")).toBeNull();
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("erro de carga mostra retry, mantém a seleção e o retry recupera", async () => {
    offersFail = true;
    setup(["orfao1"]);
    await openDrawer();
    const retry = await screen.findByText("Tentar novamente");
    expect(screen.getByLabelText("orfao1")).toBeChecked();
    fireEvent.click(screen.getByText("Concluir"));
    expect(screen.getByTestId("debriefing-badge-111")).toHaveTextContent("1 oferta");
    expect(screen.getByText("Salvar")).not.toBeDisabled();

    await openDrawer();
    offersFail = false;
    fireEvent.click(await screen.findByText("Tentar novamente"));
    expect(await screen.findByLabelText("Oferta Ativa")).toBeInTheDocument();
    expect(retry).toBeDefined();
  });

  it("código órfão aparece marcado e pode ser desmarcado", async () => {
    setup(["act1", "removida"]);
    await openDrawer();
    await screen.findByLabelText("Oferta Ativa");
    const orphan = screen.getByLabelText("removida");
    expect(orphan).toBeChecked();
    fireEvent.click(orphan);
    expect(screen.queryByLabelText("removida")).toBeNull();
    fireEvent.click(screen.getByText("Concluir"));
    expect(screen.getByTestId("debriefing-badge-111")).toHaveTextContent("1 oferta");
  });

  it("reabrir o drawer usa o cache (uma única requisição por produto)", async () => {
    setup();
    await openDrawer();
    await screen.findByLabelText("Oferta Ativa");
    fireEvent.click(screen.getByText("Concluir"));
    await openDrawer();
    await screen.findByLabelText("Oferta Ativa");
    expect(offerCalls()).toHaveLength(1);
  });
});
