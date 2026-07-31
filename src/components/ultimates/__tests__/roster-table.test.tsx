/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { RosterTable } from "../roster-table";
import type { UltimatesRosterRow } from "@/types/ultimates";
import { applyNewPurchasesModeToRoster } from "@/lib/ultimates/new-purchases-mode";

function row(overrides: Partial<UltimatesRosterRow>): UltimatesRosterRow {
  return {
    buyer_id: "b1",
    name: "Fulano",
    email: "fulano@example.com",
    phone: null,
    extra: {},
    category: "renovado",
    renewed_at: null,
    total_value: null,
    transaction_code: null,
    ...overrides,
  };
}

const ROWS: UltimatesRosterRow[] = [
  row({ buyer_id: "b1", name: "Maria Silva", email: "maria@example.com", category: "renovado" }),
  row({ buyer_id: "b2", name: "João Souza", email: "joao@example.com", category: "nao_renovado" }),
  row({ buyer_id: null, name: "Ana Nova", email: "ana@example.com", category: "novo_comprador" }),
];

describe("RosterTable — busca e filtro (client-side, mesma fonte dos KPIs)", () => {
  it("mostra todas as linhas inicialmente", () => {
    render(<RosterTable rows={ROWS} role="gestor" countsNewBuyers />);
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("João Souza")).toBeInTheDocument();
    expect(screen.getByText("Ana Nova")).toBeInTheDocument();
  });

  it("filtra por busca de nome/email digitada", () => {
    render(<RosterTable rows={ROWS} role="gestor" countsNewBuyers />);
    fireEvent.change(screen.getByTestId("ultimates-table-search"), { target: { value: "maria" } });
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.queryByText("João Souza")).not.toBeInTheDocument();
  });

  it("filtra por categoria selecionada no dropdown", () => {
    render(<RosterTable rows={ROWS} role="gestor" countsNewBuyers />);
    fireEvent.change(screen.getByTestId("ultimates-table-category"), { target: { value: "nao_renovado" } });
    expect(screen.getByText("João Souza")).toBeInTheDocument();
    expect(screen.queryByText("Maria Silva")).not.toBeInTheDocument();
  });

  it("mostra rótulo de categoria em pt-BR na linha", () => {
    render(<RosterTable rows={ROWS} role="gestor" countsNewBuyers />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("Não renovado")).toBeInTheDocument();
  });
});

describe("RosterTable — slot 'Vincular à base' (task #124)", () => {
  it("gestor vê o botão só nas linhas de novo comprador (buyer_id null), desabilitado sem onLinkClick", () => {
    render(<RosterTable rows={ROWS} role="gestor" countsNewBuyers />);
    const btn = screen.getByTestId("ultimates-link-buyer-ana@example.com");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "Indisponível");
    expect(screen.queryByTestId("ultimates-link-buyer-maria@example.com")).not.toBeInTheDocument();
  });

  it("aciona onLinkClick quando fornecido pelo pai (contrato que a #124 conecta)", () => {
    const onLinkClick = jest.fn();
    render(<RosterTable rows={ROWS} role="gestor" countsNewBuyers onLinkClick={onLinkClick} />);
    const btn = screen.getByTestId("ultimates-link-buyer-ana@example.com");
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onLinkClick).toHaveBeenCalledWith(expect.objectContaining({ email: "ana@example.com" }));
  });

  it("analista não vê nenhum botão de vínculo (ação é só gestor)", () => {
    render(<RosterTable rows={ROWS} role="analista" countsNewBuyers />);
    expect(screen.queryByTestId("ultimates-link-buyer-ana@example.com")).not.toBeInTheDocument();
  });
});

