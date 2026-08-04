/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CycleFormModal } from "../cycle-form-modal";
import type { HotmartProductOption, CycleWithProducts } from "../types";
import type { UltimatesOfferOption } from "@/types/ultimates";

const PRODUCTS: HotmartProductOption[] = [
  { product_id: "4567890", product_name: "Mentoria Ultimates", account_id: "acc-1" },
  { product_id: "1234567", product_name: "Curso Avançado", account_id: "acc-1" },
  { product_id: "9999999", product_name: "Produto Outra Conta", account_id: "acc-2" },
];

// Ofertas de cada produto, no formato de GET /api/ultimates/offer-options.
const OFFERS: Record<string, UltimatesOfferOption[]> = {
  "4567890": [
    { offer_code: "OF-A", offer_name: "Oferta Principal", product_id: "4567890", product_name: "Mentoria Ultimates", sales_count: 312 },
    { offer_code: "OF-B", offer_name: "Cortesia Equipe", product_id: "4567890", product_name: "Mentoria Ultimates", sales_count: 8 },
  ],
  "1234567": [
    { offer_code: "OF-C", offer_name: "Turma 2026", product_id: "1234567", product_name: "Curso Avançado", sales_count: 40 },
  ],
  "9999999": [
    { offer_code: "OF-D", offer_name: "Outra Conta", product_id: "9999999", product_name: "Produto Outra Conta", sales_count: 1 },
  ],
};

// Só o 4567890 tem venda SEM offer_code — é o único que ganha a linha fixa
// "(sem oferta)" na sanfona.
const OFFERLESS = [{ product_id: "4567890", sales_count: 3 }];

// Instala o fetch do teste. A rota de ofertas responde sempre (a sanfona a
// chama assim que um produto é selecionado, em todo teste); o resto delega
// para `rest`, que é o mock sobre o qual as asserções de salvar/excluir rodam.
function installFetch(rest: jest.Mock = jest.fn(), extraOffers: UltimatesOfferOption[] = []): jest.Mock {
  const fetchMock = jest.fn((url: string, init?: RequestInit) => {
    if (typeof url === "string" && url.includes("/offer-options")) {
      const ids = (new URLSearchParams(url.split("?")[1] ?? "").get("productIds") ?? "").split(",");
      return Promise.resolve({
        ok: true,
        json: async () => ({
          offers: [
            ...ids.flatMap((id) => OFFERS[id] ?? []),
            ...extraOffers.filter((o) => ids.includes(o.product_id)),
          ],
          offerless: OFFERLESS.filter((o) => ids.includes(o.product_id)),
        }),
      });
    }
    return rest(url, init);
  });
  global.fetch = fetchMock as unknown as typeof global.fetch;
  return rest;
}

// Marca o produto e a 1ª oferta dele — o par mínimo que destrava o salvar.
async function escolherProdutoEOferta(productId: string) {
  fireEvent.click(screen.getByTestId(`cycle-form-product-option-${productId}`));
  fireEvent.click(await screen.findByTestId(`cycle-form-offers-toggle-${productId}`));
  fireEvent.click(screen.getByTestId(`cycle-form-offer-${productId}-${OFFERS[productId][0].offer_code}`));
}

function renderCreate(products: HotmartProductOption[] = PRODUCTS) {
  return render(<CycleFormModal products={products} onSave={jest.fn()} onCancel={jest.fn()} />);
}

