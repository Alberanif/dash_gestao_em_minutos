/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CycleFormModal } from "../cycle-form-modal";
import type { HotmartProductOption, CycleWithProducts } from "../types";

const PRODUCTS: HotmartProductOption[] = [
  { product_id: "4567890", product_name: "Mentoria Ultimates", account_id: "acc-1" },
  { product_id: "1234567", product_name: "Curso Avançado", account_id: "acc-1" },
  { product_id: "9999999", product_name: "Produto Outra Conta", account_id: "acc-2" },
];

function renderCreate(products: HotmartProductOption[] = PRODUCTS) {
  return render(<CycleFormModal products={products} onSave={jest.fn()} onCancel={jest.fn()} />);
}

function makeCycle(overrides: Partial<CycleWithProducts> = {}): CycleWithProducts {
  return {
    id: "c1",
    name: "Ciclo Julho",
    account_id: "acc-1",
    products: [{ product_id: "4567890", product_name: "Mentoria Ultimates" }],
    goal_percent: 60,
    status: "ativo",
    counts_new_buyers: true,
    purchases_only: false,
    refresh_started_at: null,
    last_refresh_at: null,
    created_by: "user-1",
    created_at: "2026-07-19T00:00:00Z",
    updated_at: "2026-07-19T00:00:00Z",
    ...overrides,
  };
}

function renderEdit(editTarget: CycleWithProducts) {
  return render(
    <CycleFormModal products={PRODUCTS} editTarget={editTarget} onSave={jest.fn()} onCancel={jest.fn()} />
  );
}

afterEach(() => jest.restoreAllMocks());

describe("CycleFormModal — busca de produto", () => {
  it("sem busca, lista todos os produtos com nome e ID", () => {
    renderCreate();
    expect(screen.getByTestId("cycle-form-product-option-4567890")).toHaveTextContent("Mentoria Ultimates");
    expect(screen.getByTestId("cycle-form-product-option-4567890")).toHaveTextContent("4567890");
    expect(screen.getByTestId("cycle-form-product-option-1234567")).toBeInTheDocument();
  });

  it("filtra por nome (case-insensitive)", () => {
    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-product-search"), { target: { value: "mentoria" } });
    expect(screen.getByTestId("cycle-form-product-option-4567890")).toBeInTheDocument();
    expect(screen.queryByTestId("cycle-form-product-option-1234567")).not.toBeInTheDocument();
  });

  it("filtra por ID", () => {
    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-product-search"), { target: { value: "1234" } });
    expect(screen.getByTestId("cycle-form-product-option-1234567")).toBeInTheDocument();
    expect(screen.queryByTestId("cycle-form-product-option-4567890")).not.toBeInTheDocument();
  });

  it("clique numa linha seleciona o produto (aria-pressed)", () => {
    renderCreate();
    const option = screen.getByTestId("cycle-form-product-option-4567890");
    expect(option).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(option);
    expect(option).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("cycle-form-product-option-1234567")).toHaveAttribute("aria-pressed", "false");
  });

  it("sem seleção, salvar mostra 'Selecione ao menos um produto.' e não faz POST", () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof global.fetch;
    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Ciclo Julho" } });
    fireEvent.click(screen.getByTestId("cycle-form-save"));
    expect(screen.getByText("Selecione ao menos um produto.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falha de rede no salvar mostra erro em vez de falhar em silêncio", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    global.fetch = fetchMock as unknown as typeof global.fetch;
    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Ciclo Julho" } });
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));
    expect(await screen.findByText("Falha de rede ao salvar o ciclo.")).toBeInTheDocument();
    expect(screen.getByTestId("cycle-form-save")).not.toBeDisabled();
  });

  it("resposta 2xx sem cycle no corpo mostra erro genérico em vez de quebrar", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error("empty body")),
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;
    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Ciclo Julho" } });
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));
    expect(await screen.findByText("Erro ao salvar ciclo.")).toBeInTheDocument();
  });

  it("mostra o produto selecionado mesmo quando a busca o filtra da lista", () => {
    renderCreate();
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.change(screen.getByTestId("cycle-form-product-search"), { target: { value: "curso" } });
    expect(screen.queryByTestId("cycle-form-product-option-4567890")).not.toBeInTheDocument();
    const selected = screen.getByTestId("cycle-form-product-selected");
    expect(selected).toHaveTextContent("Mentoria Ultimates");
    // O resumo de seleção múltipla mostra a contagem, não mais o ID —
    // formato do card mudou de "Selecionado: <nome> (id)" para
    // "Selecionados: <nomes> (N)".
    expect(selected).toHaveTextContent("(1)");
  });
});