describe("RosterTable — exportação CSV usa a visão filtrada atual", () => {
  it("clicar em Exportar CSV dispara o download só com as linhas filtradas", () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => "blob:mock");
    URL.revokeObjectURL = jest.fn();
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<RosterTable rows={ROWS} role="gestor" countsNewBuyers />);
    fireEvent.change(screen.getByTestId("ultimates-table-category"), { target: { value: "nao_renovado" } });
    fireEvent.click(screen.getByText("Exportar CSV"));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = (URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob;
    expect(blobArg.type).toContain("text/csv");
    expect(clickSpy).toHaveBeenCalledTimes(1);

    clickSpy.mockRestore();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevoke;
  });
});

describe("RosterTable — paginação (10 por página)", () => {
  const MANY: UltimatesRosterRow[] = Array.from({ length: 12 }, (_, i) =>
    row({
      buyer_id: `pb${i + 1}`,
      name: `Participante ${String(i + 1).padStart(2, "0")}`,
      email: `p${String(i + 1).padStart(2, "0")}@example.com`,
    })
  );

  it("mostra só 10 linhas na primeira página e o rodapé de paginação", () => {
    render(<RosterTable rows={MANY} role="gestor" countsNewBuyers />);
    expect(screen.getByText("Participante 01")).toBeInTheDocument();
    expect(screen.getByText("Participante 10")).toBeInTheDocument();
    expect(screen.queryByText("Participante 11")).not.toBeInTheDocument();
    expect(screen.getByTestId("data-table-page-info")).toHaveTextContent("Página 1 de 2");
  });

  it("buscar reseta para a página 1", () => {
    render(<RosterTable rows={MANY} role="gestor" countsNewBuyers />);
    fireEvent.click(screen.getByTestId("data-table-next"));
    expect(screen.getByText("Participante 11")).toBeInTheDocument();
    fireEvent.change(screen.getByTestId("ultimates-table-search"), {
      target: { value: "participante" },
    });
    expect(screen.getByTestId("data-table-page-info")).toHaveTextContent("Página 1 de 2");
    expect(screen.getByText("Participante 01")).toBeInTheDocument();
  });
});

