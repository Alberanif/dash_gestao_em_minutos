/** @jest-environment jsdom */
import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { EtapaIdentificacao } from "../eventos/novo-evento/etapa-identificacao";
import { EtapaTrafego } from "../eventos/novo-evento/etapa-trafego";
import { EtapaRevisao } from "../eventos/novo-evento/etapa-revisao";
import { estadoInicial, type EstadoAssistente, type EtapaId, type Problema } from "../eventos/novo-evento/estado";

let ultimo: EstadoAssistente;

function Controlado({
  inicial,
  children,
}: {
  inicial?: Partial<EstadoAssistente>;
  children: (p: { estado: EstadoAssistente; atualizar: (p: Partial<EstadoAssistente>) => void }) => React.ReactNode;
}) {
  const [estado, setEstado] = useState<EstadoAssistente>({ ...estadoInicial, ...inicial });
  ultimo = estado;
  return <>{children({ estado, atualizar: (p) => setEstado((s) => ({ ...s, ...p })) })}</>;
}

describe("EtapaIdentificacao", () => {
  const montar = (inicial?: Partial<EstadoAssistente>) =>
    render(<Controlado inicial={inicial}>{(p) => <EtapaIdentificacao {...p} />}</Controlado>);

  it("digitar o nome atualiza o estado e o campo começa focado", () => {
    montar();
    const campo = screen.getByLabelText("Nome do evento");
    expect(document.activeElement).toBe(campo);
    fireEvent.change(campo, { target: { value: "Imersão" } });
    expect(ultimo.nome).toBe("Imersão");
  });

  it("sem datas mostra a dica e nenhum erro", () => {
    montar();
    expect(screen.getByText("Deixe em branco para o dashboard abrir nos últimos 28 dias.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("datas válidas atualizam o estado sem erro", () => {
    montar();
    fireEvent.change(screen.getByLabelText("Data de início"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Data de fim"), { target: { value: "2026-01-10" } });
    expect(ultimo.inicio).toBe("2026-01-01");
    expect(ultimo.fim).toBe("2026-01-10");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("só uma data mostra erro junto às datas", () => {
    montar();
    fireEvent.change(screen.getByLabelText("Data de início"), { target: { value: "2026-01-01" } });
    expect(screen.getByRole("alert").textContent).toContain("Informe a data de início e a de fim do evento.");
    expect(screen.getByLabelText("Data de início").getAttribute("aria-invalid")).toBe("true");
  });

  it("início depois do fim mostra erro", () => {
    montar({ inicio: "2026-02-01", fim: "2026-01-01" });
    expect(screen.getByRole("alert").textContent).toContain("A data de início não pode ser depois da data de fim.");
  });
});

describe("EtapaTrafego", () => {
  const montar = (inicial?: Partial<EstadoAssistente>) =>
    render(<Controlado inicial={inicial}>{(p) => <EtapaTrafego {...p} />}</Controlado>);

  it("com um único termo não oferece remover", () => {
    montar();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Remover termo/ })).toBeNull();
  });

  it("adiciona um termo vazio e digita nele", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar termo" }));
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Termo 2"), { target: { value: "camp" } });
    expect(ultimo.termos).toEqual(["", "camp"]);
  });

  it("remove a linha escolhida e nunca deixa menos de um campo", () => {
    montar({ termos: ["a", "b"] });
    fireEvent.click(screen.getByRole("button", { name: "Remover termo 1" }));
    expect(ultimo.termos).toEqual(["b"]);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Remover termo/ })).toBeNull();
  });

  it("explica que é opcional e como o termo casa", () => {
    montar();
    expect(screen.getByText(/Etapa opcional/).textContent).toContain("contém o termo");
  });
});

describe("EtapaRevisao", () => {
  const produto = { product_id: "10", product_name: "Mentoria" };
  const montar = (
    inicial: Partial<EstadoAssistente>,
    problemas: Problema[] = [],
    aviso: string | null = null,
  ) => {
    const ir = jest.fn<void, [EtapaId]>();
    render(
      <Controlado inicial={inicial}>
        {(p) => <EtapaRevisao {...p} problemas={problemas} aviso={aviso} irParaEtapa={ir} />}
      </Controlado>,
    );
    return ir;
  };

  it("pago: mostra tipo, produtos de captura, período padrão e ofertas", () => {
    montar({
      nome: "Imersão",
      produtosCaptura: [produto],
      eventosLeads: ["lp"],
      produtosPrincipais: [
        { product_id: "1", product_name: "Curso", offer_codes: [] },
        { product_id: "2", product_name: "Clube", offer_codes: ["a", "b", "c"] },
      ],
      termos: ["camp", ""],
    });
    expect(screen.getByText("Evento pago")).toBeTruthy();
    expect(screen.getByText("Últimos 28 dias")).toBeTruthy();
    expect(screen.getByText("Mentoria")).toBeTruthy();
    expect(screen.getByText(/Todas as ofertas/)).toBeTruthy();
    expect(screen.getByText(/3 ofertas/)).toBeTruthy();
    expect(screen.getByText("camp")).toBeTruthy();
    expect(screen.getByText("Tudo certo: está pronto para criar.")).toBeTruthy();
  });

  it("orgânico: mostra o tipo e diz que o produto de captura não é usado", () => {
    montar({ nome: "X", organico: true, produtosCaptura: [produto], eventosLeads: ["lp"] });
    expect(screen.getByText("Captação orgânica")).toBeTruthy();
    expect(screen.getByText("Produtos de captura não usados")).toBeTruthy();
    expect(screen.queryByText("Mentoria")).toBeNull();
  });

  it("período preenchido aparece formatado", () => {
    montar({ nome: "X", inicio: "2026-01-05", fim: "2026-01-20" });
    expect(screen.getByText("05/01/2026 a 20/01/2026")).toBeTruthy();
  });

  it("Editar leva à etapa certa de cada bloco", () => {
    const ir = montar({ nome: "X" });
    fireEvent.click(screen.getByRole("button", { name: "Editar Nome e período" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar Captação" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar Produto principal" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar Tráfego" }));
    expect(ir.mock.calls.map((c) => c[0])).toEqual(["identificacao", "captacao", "produto", "trafego"]);
  });

  it("problemas ficam em alerta com atalho para a etapa", () => {
    const ir = montar({}, [
      { etapa: "identificacao", mensagem: "Dê um nome ao evento." },
      { etapa: "captacao", mensagem: "Escolha uma fonte." },
    ]);
    expect(screen.getByRole("alert").textContent).toContain("Dê um nome ao evento.");
    expect(screen.queryByText(/pronto para criar/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Resolver em Captação" }));
    expect(ir).toHaveBeenCalledWith("captacao");
    fireEvent.click(screen.getByRole("button", { name: "Resolver em Identificação" }));
    expect(ir).toHaveBeenCalledWith("identificacao");
  });

  it("aviso aparece como status sem esconder a confirmação", () => {
    montar({ nome: "X" }, [], "dados de Meta Ads serão zerados no dashboard.");
    expect(screen.getByRole("status").textContent).toContain("dados de Meta Ads serão zerados no dashboard.");
    expect(screen.getByText("Tudo certo: está pronto para criar.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