describe("CycleFormModal — Apenas Compras", () => {
  it("modo criação mostra o interruptor 'Apenas Compras' desligado por padrão, com meta visível", () => {
    renderCreate();
    const toggle = screen.getByTestId("cycle-form-purchases-only");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("cycle-form-goal")).toBeInTheDocument();
  });

  it("ligar 'Apenas Compras' esconde o campo de meta", () => {
    renderCreate();
    fireEvent.click(screen.getByTestId("cycle-form-purchases-only"));
    expect(screen.getByTestId("cycle-form-purchases-only")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByTestId("cycle-form-goal")).not.toBeInTheDocument();
  });

  it("criar com 'Apenas Compras' ligado envia purchasesOnly: true no POST", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cycle: makeCycle({ purchases_only: true }) }),
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Compras Julho" } });
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-purchases-only"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    await screen.findByTestId("cycle-form-save");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.purchasesOnly).toBe(true);
  });

  it("modo edição de ciclo purchases_only mostra o modo somente-leitura, sem interruptor e sem meta", () => {
    renderEdit(makeCycle({ purchases_only: true, goal_percent: null }));
    expect(screen.getByTestId("cycle-form-purchases-only-readonly")).toBeInTheDocument();
    expect(screen.queryByTestId("cycle-form-purchases-only")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cycle-form-goal")).not.toBeInTheDocument();
  });

  it("modo edição de ciclo normal não mostra badge de compras e mantém a meta", () => {
    renderEdit(makeCycle({ purchases_only: false }));
    expect(screen.queryByTestId("cycle-form-purchases-only-readonly")).not.toBeInTheDocument();
    expect(screen.getByTestId("cycle-form-goal")).toBeInTheDocument();
  });
});

describe("CycleFormModal — estados vazios", () => {
  it("sem produtos cadastrados, mostra 'Nenhum produto disponível'", () => {
    renderCreate([]);
    expect(screen.getByText("Nenhum produto disponível")).toBeInTheDocument();
    expect(screen.queryByTestId("cycle-form-product-search")).not.toBeInTheDocument();
  });

  it("busca sem resultado mostra 'Nenhum produto encontrado.'", () => {
    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-product-search"), { target: { value: "zzz" } });
    expect(screen.getByText("Nenhum produto encontrado.")).toBeInTheDocument();
  });
});

