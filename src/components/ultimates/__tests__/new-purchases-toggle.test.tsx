/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { NewPurchasesToggle } from "../new-purchases-toggle";

describe("NewPurchasesToggle", () => {
  it("reflete o estado ligado em aria-checked", () => {
    render(<NewPurchasesToggle checked disabled={false} onChange={jest.fn()} />);
    expect(screen.getByTestId("ultimates-new-purchases-toggle")).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("reflete o estado desligado em aria-checked", () => {
    render(<NewPurchasesToggle checked={false} disabled={false} onChange={jest.fn()} />);
    expect(screen.getByTestId("ultimates-new-purchases-toggle")).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("mostra o rótulo Novas Compras", () => {
    render(<NewPurchasesToggle checked disabled={false} onChange={jest.fn()} />);
    expect(screen.getByTestId("ultimates-new-purchases-toggle")).toHaveTextContent(
      "Novas Compras"
    );
  });

  it("pede o valor invertido ao clicar", async () => {
    const onChange = jest.fn().mockResolvedValue(true);
    render(<NewPurchasesToggle checked disabled={false} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("ultimates-new-purchases-toggle"));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(false));
  });

  it("não mostra feedback quando o salvamento dá certo", async () => {
    const onChange = jest.fn().mockResolvedValue(true);
    render(<NewPurchasesToggle checked disabled={false} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("ultimates-new-purchases-toggle"));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(screen.queryByTestId("ultimates-new-purchases-feedback")).toBeNull();
  });

  it("mostra o erro quando o salvamento falha", async () => {
    const onChange = jest.fn().mockResolvedValue(false);
    render(<NewPurchasesToggle checked disabled={false} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("ultimates-new-purchases-toggle"));
    expect(await screen.findByTestId("ultimates-new-purchases-feedback")).toHaveTextContent(
      "Não foi possível salvar a configuração."
    );
  });

  it("limpa o erro anterior numa nova tentativa bem sucedida", async () => {
    const onChange = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<NewPurchasesToggle checked disabled={false} onChange={onChange} />);
    const button = screen.getByTestId("ultimates-new-purchases-toggle");

    fireEvent.click(button);
    expect(await screen.findByTestId("ultimates-new-purchases-feedback")).toBeInTheDocument();

    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.queryByTestId("ultimates-new-purchases-feedback")).toBeNull()
    );
  });

  it("fica travado e não chama onChange quando desabilitado", () => {
    const onChange = jest.fn();
    render(<NewPurchasesToggle checked disabled onChange={onChange} />);
    const button = screen.getByTestId("ultimates-new-purchases-toggle");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Indisponível");
    fireEvent.click(button);
    expect(onChange).not.toHaveBeenCalled();
  });
});