function makeCycle(overrides: Partial<CycleWithProducts> = {}): CycleWithProducts {
  return {
    id: "c1",
    name: "Ciclo Julho",
    account_id: "acc-1",
    // Ciclo já CONFIGURADO sob a 065: OF-A escolhida, OF-B vista e recusada,
    // "(sem oferta)" decidida. Sem as três listas completas, reabrir o modal e
    // salvar já contaria como mudança — é a decisão que o gestor tomou na tela
    // anterior, e ela é persistida junto.
    products: [
      {
        product_id: "4567890",
        product_name: "Mentoria Ultimates",
        offer_codes: ["OF-A"],
        rejected_offer_codes: ["OF-B"],
        include_offerless: false,
      },
    ],
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

beforeEach(() => {
  installFetch();
});

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
    const salvar = installFetch();
    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Ciclo Julho" } });
    fireEvent.click(screen.getByTestId("cycle-form-save"));
    expect(screen.getByText("Selecione ao menos um produto.")).toBeInTheDocument();
    expect(salvar).not.toHaveBeenCalled();
  });

  it("falha de rede no salvar mostra erro em vez de falhar em silêncio", async () => {
    installFetch(jest.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Ciclo Julho" } });
    await escolherProdutoEOferta("4567890");
    fireEvent.click(screen.getByTestId("cycle-form-save"));
    expect(await screen.findByText("Falha de rede ao salvar o ciclo.")).toBeInTheDocument();
    expect(screen.getByTestId("cycle-form-save")).not.toBeDisabled();
  });

  it("resposta 2xx sem cycle no corpo mostra erro genérico em vez de quebrar", async () => {
    installFetch(
      jest.fn().mockResolvedValue({ ok: true, json: () => Promise.reject(new Error("empty body")) })
    );
    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Ciclo Julho" } });
    await escolherProdutoEOferta("4567890");
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
    // O resumo virou LISTA (produto + ofertas dele), no lugar do texto corrido
    // "Selecionados: <nomes> (N)" que condensava tudo numa linha só.
    expect(selected).toHaveTextContent("1 produto no ciclo");
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
    const salvar = installFetch(
      jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ cycle: makeCycle({ purchases_only: true }) }),
      })
    );

    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Compras Julho" } });
    await escolherProdutoEOferta("4567890");
    fireEvent.click(screen.getByTestId("cycle-form-purchases-only"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    await waitFor(() => expect(salvar).toHaveBeenCalled());
    const body = JSON.parse(salvar.mock.calls[0][1].body);
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
    return installFetch(
      jest.fn().mockResolvedValue({
        ok: response.ok,
        status: response.status,
        json: async () => response.body ?? {},
      })
    );
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
    const escrever = mockFetch({ ok: true, status: 200 });
    renderEditWithDelete();
    fireEvent.click(screen.getByTestId("cycle-form-delete-open"));
    fireEvent.change(screen.getByTestId("cycle-form-delete-confirm-input"), {
      target: { value: "Ciclo Junho" },
    });

    const confirm = screen.getByTestId("cycle-form-delete-confirm");
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(escrever).not.toHaveBeenCalled();
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
    const escrever = mockFetch({ ok: true, status: 200 });
    renderEditWithDelete();
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Outro Nome" } });
    fireEvent.click(screen.getByTestId("cycle-form-delete-open"));
    fireEvent.change(screen.getByTestId("cycle-form-delete-confirm-input"), {
      target: { value: "Outro Nome" },
    });

    expect(screen.getByTestId("cycle-form-delete-confirm")).toBeDisabled();
    fireEvent.click(screen.getByTestId("cycle-form-delete-confirm"));
    expect(escrever).not.toHaveBeenCalled();
  });

  it("nome exato dispara DELETE na rota do ciclo e propaga o id excluído", async () => {
    const escrever = mockFetch({ ok: true, status: 200, body: { deleted: "c1" } });
    const onDelete = renderEditWithDelete();

    fireEvent.click(screen.getByTestId("cycle-form-delete-open"));
    fireEvent.change(screen.getByTestId("cycle-form-delete-confirm-input"), {
      target: { value: "Ciclo Julho" },
    });
    fireEvent.click(screen.getByTestId("cycle-form-delete-confirm"));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("c1"));
    expect(escrever).toHaveBeenCalledWith("/api/ultimates/cycles/c1", { method: "DELETE" });
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
    installFetch(jest.fn().mockRejectedValue(new Error("offline")));
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

  it("envia products com a decisão de cada selecionado e monta o ciclo no onSave", async () => {
    const onSave = jest.fn();
    const salvar = installFetch(
      jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ cycle: { id: "c9", name: "Ciclo Julho" } }),
      })
    );

    render(<CycleFormModal products={PRODUCTS} onSave={onSave} onCancel={jest.fn()} />);
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Ciclo Julho" } });
    await escolherProdutoEOferta("4567890");
    await escolherProdutoEOferta("1234567");
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    await waitFor(() => expect(salvar).toHaveBeenCalled());

    const sentBody = JSON.parse(salvar.mock.calls[0][1].body);
    // productIds morreu na 065: o corpo carrega a decisão inteira por produto.
    expect(sentBody.productIds).toBeUndefined();
    expect(sentBody.products).toEqual([
      {
        product_id: "4567890",
        offer_codes: ["OF-A"],
        // OF-B foi EXIBIDA e ficou desmarcada — é recusa, não desconhecimento.
        rejected_offer_codes: ["OF-B"],
        // A linha "(sem oferta)" existe para este produto e não foi marcada.
        include_offerless: false,
      },
      {
        product_id: "1234567",
        offer_codes: ["OF-C"],
        rejected_offer_codes: [],
        // Produto sem venda sem-oferta: a linha nem aparece, então não houve
        // decisão a registrar.
        include_offerless: null,
      },
    ]);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "c9",
        products: [
          expect.objectContaining({ product_id: "4567890", product_name: "Mentoria Ultimates", offer_codes: ["OF-A"] }),
          expect.objectContaining({ product_id: "1234567", product_name: "Curso Avançado", offer_codes: ["OF-C"] }),
        ],
      }),
      null
    );
  });
});