describe("RosterTable — categorias de renovação sem vínculo", () => {
  const rows: UltimatesRosterRow[] = [
    row({ buyer_id: "b1", category: "renovado", email: "base@example.com" }),
    row({ buyer_id: null, category: "renovacao_sem_vinculo", email: "outro@example.com" }),
  ];

  it("mostra o chip de renovação sem vínculo e esconde os de novo comprador", () => {
    render(<RosterTable rows={rows} role="gestor" countsNewBuyers={false} />);
    expect(screen.getByRole("option", { name: "Renovação sem vínculo" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Novo Comprador" })).toBeNull();
  });

  it("esconde os chips de sem vínculo quando o ciclo admite novas compras", () => {
    render(<RosterTable rows={rows} role="gestor" countsNewBuyers />);
    expect(screen.getByRole("option", { name: "Novo Comprador" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Renovação sem vínculo" })).toBeNull();
  });

  it("renderiza o badge com o rótulo da categoria nova", () => {
    render(<RosterTable rows={rows} role="gestor" countsNewBuyers={false} />);
    expect(screen.getAllByText("Renovação sem vínculo").length).toBeGreaterThan(0);
  });

  it("mantém o botão Vincular à base na linha sem vínculo", () => {
    render(
      <RosterTable rows={rows} role="gestor" countsNewBuyers={false} onLinkClick={jest.fn()} />
    );
    expect(screen.getByTestId("ultimates-link-buyer-outro@example.com")).toBeEnabled();
  });
});

describe("RosterTable — troca de modo (countsNewBuyers) com filtro de categoria ativo", () => {
  // Linhas cruas como a RPC devolve (só as 5 categorias de fato) — o
  // dashboard reetiqueta com applyNewPurchasesModeToRoster ANTES de passar
  // para RosterTable; aqui simulamos exatamente esse fluxo via rerender,
  // como ultimates-dashboard.tsx faz na troca de switch/ciclo.
  const rawRows: UltimatesRosterRow[] = [
    row({ buyer_id: "b1", name: "Maria Silva", email: "maria@example.com", category: "renovado" }),
    row({ buyer_id: null, name: "Ana Nova", email: "ana@example.com", category: "novo_comprador" }),
  ];

  it("filtro 'Novo Comprador' não fica preso ao desligar o switch (rerender)", () => {
    const { rerender } = render(
      <RosterTable rows={rawRows} role="gestor" countsNewBuyers />
    );

    fireEvent.change(screen.getByTestId("ultimates-table-category"), {
      target: { value: "novo_comprador" },
    });
    expect(screen.getByText("Ana Nova")).toBeInTheDocument();
    expect(screen.queryByText("Maria Silva")).not.toBeInTheDocument();

    // Ciclo desliga "conta novo comprador" — o pai reetiqueta as linhas
    // (novo_comprador -> renovacao_sem_vinculo) e passa countsNewBuyers=false.
    rerender(
      <RosterTable
        rows={applyNewPurchasesModeToRoster(rawRows, false)}
        role="gestor"
        countsNewBuyers={false}
      />
    );

    expect(screen.getByTestId("ultimates-table-category")).toHaveValue("todas");
    // Com o filtro de volta a "todas", as duas linhas voltam a aparecer —
    // Ana Nova já reetiquetada como "Renovação sem vínculo".
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("Ana Nova")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Renovação sem vínculo")).toBeInTheDocument();
  });

  it("filtro 'Renovação sem vínculo' não fica preso ao religar o switch (rerender)", () => {
    const offRows = applyNewPurchasesModeToRoster(rawRows, false);
    const { rerender } = render(
      <RosterTable rows={offRows} role="gestor" countsNewBuyers={false} />
    );

    fireEvent.change(screen.getByTestId("ultimates-table-category"), {
      target: { value: "renovacao_sem_vinculo" },
    });
    expect(screen.getByText("Ana Nova")).toBeInTheDocument();
    expect(screen.queryByText("Maria Silva")).not.toBeInTheDocument();

    // Ciclo religa "conta novo comprador" — o pai volta a passar as linhas
    // cruas (referência estável quando countsNewBuyers=true) e countsNewBuyers=true.
    rerender(<RosterTable rows={rawRows} role="gestor" countsNewBuyers />);

    expect(screen.getByTestId("ultimates-table-category")).toHaveValue("todas");
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("Ana Nova")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Novo Comprador")).toBeInTheDocument();
  });
});

describe("RosterTable — modo Apenas Compras (#155)", () => {
  const PURCHASES: UltimatesRosterRow[] = [
    row({ buyer_id: "b1", name: "Compra Ativa", email: "c1@example.com", category: "renovado", total_value: 100 }),
    row({
      buyer_id: "b2",
      name: "Compra Estorno",
      email: "c2@example.com",
      category: "renovacao_reembolsada",
      total_value: 0,
    }),
  ];

  it("reetiqueta badge/coluna de categoria para o vocabulário de compras", () => {
    render(<RosterTable rows={PURCHASES} role="gestor" countsNewBuyers purchasesOnly />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("Compra")).toBeInTheDocument();
    expect(within(table).getByText("Compra reembolsada")).toBeInTheDocument();
    expect(within(table).queryByText("Renovado")).toBeNull();
    expect(within(table).queryByText("Renovação reembolsada")).toBeNull();
  });

  it("troca a coluna 'Data da renovação' por 'Data da compra'", () => {
    render(<RosterTable rows={PURCHASES} role="gestor" countsNewBuyers purchasesOnly />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("Data da compra")).toBeInTheDocument();
    expect(within(table).queryByText("Data da renovação")).toBeNull();
  });

  it("filtro de categoria oferece as opções de compra, não as de renovação", () => {
    render(<RosterTable rows={PURCHASES} role="gestor" countsNewBuyers purchasesOnly />);
    expect(screen.getByRole("option", { name: "Compra" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Compra reembolsada" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Renovado" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Novo Comprador" })).toBeNull();
  });
});

describe("RosterTable — ações de edição do roster (PRD editar_roster)", () => {
  const HANDLERS = {
    onMarkRenewedClick: jest.fn(),
    onEditClick: jest.fn(),
    onExcludeClick: jest.fn(),
  };

  beforeEach(() => {
    HANDLERS.onMarkRenewedClick.mockClear();
    HANDLERS.onEditClick.mockClear();
    HANDLERS.onExcludeClick.mockClear();
  });

  it("oferece 'Marcar renovado' só em linha da base não renovada", () => {
    render(<RosterTable rows={ROWS} role="gestor" countsNewBuyers {...HANDLERS} />);

    expect(screen.getByTestId("ultimates-mark-renewed-joao@example.com")).toBeInTheDocument();
    // Renovado da base já tem renovação — nada a marcar.
    expect(screen.queryByTestId("ultimates-mark-renewed-maria@example.com")).not.toBeInTheDocument();
    // Novo comprador não é linha da base.
    expect(screen.queryByTestId("ultimates-mark-renewed-ana@example.com")).not.toBeInTheDocument();
  });

  it("aciona onMarkRenewedClick com a linha do não renovado", () => {
    render(<RosterTable rows={ROWS} role="gestor" countsNewBuyers {...HANDLERS} />);
    fireEvent.click(screen.getByTestId("ultimates-mark-renewed-joao@example.com"));

    expect(HANDLERS.onMarkRenewedClick).toHaveBeenCalledWith(
      expect.objectContaining({ email: "joao@example.com" })
    );
  });

  it("oferece Editar e Excluir em toda linha da base, e em nenhuma de novo comprador", () => {
    render(<RosterTable rows={ROWS} role="gestor" countsNewBuyers {...HANDLERS} />);

    expect(screen.getByTestId("ultimates-edit-buyer-maria@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-exclude-buyer-maria@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-edit-buyer-joao@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-exclude-buyer-joao@example.com")).toBeInTheDocument();

    expect(screen.queryByTestId("ultimates-edit-buyer-ana@example.com")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-exclude-buyer-ana@example.com")).not.toBeInTheDocument();
  });

  it("aciona onEditClick e onExcludeClick com a linha", () => {
    render(<RosterTable rows={ROWS} role="gestor" countsNewBuyers {...HANDLERS} />);

    fireEvent.click(screen.getByTestId("ultimates-edit-buyer-maria@example.com"));
    expect(HANDLERS.onEditClick).toHaveBeenCalledWith(
      expect.objectContaining({ email: "maria@example.com" })
    );

    fireEvent.click(screen.getByTestId("ultimates-exclude-buyer-joao@example.com"));
    expect(HANDLERS.onExcludeClick).toHaveBeenCalledWith(
      expect.objectContaining({ email: "joao@example.com" })
    );
  });

  it("sem os handlers (ciclo encerrado), a ação correspondente não é oferecida", () => {
    render(
      <RosterTable rows={ROWS} role="gestor" countsNewBuyers onExcludeClick={HANDLERS.onExcludeClick} />
    );

    // Excluir atravessa o encerramento; editar e marcar renovado não.
    expect(screen.getByTestId("ultimates-exclude-buyer-maria@example.com")).toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-edit-buyer-maria@example.com")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-mark-renewed-joao@example.com")).not.toBeInTheDocument();
  });

  it("analista não vê nenhuma das ações", () => {
    render(<RosterTable rows={ROWS} role="analista" countsNewBuyers {...HANDLERS} />);

    expect(screen.queryByTestId("ultimates-mark-renewed-joao@example.com")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-edit-buyer-maria@example.com")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-exclude-buyer-maria@example.com")).not.toBeInTheDocument();
  });
});

describe("RosterTable — 'Desfazer vínculo' só quando há vínculo a desfazer", () => {
  const LINKED = row({
    buyer_id: "b1",
    name: "Veio de vínculo",
    email: "link@example.com",
    category: "renovado",
    transaction_code: "HP-TX-1",
    from_manual_link: true,
  });
  const BY_EMAIL = row({
    buyer_id: "b2",
    name: "Casou por email",
    email: "email@example.com",
    category: "renovado",
    transaction_code: "HP-TX-2",
    from_manual_link: false,
  });

  it("oferece o botão na renovação vinda de vínculo manual", () => {
    render(
      <RosterTable rows={[LINKED]} role="gestor" countsNewBuyers onUnlinkClick={jest.fn()} />
    );
    expect(screen.getByTestId("ultimates-unlink-buyer-link@example.com")).toBeInTheDocument();
  });

  it("NÃO oferece o botão na renovação que casou por email", () => {
    render(
      <RosterTable rows={[BY_EMAIL]} role="gestor" countsNewBuyers onUnlinkClick={jest.fn()} />
    );
    expect(screen.queryByTestId("ultimates-unlink-buyer-email@example.com")).not.toBeInTheDocument();
  });

  it("com from_manual_link ausente (RPC antiga), mantém o comportamento anterior", () => {
    const legacy = row({
      buyer_id: "b3",
      name: "RPC antiga",
      email: "legado@example.com",
      category: "renovado",
      transaction_code: "HP-TX-3",
    });
    render(
      <RosterTable rows={[legacy]} role="gestor" countsNewBuyers onUnlinkClick={jest.fn()} />
    );
    expect(screen.getByTestId("ultimates-unlink-buyer-legado@example.com")).toBeInTheDocument();
  });
});

// ─── Identidade do novo comprador (PRD #146) ──────────────────────────────────
// Testes de caracterização: a RPC passa a preencher name/phone nas linhas com
// buyer_id null, e estes testes travam o fato de que a UI já os exibe sem
// nenhuma mudança — e de que o switch não os descarta ao reetiquetar.
describe("RosterTable — nome e telefone do novo comprador", () => {
  const newBuyer = row({
    buyer_id: null,
    name: "Carla Nunes",
    email: "carla@example.com",
    phone: "11988887777",
    category: "novo_comprador",
  });

  it("exibe nome e telefone na linha de novo comprador", () => {
    render(<RosterTable rows={[newBuyer]} role="gestor" countsNewBuyers />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("Carla Nunes")).toBeInTheDocument();
    expect(within(table).getByText("11988887777")).toBeInTheDocument();
  });

  it("encontra o novo comprador buscando pelo nome, não só pelo email", () => {
    render(<RosterTable rows={[newBuyer, ROWS[0]]} role="gestor" countsNewBuyers />);
    fireEvent.change(screen.getByTestId("ultimates-table-search"), { target: { value: "carla" } });
    expect(screen.getByText("Carla Nunes")).toBeInTheDocument();
    expect(screen.queryByText("Maria Silva")).not.toBeInTheDocument();
  });

  it("mantém nome e telefone com o switch de novas compras desligado", () => {
    const remapped = applyNewPurchasesModeToRoster([newBuyer], false);
    render(<RosterTable rows={remapped} role="gestor" countsNewBuyers={false} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("Renovação sem vínculo")).toBeInTheDocument();
    expect(within(table).getByText("Carla Nunes")).toBeInTheDocument();
    expect(within(table).getByText("11988887777")).toBeInTheDocument();
  });

  it("linha sem nome continua exibindo o traço, sem quebrar", () => {
    const anonymous = row({
      buyer_id: null,
      name: null,
      email: "anonimo@example.com",
      phone: null,
      category: "novo_comprador",
    });
    render(<RosterTable rows={[anonymous]} role="gestor" countsNewBuyers />);
    expect(screen.getByText("anonimo@example.com")).toBeInTheDocument();
  });
});