// Exclusão definitiva: zona de perigo recolhida + confirmação por digitação do
// nome. O ponto de todos estes testes é que nenhum caminho de clique repetido
// chegue ao DELETE — só a digitação exata do nome persistido destrava.
describe("CycleFormModal — excluir ciclo", () => {
  function renderEditWithDelete(
    cycle: CycleWithProducts = makeCycle(),
    onDelete: jest.Mock = jest.fn()
  ) {
    render(
      <CycleFormModal
        products={PRODUCTS}
        editTarget={cycle}
        onSave={jest.fn()}
        onCancel={jest.fn()}
        onDelete={onDelete}
      />
    );
    return onDelete;
  }

  function mockFetch(response: { ok: boolean; status: number; body?: object }) {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: response.ok,
      status: response.status,
      json: async () => response.body ?? {},
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;
    return fetchMock;
  }

  it("modo criação não oferece exclusão", () => {
    renderCreate();
    expect(screen.queryByTestId("cycle-form-delete-open")).not.toBeInTheDocument();
  });

  it("sem onDelete, o modo edição não oferece exclusão", () => {
    renderEdit(makeCycle());
    expect(screen.queryByTestId("cycle-form-delete-open")).not.toBeInTheDocument();
  });

  it("zona de perigo vem recolhida: sem campo nem botão de excluir visíveis", () => {
    renderEditWithDelete();
    expect(screen.getByTestId("cycle-form-delete-open")).toBeInTheDocument();
    expect(screen.queryByTestId("cycle-form-delete-confirm-input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cycle-form-delete-confirm")).not.toBeInTheDocument();
  });

  it("abrir a zona de perigo revela aviso, campo e botão desabilitado", () => {
    renderEditWithDelete();
    fireEvent.click(screen.getByTestId("cycle-form-delete-open"));

    expect(screen.getByTestId("cycle-form-delete-warning")).toBeInTheDocument();
    expect(screen.getByTestId("cycle-form-delete-confirm-input")).toBeInTheDocument();
    expect(screen.getByTestId("cycle-form-delete-confirm")).toBeDisabled();
  });

  it("nome errado mantém o botão desabilitado e não chama a API", () => {
    const fetchMock = mockFetch({ ok: true, status: 200 });
    renderEditWithDelete();
    fireEvent.click(screen.getByTestId("cycle-form-delete-open"));
    fireEvent.change(screen.getByTestId("cycle-form-delete-confirm-input"), {
      target: { value: "Ciclo Junho" },
    });

    const confirm = screen.getByTestId("cycle-form-delete-confirm");
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("nome parcial não destrava (exige igualdade exata, não prefixo)", () => {
    renderEditWithDelete();
    fireEvent.click(screen.getByTestId("cycle-form-delete-open"));
    fireEvent.change(screen.getByTestId("cycle-form-delete-confirm-input"), {
      target: { value: "Ciclo" },
    });
    expect(screen.getByTestId("cycle-form-delete-confirm")).toBeDisabled();
  });

  it("nome com caixa diferente não destrava", () => {
    renderEditWithDelete();
    fireEvent.click(screen.getByTestId("cycle-form-delete-open"));
    fireEvent.change(screen.getByTestId("cycle-form-delete-confirm-input"), {
      target: { value: "ciclo julho" },
    });
    expect(screen.getByTestId("cycle-form-delete-confirm")).toBeDisabled();
  });

  // A confirmação confere contra o nome PERSISTIDO. Se conferisse contra o campo
  // Nome do formulário, bastaria digitar o mesmo texto nos dois para destravar.
  it("editar o campo Nome não muda o texto exigido na confirmação", () => {
    const fetchMock = mockFetch({ ok: true, status: 200 });
    renderEditWithDelete();
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Outro Nome" } });
    fireEvent.click(screen.getByTestId("cycle-form-delete-open"));
    fireEvent.change(screen.getByTestId("cycle-form-delete-confirm-input"), {
      target: { value: "Outro Nome" },
    });

    expect(screen.getByTestId("cycle-form-delete-confirm")).toBeDisabled();
    fireEvent.click(screen.getByTestId("cycle-form-delete-confirm"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("nome exato dispara DELETE na rota do ciclo e propaga o id excluído", async () => {
    const fetchMock = mockFetch({ ok: true, status: 200, body: { deleted: "c1" } });
    const onDelete = renderEditWithDelete();

    fireEvent.click(screen.getByTestId("cycle-form-delete-open"));
    fireEvent.change(screen.getByTestId("cycle-form-delete-confirm-input"), {
      target: { value: "Ciclo Julho" },
    });
    fireEvent.click(screen.getByTestId("cycle-form-delete-confirm"));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("c1"));
    expect(fetchMock).toHaveBeenCalledWith("/api/ultimates/cycles/c1", { method: "DELETE" });
  });

  it("espaços em volta do nome digitado são tolerados", async () => {
    mockFetch({ ok: true, status: 200 });
    const onDelete = renderEditWithDelete();

    fireEvent.click(screen.getByTestId("cycle-form-delete-open"));
    fireEvent.change(screen.getByTestId("cycle-form-delete-confirm-input"), {
      target: { value: "  Ciclo Julho  " },
    });
    fireEvent.click(screen.getByTestId("cycle-form-delete-confirm"));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("c1"));
  });

  // 404 = alguém já excluiu. O objetivo do gestor foi atingido; travar a tela
  // num erro só deixaria um fantasma na frente dele.
  it("404 é tratado como sucesso", async () => {
    mockFetch({ ok: false, status: 404, body: { error: "Ciclo não encontrado" } });
    const onDelete = renderEditWithDelete();

    fireEvent.click(screen.getByTestId("cycle-form-delete-open"));
    fireEvent.change(screen.getByTestId("cycle-form-delete-confirm-input"), {
      target: { value: "Ciclo Julho" },
    });
    fireEvent.click(screen.getByTestId("cycle-form-delete-confirm"));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("c1"));
    expect(screen.queryByTestId("cycle-form-delete-error")).not.toBeInTheDocument();
  });

  it("erro de servidor mostra a mensagem e NÃO propaga a exclusão", async () => {
    mockFetch({ ok: false, status: 500, body: { error: "boom" } });
    const onDelete = renderEditWithDelete();

    fireEvent.click(screen.getByTestId("cycle-form-delete-open"));
    fireEvent.change(screen.getByTestId("cycle-form-delete-confirm-input"), {
      target: { value: "Ciclo Julho" },
    });
    fireEvent.click(screen.getByTestId("cycle-form-delete-confirm"));

    expect(await screen.findByTestId("cycle-form-delete-error")).toHaveTextContent("boom");
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByTestId("cycle-form-delete-confirm-input")).toBeInTheDocument();
  });

  it("falha de rede mostra mensagem e NÃO propaga a exclusão", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as unknown as typeof global.fetch;
    const onDelete = renderEditWithDelete();

    fireEvent.click(screen.getByTestId("cycle-form-delete-open"));
    fireEvent.change(screen.getByTestId("cycle-form-delete-confirm-input"), {
      target: { value: "Ciclo Julho" },
    });
    fireEvent.click(screen.getByTestId("cycle-form-delete-confirm"));

    expect(await screen.findByTestId("cycle-form-delete-error")).toHaveTextContent(
      "Falha de rede ao excluir o ciclo."
    );
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("Voltar recolhe a zona de perigo e limpa o texto digitado", () => {
    renderEditWithDelete();
    fireEvent.click(screen.getByTestId("cycle-form-delete-open"));
    fireEvent.change(screen.getByTestId("cycle-form-delete-confirm-input"), {
      target: { value: "Ciclo Julho" },
    });
    fireEvent.click(screen.getByTestId("cycle-form-delete-cancel"));

    expect(screen.queryByTestId("cycle-form-delete-confirm-input")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("cycle-form-delete-open"));
    expect(screen.getByTestId("cycle-form-delete-confirm-input")).toHaveValue("");
    expect(screen.getByTestId("cycle-form-delete-confirm")).toBeDisabled();
  });
});

describe("CycleFormModal — seleção múltipla", () => {
  it("clicar em dois produtos mantém os dois selecionados", () => {
    renderCreate();
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-product-option-1234567"));
    expect(screen.getByTestId("cycle-form-product-option-4567890")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("cycle-form-product-option-1234567")).toHaveAttribute("aria-pressed", "true");
  });

  it("clicar de novo no mesmo produto o desmarca", () => {
    renderCreate();
    const option = screen.getByTestId("cycle-form-product-option-4567890");
    fireEvent.click(option);
    fireEvent.click(option);
    expect(option).toHaveAttribute("aria-pressed", "false");
  });

  it("após a 1ª seleção, produto de outra conta fica desabilitado", () => {
    renderCreate();
    expect(screen.getByTestId("cycle-form-product-option-9999999")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    expect(screen.getByTestId("cycle-form-product-option-9999999")).toBeDisabled();
    expect(screen.getByTestId("cycle-form-product-option-1234567")).not.toBeDisabled();
  });

  it("esvaziar a seleção destrava as demais contas", () => {
    renderCreate();
    const first = screen.getByTestId("cycle-form-product-option-4567890");
    fireEvent.click(first);
    fireEvent.click(first);
    expect(screen.getByTestId("cycle-form-product-option-9999999")).not.toBeDisabled();
  });

  it("envia productIds com todos os selecionados e monta products no onSave", async () => {
    const onSave = jest.fn();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cycle: { id: "c9", name: "Ciclo Julho" } }),
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    render(<CycleFormModal products={PRODUCTS} onSave={onSave} onCancel={jest.fn()} />);
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Ciclo Julho" } });
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-product-option-1234567"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    await screen.findByText("Salvar");

    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.productIds).toEqual(["4567890", "1234567"]);
    // 2º argumento null: criação não troca conjunto de produtos de ciclo
    // nenhum, então não há contagem de troca para reportar.
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "c9",
        products: [
          { product_id: "4567890", product_name: "Mentoria Ultimates" },
          { product_id: "1234567", product_name: "Curso Avançado" },
        ],
      }),
      null
    );
  });
});