// Sanfona de ofertas (migration 065). O que estes testes protegem é a
// invariante que o dashboard inteiro depende: ciclo não salva com produto sem
// escolha, e o que a tela exibiu vira decisão registrada.
describe("CycleFormModal — sanfona de ofertas", () => {
  it("a sanfona só existe sob produto SELECIONADO, e vem recolhida", async () => {
    renderCreate();
    expect(screen.queryByTestId("cycle-form-offers-4567890")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));

    const toggle = await screen.findByTestId("cycle-form-offers-toggle-4567890");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // 2 ofertas + a linha "(sem oferta)" = 3.
    expect(toggle).toHaveTextContent("0 de 3 ofertas");
    expect(screen.queryByTestId("cycle-form-offer-4567890-OF-A")).not.toBeInTheDocument();
  });

  it("abrir lista as ofertas com a contagem de vendas e a linha '(sem oferta)'", async () => {
    renderCreate();
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(await screen.findByTestId("cycle-form-offers-toggle-4567890"));

    expect(screen.getByTestId("cycle-form-offer-4567890-OF-A")).toHaveTextContent("Oferta Principal");
    expect(screen.getByTestId("cycle-form-offer-4567890-OF-A")).toHaveTextContent("312");
    expect(screen.getByTestId("cycle-form-offerless-4567890")).toHaveTextContent("(sem oferta)");
    expect(screen.getByTestId("cycle-form-offerless-4567890")).toHaveTextContent("3");
  });

  it("produto sem venda sem-oferta NÃO ganha a linha '(sem oferta)'", async () => {
    renderCreate();
    fireEvent.click(screen.getByTestId("cycle-form-product-option-1234567"));
    fireEvent.click(await screen.findByTestId("cycle-form-offers-toggle-1234567"));

    expect(screen.queryByTestId("cycle-form-offerless-1234567")).not.toBeInTheDocument();
  });

  it("marcar oferta atualiza o contador do cabeçalho", async () => {
    renderCreate();
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(await screen.findByTestId("cycle-form-offers-toggle-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-offer-4567890-OF-A"));

    expect(screen.getByTestId("cycle-form-offers-toggle-4567890")).toHaveTextContent("1 de 3 ofertas");
    expect(screen.getByTestId("cycle-form-offer-4567890-OF-A")).toHaveAttribute("aria-pressed", "true");
  });

  it("produto selecionado sem escolha bloqueia o salvar e NOMEIA quem falta", async () => {
    const salvar = installFetch();
    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Ciclo Julho" } });
    await escolherProdutoEOferta("4567890");
    // O segundo produto entra sem nenhuma oferta marcada.
    fireEvent.click(screen.getByTestId("cycle-form-product-option-1234567"));
    await screen.findByTestId("cycle-form-offers-toggle-1234567");

    fireEvent.click(screen.getByTestId("cycle-form-save"));

    expect(
      screen.getByText("Selecione ao menos 1 oferta em: Curso Avançado.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("cycle-form-offers-error-1234567")).toBeInTheDocument();
    expect(salvar).not.toHaveBeenCalled();
  });

  // Decisão derivada do PRD 3.2: marcar SÓ "(sem oferta)" é uma escolha humana
  // explícita e configura o produto. Sem isso, produto cujas vendas não têm
  // offer_code seria impossível de acompanhar.
  it("marcar apenas '(sem oferta)' configura o produto", async () => {
    const salvar = installFetch(
      jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ cycle: makeCycle() }) })
    );
    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Ciclo Julho" } });
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(await screen.findByTestId("cycle-form-offers-toggle-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-offerless-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    await waitFor(() => expect(salvar).toHaveBeenCalled());
    const body = JSON.parse(salvar.mock.calls[0][1].body);
    expect(body.products[0]).toEqual({
      product_id: "4567890",
      offer_codes: [],
      rejected_offer_codes: ["OF-A", "OF-B"],
      include_offerless: true,
    });
  });

  // Um clique errado na lista de produtos não pode custar o trabalho de
  // escolher oferta por oferta.
  it("desmarcar e remarcar o produto devolve as ofertas já escolhidas", async () => {
    renderCreate();
    await escolherProdutoEOferta("4567890");
    expect(screen.getByTestId("cycle-form-offers-toggle-4567890")).toHaveTextContent("1 de 3");

    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    expect(screen.queryByTestId("cycle-form-offers-toggle-4567890")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    expect(await screen.findByTestId("cycle-form-offers-toggle-4567890")).toHaveTextContent("1 de 3");
  });

  it("edição pré-marca o estado vigente do ciclo", async () => {
    renderEdit(makeCycle());
    fireEvent.click(await screen.findByTestId("cycle-form-offers-toggle-4567890"));

    expect(screen.getByTestId("cycle-form-offer-4567890-OF-A")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("cycle-form-offer-4567890-OF-B")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("cycle-form-offerless-4567890")).toHaveAttribute("aria-pressed", "false");
  });

  it("falha ao carregar as ofertas é dita, com opção de tentar de novo", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as unknown as typeof global.fetch;
    renderCreate();
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));

    expect(await screen.findByTestId("cycle-form-offers-load-error-4567890")).toBeInTheDocument();

    installFetch();
    fireEvent.click(screen.getByTestId("cycle-form-offers-retry-4567890"));
    expect(await screen.findByTestId("cycle-form-offers-toggle-4567890")).toBeInTheDocument();
  });

  it("ciclo encerrado exibe as ofertas escolhidas, sem controle de marcação", async () => {
    renderEdit(makeCycle({ status: "encerrado" }));

    expect(await screen.findByTestId("cycle-form-offers-readonly")).toHaveTextContent("Oferta Principal");
    expect(
      screen.getByText("Ciclo encerrado — reative o ciclo para alterar os produtos e as ofertas.")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("cycle-form-offers-toggle-4567890")).not.toBeInTheDocument();
    // Nem checkbox nem ×: a configuração de um histórico fechado é exibida,
    // não operada.
    expect(screen.queryByTestId("cycle-form-selected-product-4567890")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("cycle-form-selected-offer-remove-4567890-OF-A")
    ).not.toBeInTheDocument();
  });
});

