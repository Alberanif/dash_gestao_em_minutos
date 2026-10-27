/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Campo, Confirmar, Input, Selo, Tabela, Td, Th } from "../ui";
import { V2Root } from "../ui/v2-root";
import { mockReducedMotion } from "./helpers";

beforeAll(() => mockReducedMotion(false));

describe("Campo", () => {
  it("liga o rótulo ao controle e a ajuda ao aria-describedby", () => {
    render(
      <Campo rotulo="Conta" ajuda="Obrigatório" erro>
        {(p) => <Input {...p} />}
      </Campo>,
    );
    const input = screen.getByLabelText("Conta");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent).toBe("Obrigatório");
  });

  it("sem erro nem ajuda não marca aria-invalid nem aria-describedby", () => {
    render(<Campo rotulo="Nome">{(p) => <Input {...p} />}</Campo>);
    const input = screen.getByLabelText("Nome");
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(input.hasAttribute("aria-describedby")).toBe(false);
  });
});

describe("Selo e Tabela", () => {
  it("selo mostra o texto do estado", () => {
    render(<Selo tom="ok">Ativa</Selo>);
    expect(screen.getByText("Ativa")).toBeTruthy();
  });

  it("tabela tem cabeçalhos de coluna", () => {
    render(
      <Tabela>
        <thead>
          <tr>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <Td>ok</Td>
          </tr>
        </tbody>
      </Tabela>,
    );
    expect(screen.getByRole("columnheader", { name: "Status" })).toBeTruthy();
  });
});

describe("Confirmar", () => {
  const renderizar = (extra: Partial<React.ComponentProps<typeof Confirmar>> = {}) => {
    const onConfirmar = jest.fn();
    const onFechar = jest.fn();
    render(
      <V2Root>
        <Confirmar aberto onFechar={onFechar} onConfirmar={onConfirmar} titulo="Excluir a conta X?" rotuloConfirmar="Excluir" {...extra} />
      </V2Root>,
    );
    return { onConfirmar, onFechar };
  };

  it("só executa a ação ao clicar no botão com o verbo", () => {
    const { onConfirmar } = renderizar();
    expect(onConfirmar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(onConfirmar).toHaveBeenCalledTimes(1);
  });

  it("Cancelar fecha sem confirmar", () => {
    const { onConfirmar, onFechar } = renderizar();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onFechar).toHaveBeenCalled();
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it("desabilita a confirmação enquanto carrega", () => {
    renderizar({ carregando: true });
    expect((screen.getByRole("button", { name: "Aguarde…" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
