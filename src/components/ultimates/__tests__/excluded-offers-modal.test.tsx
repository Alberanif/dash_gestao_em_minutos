/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ExcludedOffersModal } from "../excluded-offers-modal";

const EXCLUDED = [
  {
    id: "eo-1",
    offer_code: "OFERTA_TESTE",
    offer_name: "Oferta interna",
    note: "compras da equipe",
    excluded_by: "user-1",
    excluded_by_email: "gestor@ex.com",
    created_at: "2026-07-30T12:00:00Z",
  },
];

const OPTIONS = [
  { offer_code: "PRINCIPAL", offer_name: "Oferta principal", sales_count: 412, is_excluded: false },
  { offer_code: "OFERTA_TESTE", offer_name: "Oferta interna", sales_count: 3, is_excluded: true },
];

// Roteia por URL/método em vez de por ordem de chamada — o componente dispara
// as duas cargas em paralelo e a ordem não é garantida.
function installFetch({
  excluded = EXCLUDED,
  options = OPTIONS,
  writeStatus = 201,
  writeError = null as string | null,
}) {
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "GET" && url.includes("/excluded-offers")) {
      return { ok: true, status: 200, json: async () => ({ offers: excluded }) };
    }
    if (method === "GET" && url.includes("/offer-options")) {
      return { ok: true, status: 200, json: async () => ({ offers: options }) };
    }
    const ok = writeStatus < 400;
    return {
      ok,
      status: writeStatus,
      json: async () => (ok ? { offer: {} } : { error: writeError }),
    };
  });
  global.fetch = fetchMock as unknown as typeof global.fetch;
  return fetchMock;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("ExcludedOffersModal — leitura", () => {
  it("lista cada oferta excluída com nome, código, nota e autor", async () => {
    installFetch({});
    render(
      <ExcludedOffersModal cycleId="c1" canWrite onChanged={jest.fn()} onClose={jest.fn()} />
    );

    const row = await screen.findByTestId("ultimates-excluded-offer-OFERTA_TESTE");
    expect(row).toHaveTextContent("Oferta interna");
    expect(row).toHaveTextContent("OFERTA_TESTE");
    expect(row).toHaveTextContent("compras da equipe");
    expect(row).toHaveTextContent("gestor@ex.com");
  });

  it("mostra o estado vazio quando nenhuma oferta está excluída", async () => {
    installFetch({ excluded: [] });
    render(
      <ExcludedOffersModal cycleId="c1" canWrite onChanged={jest.fn()} onClose={jest.fn()} />
    );

    expect(await screen.findByTestId("ultimates-excluded-offers-empty")).toBeInTheDocument();
  });

  it("oferece no seletor apenas ofertas ainda não excluídas, com o número de vendas", async () => {
    installFetch({});
    render(
      <ExcludedOffersModal cycleId="c1" canWrite onChanged={jest.fn()} onClose={jest.fn()} />
    );

    const select = (await screen.findByTestId(
      "ultimates-excluded-offer-select"
    )) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);

    expect(values).toContain("PRINCIPAL");
    expect(values).not.toContain("OFERTA_TESTE");
    expect(select).toHaveTextContent("412");
  });
});

describe("ExcludedOffersModal — escrita", () => {
  it("envia código e nota ao excluir e avisa o pai", async () => {
    const fetchMock = installFetch({});
    const onChanged = jest.fn();
    render(
      <ExcludedOffersModal cycleId="c1" canWrite onChanged={onChanged} onClose={jest.fn()} />
    );

    await screen.findByTestId("ultimates-excluded-offer-select");
    fireEvent.change(screen.getByTestId("ultimates-excluded-offer-select"), {
      target: { value: "PRINCIPAL" },
    });
    fireEvent.change(screen.getByTestId("ultimates-excluded-offer-note"), {
      target: { value: "cupom de teste" },
    });
    fireEvent.click(screen.getByTestId("ultimates-excluded-offer-add-btn"));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post?.[0]).toBe("/api/ultimates/cycles/c1/excluded-offers");
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({
      offerCode: "PRINCIPAL",
      note: "cupom de teste",
    });
  });

  it("remove a oferta da lista e avisa o pai", async () => {
    const fetchMock = installFetch({ writeStatus: 204 });
    const onChanged = jest.fn();
    render(
      <ExcludedOffersModal cycleId="c1" canWrite onChanged={onChanged} onClose={jest.fn()} />
    );

    fireEvent.click(await screen.findByTestId("ultimates-excluded-offer-remove-OFERTA_TESTE"));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());

    const del = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(JSON.parse(del?.[1]?.body as string)).toEqual({ offerCode: "OFERTA_TESTE" });
  });

  it("mostra a mensagem do servidor quando a exclusão falha", async () => {
    installFetch({ writeStatus: 409, writeError: "Oferta já excluída neste ciclo" });
    render(
      <ExcludedOffersModal cycleId="c1" canWrite onChanged={jest.fn()} onClose={jest.fn()} />
    );

    await screen.findByTestId("ultimates-excluded-offer-select");
    fireEvent.change(screen.getByTestId("ultimates-excluded-offer-select"), {
      target: { value: "PRINCIPAL" },
    });
    fireEvent.click(screen.getByTestId("ultimates-excluded-offer-add-btn"));

    expect(await screen.findByTestId("ultimates-excluded-offers-error")).toHaveTextContent(
      "Oferta já excluída neste ciclo"
    );
  });

  it("não deixa excluir sem escolher uma oferta", async () => {
    installFetch({});
    render(
      <ExcludedOffersModal cycleId="c1" canWrite onChanged={jest.fn()} onClose={jest.fn()} />
    );

    await screen.findByTestId("ultimates-excluded-offer-select");
    expect(screen.getByTestId("ultimates-excluded-offer-add-btn")).toBeDisabled();
  });
});

describe("ExcludedOffersModal — analista", () => {
  it("vê a lista sem seletor nem remoção", async () => {
    installFetch({});
    render(
      <ExcludedOffersModal
        cycleId="c1"
        canWrite={false}
        onChanged={jest.fn()}
        onClose={jest.fn()}
      />
    );

    await screen.findByTestId("ultimates-excluded-offer-OFERTA_TESTE");
    expect(screen.queryByTestId("ultimates-excluded-offer-select")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("ultimates-excluded-offer-remove-OFERTA_TESTE")
    ).not.toBeInTheDocument();
  });
});