// Edição do conjunto de produtos (migration 062). O que estes testes protegem
// não é a feature, é o custo dela: a RPC de troca APAGA linha de roster, então
// mandá-la sem necessidade, ou sem o gestor ter lido o que sai, é o estrago.
describe("CycleFormModal — editar produtos do ciclo", () => {
  function okResponse(products: unknown = null) {
    return jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cycle: makeCycle(), products }),
    });
  }

  it("edição abre com os produtos atuais do ciclo já selecionados", () => {
    renderEdit(makeCycle());

    expect(screen.getByTestId("cycle-form-product-option-4567890")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTestId("cycle-form-product-option-1234567")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("salvar sem mexer nos produtos NÃO manda productIds", async () => {
    const fetchMock = okResponse();
    global.fetch = fetchMock as unknown as typeof global.fetch;

    renderEdit(makeCycle());
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.productIds).toBeUndefined();
  });

  it("adicionar produto manda o conjunto completo, sem pedir confirmação", async () => {
    const fetchMock = okResponse({
      products_added: 1,
      products_removed: 0,
      buyers_removed: 0,
      buyers_materialized: 7,
    });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    renderEdit(makeCycle());
    fireEvent.click(screen.getByTestId("cycle-form-product-option-1234567"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.productIds).toEqual(["4567890", "1234567"]);
  });

  it("remover produto exige segundo clique e NOMEIA o que sai", async () => {
    const fetchMock = okResponse();
    global.fetch = fetchMock as unknown as typeof global.fetch;

    renderEdit(makeCycle());
    // Desmarca o único produto e marca outro — o primeiro sai do ciclo.
    fireEvent.click(screen.getByTestId("cycle-form-product-option-1234567"));
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    const aviso = screen.getByTestId("cycle-form-confirm-remove-products");
    expect(aviso).toHaveTextContent("Mentoria Ultimates");
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("cycle-form-save"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.productIds).toEqual(["1234567"]);
  });

  it("mexer na seleção depois de confirmar derruba a confirmação", async () => {
    const fetchMock = okResponse();
    global.fetch = fetchMock as unknown as typeof global.fetch;

    renderEdit(makeCycle());
    fireEvent.click(screen.getByTestId("cycle-form-product-option-1234567"));
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));
    expect(screen.getByTestId("cycle-form-confirm-remove-products")).toBeInTheDocument();

    // Readiciona o produto que sairia: não há mais remoção, nem confirmação.
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    expect(
      screen.queryByTestId("cycle-form-confirm-remove-products")
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("cycle-form-save"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it("deixar o ciclo sem nenhum produto é recusado antes do PATCH", () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof global.fetch;

    renderEdit(makeCycle());
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    expect(screen.getByText("Selecione ao menos um produto.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ciclo encerrado mostra os produtos, sem controle de seleção", () => {
    renderEdit(makeCycle({ status: "encerrado" }));

    expect(screen.getByTestId("cycle-form-products-readonly")).toHaveTextContent(
      "Mentoria Ultimates"
    );
    expect(screen.queryByTestId("cycle-form-product-option-4567890")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cycle-form-product-search")).not.toBeInTheDocument();
  });

  it("repassa as contagens da troca para o pai", async () => {
    const counts = {
      products_added: 1,
      products_removed: 1,
      buyers_removed: 12,
      buyers_materialized: 4,
    };
    const fetchMock = okResponse(counts);
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const onSave = jest.fn();
    render(
      <CycleFormModal
        products={PRODUCTS}
        editTarget={makeCycle()}
        onSave={onSave}
        onCancel={jest.fn()}
      />
    );
    fireEvent.click(screen.getByTestId("cycle-form-product-option-1234567"));
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith(expect.any(Object), counts);
  });
});