// Resumo da seleção: a lista de produtos com as ofertas escolhidas indentadas
// sob cada um. O que estes testes protegem é que ele seja OPERÁVEL e que a
// operação seja a MESMA da sanfona — um caminho de escrita próprio aqui
// poderia tirar a oferta sem registrá-la como recusa no submit, e a faixa de
// aviso do dashboard voltaria a apontá-la.
describe("CycleFormModal — resumo da seleção", () => {
  it("lista cada produto com as ofertas escolhidas dele logo abaixo", async () => {
    renderCreate();
    await escolherProdutoEOferta("4567890");
    await escolherProdutoEOferta("1234567");

    const resumo = screen.getByTestId("cycle-form-product-selected");
    expect(resumo).toHaveTextContent("2 produtos no ciclo");
    // A oferta aparece com nome e contagem de vendas, não como código cru.
    expect(screen.getByTestId("cycle-form-selected-offer-4567890-OF-A")).toHaveTextContent(
      "Oferta Principal"
    );
    expect(screen.getByTestId("cycle-form-selected-offer-4567890-OF-A")).toHaveTextContent("312");
    expect(screen.getByTestId("cycle-form-selected-offer-1234567-OF-C")).toHaveTextContent(
      "Turma 2026"
    );
    // Pareamento: a oferta do outro produto não vaza para este.
    expect(
      screen.queryByTestId("cycle-form-selected-offer-4567890-OF-C")
    ).not.toBeInTheDocument();
  });

  it("a checkbox do produto vem marcada e desmarcar tira o produto do ciclo", async () => {
    renderCreate();
    await escolherProdutoEOferta("4567890");

    const check = screen.getByTestId("cycle-form-selected-product-4567890");
    expect(check).toBeChecked();

    fireEvent.click(check);
    expect(screen.queryByTestId("cycle-form-selected-product-4567890")).not.toBeInTheDocument();
    expect(screen.getByTestId("cycle-form-product-option-4567890")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("o × tira só aquela oferta, e o produto continua no ciclo", async () => {
    renderCreate();
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(await screen.findByTestId("cycle-form-offers-toggle-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-offer-4567890-OF-A"));
    fireEvent.click(screen.getByTestId("cycle-form-offer-4567890-OF-B"));

    fireEvent.click(screen.getByTestId("cycle-form-selected-offer-remove-4567890-OF-A"));

    expect(screen.queryByTestId("cycle-form-selected-offer-4567890-OF-A")).not.toBeInTheDocument();
    expect(screen.getByTestId("cycle-form-selected-offer-4567890-OF-B")).toBeInTheDocument();
    expect(screen.getByTestId("cycle-form-selected-product-4567890")).toBeInTheDocument();
    // A sanfona é a mesma decisão, e tem de refletir na hora.
    expect(screen.getByTestId("cycle-form-offer-4567890-OF-A")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("o × da linha '(sem oferta)' desfaz a marcação dela, não de uma oferta", async () => {
    renderCreate();
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(await screen.findByTestId("cycle-form-offers-toggle-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-offer-4567890-OF-A"));
    fireEvent.click(screen.getByTestId("cycle-form-offerless-4567890"));

    expect(screen.getByTestId("cycle-form-selected-offer-4567890-offerless")).toHaveTextContent(
      "(sem oferta)"
    );
    fireEvent.click(screen.getByTestId("cycle-form-selected-offer-remove-4567890-offerless"));

    expect(
      screen.queryByTestId("cycle-form-selected-offer-4567890-offerless")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("cycle-form-selected-offer-4567890-OF-A")).toBeInTheDocument();
    expect(screen.getByTestId("cycle-form-offerless-4567890")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  // Tirar a última oferta pelo × deixa o produto no estado que trava o salvar.
  // Dizer isso na própria linha é o que evita a caça ao produto culpado.
  it("produto que fica sem oferta é nomeado como tal no resumo", async () => {
    renderCreate();
    await escolherProdutoEOferta("4567890");
    fireEvent.click(screen.getByTestId("cycle-form-selected-offer-remove-4567890-OF-A"));

    expect(screen.getByTestId("cycle-form-selected-empty-4567890")).toHaveTextContent(
      "Nenhuma oferta escolhida"
    );
  });

  // O × precisa registrar a saída como RECUSA, igual ao desmarcar na sanfona:
  // é o que impede a oferta de voltar a alertar como "nunca decidida".
  it("oferta tirada pelo × vira recusa registrada no salvar", async () => {
    const salvar = installFetch(
      jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ cycle: makeCycle() }) })
    );
    renderCreate();
    fireEvent.change(screen.getByTestId("cycle-form-name"), { target: { value: "Ciclo Julho" } });
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(await screen.findByTestId("cycle-form-offers-toggle-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-offer-4567890-OF-A"));
    fireEvent.click(screen.getByTestId("cycle-form-offer-4567890-OF-B"));
    fireEvent.click(screen.getByTestId("cycle-form-selected-offer-remove-4567890-OF-B"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    await waitFor(() => expect(salvar).toHaveBeenCalled());
    const body = JSON.parse(salvar.mock.calls[0][1].body);
    expect(body.products[0].offer_codes).toEqual(["OF-A"]);
    expect(body.products[0].rejected_offer_codes).toEqual(["OF-B"]);
  });

  // O resumo é a resposta a "o que este ciclo vai contar". Filtrá-lo junto com
  // a lista deixaria o gestor sem lugar nenhum para conferir o conjunto antes
  // de salvar.
  it("o resumo não é filtrado pelas buscas de produto nem de oferta", async () => {
    renderCreate();
    await escolherProdutoEOferta("4567890");

    fireEvent.change(screen.getByTestId("cycle-form-product-search"), { target: { value: "curso" } });
    expect(screen.getByTestId("cycle-form-selected-product-4567890")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("cycle-form-offer-search"), { target: { value: "zzz" } });
    expect(screen.getByTestId("cycle-form-selected-offer-4567890-OF-A")).toBeInTheDocument();
  });

  // Na edição o resumo tem de estar completo já no primeiro render: o ciclo
  // guarda os CÓDIGOS, e esperar a rede para mostrar qualquer coisa deixaria o
  // gestor olhando uma lista vazia de um ciclo configurado.
  it("na edição, o resumo aparece antes das ofertas carregarem — com o código no lugar do nome", () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof global.fetch;
    renderEdit(makeCycle());

    const linha = screen.getByTestId("cycle-form-selected-offer-4567890-OF-A");
    expect(linha).toHaveTextContent("OF-A");
    // Número NENHUM na linha: sem cache não há contagem, e exibir 0 afirmaria
    // que a oferta escolhida não vendeu — que é diferente de não saber ainda.
    expect(linha.textContent).not.toMatch(/\d/);
  });
});

// Busca de ofertas — a barra abaixo da de produtos. O que estes testes
// protegem é o recorte dela: ela varre APENAS os produtos já selecionados, que
// são os únicos cujas ofertas a tela carregou. Buscar nos demais devolveria
// "não achei" sobre uma lista que nunca foi lida.
describe("CycleFormModal — busca de ofertas", () => {
  async function selecionarECarregar(productId: string) {
    fireEvent.click(screen.getByTestId(`cycle-form-product-option-${productId}`));
    await screen.findByTestId(`cycle-form-offers-toggle-${productId}`);
  }

  function buscarOferta(termo: string) {
    fireEvent.change(screen.getByTestId("cycle-form-offer-search"), { target: { value: termo } });
  }

  it("a barra só existe depois que há produto selecionado", async () => {
    renderCreate();
    expect(screen.queryByTestId("cycle-form-offer-search")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    expect(await screen.findByTestId("cycle-form-offer-search")).toBeInTheDocument();
  });

  it("buscar abre a sanfona sozinha e deixa só a oferta que casa", async () => {
    renderCreate();
    await selecionarECarregar("4567890");
    buscarOferta("cortesia");

    expect(screen.getByTestId("cycle-form-offer-4567890-OF-B")).toHaveTextContent("Cortesia Equipe");
    expect(screen.queryByTestId("cycle-form-offer-4567890-OF-A")).not.toBeInTheDocument();
    // Sanfona aberta pela busca: o cabeçalho vira texto, sem botão de recolher.
    expect(screen.queryByTestId("cycle-form-offers-toggle-4567890")).not.toBeInTheDocument();
    // O contador continua sendo o do PRODUTO, não o do resultado da busca.
    expect(screen.getByTestId("cycle-form-offers-count-4567890")).toHaveTextContent("0 de 3 ofertas");
  });

  it("acha por código, não só por nome", async () => {
    renderCreate();
    await selecionarECarregar("4567890");
    buscarOferta("of-a");

    expect(screen.getByTestId("cycle-form-offer-4567890-OF-A")).toBeInTheDocument();
    expect(screen.queryByTestId("cycle-form-offer-4567890-OF-B")).not.toBeInTheDocument();
  });

  // O recorte pedido: a oferta OF-C existe, mas é de um produto que ninguém
  // selecionou — e cujas ofertas a tela nem carregou.
  it("não enxerga oferta de produto NÃO selecionado", async () => {
    renderCreate();
    await selecionarECarregar("4567890");
    buscarOferta("turma");

    expect(screen.queryByTestId("cycle-form-product-option-1234567")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cycle-form-product-option-4567890")).not.toBeInTheDocument();
    expect(screen.getByText("Nenhuma oferta corresponde à busca.")).toBeInTheDocument();
  });

  it("produto selecionado sem oferta correspondente sai da lista; o que tem, fica", async () => {
    renderCreate();
    await selecionarECarregar("4567890");
    await selecionarECarregar("1234567");
    buscarOferta("turma");

    expect(screen.getByTestId("cycle-form-product-option-1234567")).toBeInTheDocument();
    expect(screen.queryByTestId("cycle-form-product-option-4567890")).not.toBeInTheDocument();
  });

  // Mesma regra da sanfona antes da busca subir: esconder o que está contando
  // faria o contador do cabeçalho discordar da lista (PRD 3.5).
  it("oferta MARCADA não some do resultado, mesmo fora do termo", async () => {
    renderCreate();
    await escolherProdutoEOferta("4567890");
    buscarOferta("cortesia");

    expect(screen.getByTestId("cycle-form-offer-4567890-OF-A")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("cycle-form-offer-4567890-OF-B")).toBeInTheDocument();
  });

  it("a linha '(sem oferta)' é achável pelo termo — e some quando ele não a nomeia", async () => {
    renderCreate();
    await selecionarECarregar("4567890");

    buscarOferta("sem oferta");
    expect(screen.getByTestId("cycle-form-offerless-4567890")).toBeInTheDocument();
    expect(screen.queryByTestId("cycle-form-offer-4567890-OF-A")).not.toBeInTheDocument();

    buscarOferta("cortesia");
    expect(screen.queryByTestId("cycle-form-offerless-4567890")).not.toBeInTheDocument();
  });

  // Sem este guard a busca diria "não achei" sobre uma lista que ainda está a
  // caminho da rede.
  it("produto cujas ofertas ainda não chegaram não some da busca", async () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof global.fetch;
    renderCreate();
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    buscarOferta("zzz");

    expect(screen.getByTestId("cycle-form-product-option-4567890")).toBeInTheDocument();
    expect(screen.getByText("Carregando ofertas...")).toBeInTheDocument();
  });

  it("limpar a busca devolve a lista inteira e a sanfona recolhida", async () => {
    renderCreate();
    await selecionarECarregar("4567890");
    buscarOferta("cortesia");
    buscarOferta("");

    expect(screen.getByTestId("cycle-form-product-option-1234567")).toBeInTheDocument();
    expect(screen.getByTestId("cycle-form-offers-toggle-4567890")).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.queryByTestId("cycle-form-offer-4567890-OF-B")).not.toBeInTheDocument();
  });

  it("desmarcar o último produto limpa o termo junto com a barra", async () => {
    renderCreate();
    await selecionarECarregar("4567890");
    buscarOferta("cortesia");

    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    expect(screen.queryByTestId("cycle-form-offer-search")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    expect(await screen.findByTestId("cycle-form-offer-search")).toHaveValue("");
  });
});

// Edição do conjunto de produtos (migration 062) e das ofertas (065). O que
// estes testes protegem não é a feature, é o custo dela: a RPC de troca APAGA
// linha de roster, então mandá-la sem necessidade, ou sem o gestor ter lido o
// que sai, é o estrago.
describe("CycleFormModal — editar produtos e ofertas do ciclo", () => {
  function okResponse(products: unknown = null) {
    return installFetch(
      jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ cycle: makeCycle(), products }),
      })
    );
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

  it("salvar sem mexer em nada NÃO manda products", async () => {
    const salvar = okResponse();

    renderEdit(makeCycle());
    // Espera a sanfona carregar: é justamente depois da carga que um cálculo
    // errado de rejected_offer_codes inventaria uma mudança.
    await screen.findByTestId("cycle-form-offers-toggle-4567890");
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    await waitFor(() => expect(salvar).toHaveBeenCalled());
    const body = JSON.parse(salvar.mock.calls[0][1].body);
    expect(body.products).toBeUndefined();
  });

  // O caminho do "Revisar" do dashboard: a oferta nova é EXIBIDA na sanfona e,
  // deixada desmarcada, vira recusa registrada — é o que desliga a faixa de
  // aviso sem o gestor precisar clicar em nada além de Salvar.
  it("oferta nova não decidida faz o salvar mandar products, mesmo sem clique na sanfona", async () => {
    const salvar = installFetch(
      jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ cycle: makeCycle(), products: null }) }),
      [{ offer_code: "OF-NOVA", offer_name: "Cortesia Black", product_id: "4567890", product_name: "Mentoria Ultimates", sales_count: 9 }]
    );

    renderEdit(makeCycle());
    await screen.findByTestId("cycle-form-offers-toggle-4567890");
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    await waitFor(() => expect(salvar).toHaveBeenCalled());
    const body = JSON.parse(salvar.mock.calls[0][1].body);
    expect(body.products[0].rejected_offer_codes).toEqual(["OF-B", "OF-NOVA"]);
  });

  // O modal é aberto por ROTINA (renomear, mudar meta), e nada obriga o gestor a
  // esperar a sanfona. Se `rejected_offer_codes` saísse só do que a tela
  // carregou, salvar aqui mandaria a lista vazia — e a RPC, que apaga toda linha
  // ausente da seleção, apagaria as recusas já registradas. A cortesia recusada
  // voltaria a ser "nunca decidida" e a faixa de aviso do dashboard a apontaria
  // de novo, que é exatamente o ruído que a coluna `included` existe para matar.
  it("salvar ANTES das ofertas carregarem preserva as recusas já persistidas", async () => {
    const salvar = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cycle: makeCycle(), products: null }),
    });
    // A rota de ofertas fica pendurada: a sanfona nunca carrega neste teste.
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("/offer-options")) {
        return new Promise(() => {});
      }
      return salvar(url, init);
    }) as unknown as typeof global.fetch;

    // Muda o nome para haver o que salvar sem tocar em oferta nenhuma.
    renderEdit(makeCycle());
    fireEvent.change(screen.getByTestId("cycle-form-name"), {
      target: { value: "Ciclo Julho (revisado)" },
    });
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    await waitFor(() => expect(salvar).toHaveBeenCalled());
    const body = JSON.parse(salvar.mock.calls[0][1].body);
    // Ou o corpo não carrega products (nada mudou no conjunto), ou carrega com a
    // recusa intacta. O que não pode acontecer é mandar a lista vazia.
    if (body.products !== undefined) {
      expect(body.products[0].rejected_offer_codes).toEqual(["OF-B"]);
      expect(body.products[0].offer_codes).toEqual(["OF-A"]);
    }
  });

  it("adicionar produto manda o conjunto completo, sem pedir confirmação", async () => {
    const salvar = okResponse({
      products_added: 1,
      products_removed: 0,
      buyers_removed: 0,
      buyers_materialized: 7,
      offers_added: 1,
      offers_removed: 0,
    });

    renderEdit(makeCycle());
    await escolherProdutoEOferta("1234567");
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    await waitFor(() => expect(salvar).toHaveBeenCalled());
    const body = JSON.parse(salvar.mock.calls[0][1].body);
    expect(body.products.map((p: { product_id: string }) => p.product_id)).toEqual([
      "4567890",
      "1234567",
    ]);
  });

  it("remover produto exige segundo clique e NOMEIA o que sai", async () => {
    const salvar = okResponse();

    renderEdit(makeCycle());
    // Marca outro produto e desmarca o do ciclo — o primeiro sai.
    await escolherProdutoEOferta("1234567");
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    const aviso = screen.getByTestId("cycle-form-confirm-remove-products");
    expect(aviso).toHaveTextContent("Mentoria Ultimates");
    expect(salvar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("cycle-form-save"));
    await waitFor(() => expect(salvar).toHaveBeenCalled());
    const body = JSON.parse(salvar.mock.calls[0][1].body);
    expect(body.products.map((p: { product_id: string }) => p.product_id)).toEqual(["1234567"]);
  });

  // Desmarcar oferta encolhe o universo de vendas igual a remover produto:
  // quem só comprou por ela some do roster (PRD 3.5).
  it("desmarcar oferta exige segundo clique e NOMEIA a oferta que sai", async () => {
    const salvar = okResponse();

    renderEdit(makeCycle());
    fireEvent.click(await screen.findByTestId("cycle-form-offers-toggle-4567890"));
    // Marca a outra para o produto continuar configurado, e desmarca a vigente.
    fireEvent.click(screen.getByTestId("cycle-form-offer-4567890-OF-B"));
    fireEvent.click(screen.getByTestId("cycle-form-offer-4567890-OF-A"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    expect(screen.getByTestId("cycle-form-confirm-remove-offers")).toHaveTextContent(
      "Oferta Principal"
    );
    expect(salvar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("cycle-form-save"));
    await waitFor(() => expect(salvar).toHaveBeenCalled());
    const body = JSON.parse(salvar.mock.calls[0][1].body);
    expect(body.products[0].offer_codes).toEqual(["OF-B"]);
  });

  it("marcar oferta a mais NÃO pede confirmação — só entra venda", async () => {
    const salvar = okResponse();

    renderEdit(makeCycle());
    fireEvent.click(await screen.findByTestId("cycle-form-offers-toggle-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-offer-4567890-OF-B"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    expect(screen.queryByTestId("cycle-form-confirm-remove-products")).not.toBeInTheDocument();
    await waitFor(() => expect(salvar).toHaveBeenCalled());
  });

  it("mexer na seleção depois de confirmar derruba a confirmação", async () => {
    const salvar = okResponse();

    renderEdit(makeCycle());
    await escolherProdutoEOferta("1234567");
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));
    expect(screen.getByTestId("cycle-form-confirm-remove-products")).toBeInTheDocument();

    // Readiciona o produto que sairia: não há mais remoção, nem confirmação.
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    expect(
      screen.queryByTestId("cycle-form-confirm-remove-products")
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("cycle-form-save"));
    await waitFor(() => expect(salvar).toHaveBeenCalled());
  });

  // A confirmação vale para o conjunto de perdas que estava na tela quando o
  // gestor a leu. Mexer numa OFERTA depois de ler tem de derrubá-la igual.
  it("mexer na sanfona depois de confirmar derruba a confirmação", async () => {
    okResponse();

    renderEdit(makeCycle());
    fireEvent.click(await screen.findByTestId("cycle-form-offers-toggle-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-offer-4567890-OF-B"));
    fireEvent.click(screen.getByTestId("cycle-form-offer-4567890-OF-A"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));
    expect(screen.getByTestId("cycle-form-confirm-remove-products")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("cycle-form-offerless-4567890"));
    expect(screen.queryByTestId("cycle-form-confirm-remove-products")).not.toBeInTheDocument();
  });

  it("deixar o ciclo sem nenhum produto é recusado antes do PATCH", () => {
    const salvar = okResponse();

    renderEdit(makeCycle());
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    expect(screen.getByText("Selecione ao menos um produto.")).toBeInTheDocument();
    expect(salvar).not.toHaveBeenCalled();
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
      offers_added: 1,
      offers_removed: 1,
    };
    okResponse(counts);

    const onSave = jest.fn();
    render(
      <CycleFormModal
        products={PRODUCTS}
        editTarget={makeCycle()}
        onSave={onSave}
        onCancel={jest.fn()}
      />
    );
    await escolherProdutoEOferta("1234567");
    fireEvent.click(screen.getByTestId("cycle-form-product-option-4567890"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));
    fireEvent.click(screen.getByTestId("cycle-form-save"));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith(expect.any(Object), counts);
  });
});
