/** @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { IndicadoresDashboard } from "../indicadores-dashboard";
import type { FilterRecord } from "@/types/indicadores";

jest.mock("@/components/indicadores/trend-charts", () => ({
  ChartSkeleton: () => null,
  MetaAdsInvestimentoLeadsChart: () => null,
  MetaAdsCplChart: () => null,
  HotmartVendasChart: () => null,
  LeadsCaptacoesChart: () => null,
}));

// Substitui o modal pesado: "Salvar (stub)" devolve um evento novo (criar) ou
// o mesmo evento renomeado (editar), como o modal real faria via onSave.
const NEW_ID = "99999999-8888-4777-8666-555555555555";
jest.mock("@/components/indicadores/filter-modal", () => ({
  FilterModal: ({
    editTarget,
    onSave,
  }: {
    editTarget: FilterRecord | null;
    onSave: (f: FilterRecord) => void;
  }) => (
    <button
      onClick={() =>
        onSave(
          editTarget
            ? { ...editTarget, name: `${editTarget.name} renomeado` }
            : { ...(globalThis as unknown as { __base: FilterRecord }).__base, id: NEW_ID, name: "Evento Novo" },
        )
      }
    >
      Salvar (stub)
    </button>
  ),
}));

const replace = jest.fn();
const push = jest.fn();
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ replace, push }),
}));

const LS_FILTER_ID = "indicadores_active_filter_id";
const ID_A = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const ID_B = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const ID_GONE = "11111111-2222-4333-8444-555555555555";

function makeFilter(id: string, name: string): FilterRecord {
  return {
    id,
    account_id: "acc-1",
    name,
    hotmart_products: [{ product_id: "111", product_name: "Ingresso" }],
    meta_ads_terms: ["PC"],
    captacao_leads_eventos: ["evento-a"],
    status: "ativo",
    status_changed_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function jsonOk(body: unknown): Promise<Response> {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

let requests: string[] = [];
function installFetch(filters: FilterRecord[]) {
  requests = [];
  (globalThis as unknown as { __base: FilterRecord }).__base = filters[0];
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);
    if (url.startsWith("/api/accounts")) return jsonOk([{ id: "acc-1" }]);
    if (url.startsWith("/api/indicadores/filters")) return jsonOk(filters);
    if (url.startsWith("/api/indicadores/leads")) return jsonOk({ total: 0, by_event: [], by_source: [] });
    if (url.startsWith("/api/indicadores/daily")) return jsonOk([]);
    if (url.startsWith("/api/indicadores/conversion-sources")) return jsonOk([]);
    return jsonOk(null);
  }) as unknown as typeof fetch;
}

const dailyHits = () => requests.filter((u) => u.startsWith("/api/indicadores/daily"));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  replace.mockClear();
  push.mockClear();
  window.history.replaceState(null, "", "/");
});

// Abre o dropdown (botão com o nome do evento ativo) e devolve o item da lista.
async function openDropdown(activeName: string) {
  const trigger = (await screen.findAllByText(activeName)).find((el) => el.closest("button"))!;
  fireEvent.click(trigger.closest("button")!);
}

describe("/indicadores sem ID: restaura do localStorage com replace", () => {
  it("evento salvo: replace para /indicadores/<id> preservando ?view=", async () => {
    localStorage.setItem(LS_FILTER_ID, ID_B);
    window.history.replaceState(null, "", "/indicadores?view=planilha");
    installFetch([makeFilter(ID_A, "Evento A"), makeFilter(ID_B, "Evento B")]);
    render(<IndicadoresDashboard />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/indicadores/${ID_B}?view=planilha`));
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("sem ?view=, replace para a URL limpa do evento", async () => {
    localStorage.setItem(LS_FILTER_ID, ID_A);
    window.history.replaceState(null, "", "/indicadores");
    installFetch([makeFilter(ID_A, "Evento A")]);
    render(<IndicadoresDashboard />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/indicadores/${ID_A}`));
  });

  it("sem evento salvo: tela vazia, sem redirect", async () => {
    installFetch([makeFilter(ID_A, "Evento A")]);
    render(<IndicadoresDashboard />);

    await waitFor(() => expect(requests.some((u) => u.startsWith("/api/indicadores/filters"))).toBe(true));
    await screen.findByText("Filtros");
    expect(replace).not.toHaveBeenCalled();
    expect(dailyHits()).toEqual([]);
  });

  it("localStorage apontando para evento excluído: limpa e NÃO redireciona (sem loop)", async () => {
    localStorage.setItem(LS_FILTER_ID, ID_GONE);
    installFetch([makeFilter(ID_A, "Evento A")]);
    render(<IndicadoresDashboard />);

    await waitFor(() => expect(localStorage.getItem(LS_FILTER_ID)).toBeNull());
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("dropdown e ciclo de vida do evento", () => {
  it("trocar de evento faz push para a URL dele, preservando ?view=", async () => {
    window.history.replaceState(null, "", `/indicadores/${ID_A}?view=planilha`);
    installFetch([makeFilter(ID_A, "Evento A"), makeFilter(ID_B, "Evento B")]);
    render(<IndicadoresDashboard eventId={ID_A} />);

    await openDropdown("Evento A");
    fireEvent.click(await screen.findByText("Evento B"));

    expect(push).toHaveBeenCalledWith(`/indicadores/${ID_B}?view=planilha`);
    expect(localStorage.getItem(LS_FILTER_ID)).toBe(ID_B);
    expect(replace).not.toHaveBeenCalled();
  });

  it("escolher o evento que já está ativo não empilha histórico", async () => {
    installFetch([makeFilter(ID_A, "Evento A"), makeFilter(ID_B, "Evento B")]);
    render(<IndicadoresDashboard eventId={ID_A} />);

    await openDropdown("Evento A");
    const items = await screen.findAllByText("Evento A");
    fireEvent.click(items[items.length - 1]);

    expect(push).not.toHaveBeenCalled();
  });

  it("criar evento ativa e vai para a URL do novo", async () => {
    window.history.replaceState(null, "", `/indicadores/${ID_A}`);
    installFetch([makeFilter(ID_A, "Evento A")]);
    render(<IndicadoresDashboard eventId={ID_A} />);

    await openDropdown("Evento A");
    fireEvent.click(await screen.findByText("+ Novo filtro"));
    fireEvent.click(await screen.findByText("Salvar (stub)"));

    expect(push).toHaveBeenCalledWith(`/indicadores/${NEW_ID}`);
    expect(localStorage.getItem(LS_FILTER_ID)).toBe(NEW_ID);
  });

  it("editar (renomear) o evento ativo não muda a URL", async () => {
    window.history.replaceState(null, "", `/indicadores/${ID_A}?view=planilha`);
    installFetch([makeFilter(ID_A, "Evento A")]);
    render(<IndicadoresDashboard eventId={ID_A} />);

    await openDropdown("Evento A");
    fireEvent.click(await screen.findByTitle("Editar"));
    fireEvent.click(await screen.findByText("Salvar (stub)"));

    await waitFor(() => expect(screen.getAllByText("Evento A renomeado").length).toBeGreaterThan(0));
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(localStorage.getItem(LS_FILTER_ID)).toBe(ID_A);
  });

  it("excluir o evento ativo vai para /indicadores e limpa o localStorage", async () => {
    window.history.replaceState(null, "", `/indicadores/${ID_A}`);
    installFetch([makeFilter(ID_A, "Evento A"), makeFilter(ID_B, "Evento B")]);
    render(<IndicadoresDashboard eventId={ID_A} />);

    await openDropdown("Evento A");
    fireEvent.click((await screen.findAllByTitle("Deletar"))[0]);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/indicadores"));
    expect(localStorage.getItem(LS_FILTER_ID)).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("excluir um evento que não é o ativo não navega", async () => {
    window.history.replaceState(null, "", `/indicadores/${ID_A}`);
    installFetch([makeFilter(ID_A, "Evento A"), makeFilter(ID_B, "Evento B")]);
    render(<IndicadoresDashboard eventId={ID_A} />);

    await openDropdown("Evento A");
    fireEvent.click((await screen.findAllByTitle("Deletar"))[1]);

    await waitFor(() => expect(screen.queryByText("Evento B")).toBeNull());
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(localStorage.getItem(LS_FILTER_ID)).toBe(ID_A);
  });
});

describe("resolvedEventIdRef: resolve uma vez por ID da URL", () => {
  it("mudar `filters` (criar/editar) não puxa o evento ativo de volta para o da URL", async () => {
    window.history.replaceState(null, "", `/indicadores/${ID_A}`);
    installFetch([makeFilter(ID_A, "Evento A"), makeFilter(ID_B, "Evento B")]);
    render(<IndicadoresDashboard eventId={ID_A} />);

    // Muda de evento (a URL do teste não muda porque o router é mock) e depois edita.
    await openDropdown("Evento A");
    fireEvent.click(await screen.findByText("Evento B"));
    await waitFor(() => expect(localStorage.getItem(LS_FILTER_ID)).toBe(ID_B));

    await openDropdown("Evento B");
    fireEvent.click((await screen.findAllByTitle("Editar"))[1]);
    fireEvent.click(await screen.findByText("Salvar (stub)"));

    await waitFor(() => expect(screen.getAllByText("Evento B renomeado").length).toBeGreaterThan(0));
    expect(localStorage.getItem(LS_FILTER_ID)).toBe(ID_B);
    expect(screen.queryByText("Evento A")).toBeNull();
  });

  it("mudança de ID na URL (voltar do navegador) resolve o novo ID uma vez, sem redirect", async () => {
    installFetch([makeFilter(ID_A, "Evento A"), makeFilter(ID_B, "Evento B")]);
    const { rerender } = render(<IndicadoresDashboard eventId={ID_A} />);
    await waitFor(() => expect(localStorage.getItem(LS_FILTER_ID)).toBe(ID_A));

    rerender(<IndicadoresDashboard eventId={ID_B} />);
    await waitFor(() => expect(localStorage.getItem(LS_FILTER_ID)).toBe(ID_B));
    expect(screen.getAllByText("Evento B").length).toBeGreaterThan(0);

    rerender(<IndicadoresDashboard eventId={ID_A} />);
    await waitFor(() => expect(localStorage.getItem(LS_FILTER_ID)).toBe(ID_A));
    expect(screen.getAllByText("Evento A").length).toBeGreaterThan(0);
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("re-render com o mesmo ID não refaz a resolução", async () => {
    installFetch([makeFilter(ID_A, "Evento A"), makeFilter(ID_B, "Evento B")]);
    const { rerender } = render(<IndicadoresDashboard eventId={ID_A} />);
    await waitFor(() => expect(localStorage.getItem(LS_FILTER_ID)).toBe(ID_A));

    await openDropdown("Evento A");
    fireEvent.click(await screen.findByText("Evento B"));
    expect(localStorage.getItem(LS_FILTER_ID)).toBe(ID_B);

    rerender(<IndicadoresDashboard eventId={ID_A} />);
    // Mesmo ID já resolvido: a URL "velha" não sobrescreve a escolha do usuário.
    expect(localStorage.getItem(LS_FILTER_ID)).toBe(ID_B);
  });
});
