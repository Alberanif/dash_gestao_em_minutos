/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DateRangeFilter } from "../date-range-filter";

function inputs() {
  return {
    start: screen.getByTestId("ultimates-date-start") as HTMLInputElement,
    end: screen.getByTestId("ultimates-date-end") as HTMLInputElement,
    apply: screen.getByTestId("ultimates-date-apply"),
  };
}

describe("DateRangeFilter", () => {
  it("aplica o intervalo preenchido", () => {
    const onChange = jest.fn();
    render(<DateRangeFilter value={null} onChange={onChange} />);

    const { start, end, apply } = inputs();
    fireEvent.change(start, { target: { value: "2026-07-10" } });
    fireEvent.change(end, { target: { value: "2026-07-20" } });
    fireEvent.click(apply);

    expect(onChange).toHaveBeenCalledWith({ start: "2026-07-10", end: "2026-07-20" });
  });

  it("recusa uma ponta só e não chama onChange", () => {
    const onChange = jest.fn();
    render(<DateRangeFilter value={null} onChange={onChange} />);

    const { start, apply } = inputs();
    fireEvent.change(start, { target: { value: "2026-07-10" } });
    fireEvent.click(apply);

    expect(screen.getByTestId("ultimates-date-error")).toHaveTextContent(
      "Preencha as duas datas"
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("recusa fim anterior ao início", () => {
    const onChange = jest.fn();
    render(<DateRangeFilter value={null} onChange={onChange} />);

    const { start, end, apply } = inputs();
    fireEvent.change(start, { target: { value: "2026-07-20" } });
    fireEvent.change(end, { target: { value: "2026-07-10" } });
    fireEvent.click(apply);

    expect(screen.getByTestId("ultimates-date-error")).toHaveTextContent(
      "A data final não pode ser anterior à inicial"
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("limpar devolve null e esvazia os campos", () => {
    const onChange = jest.fn();
    render(
      <DateRangeFilter value={{ start: "2026-07-10", end: "2026-07-20" }} onChange={onChange} />
    );

    fireEvent.click(screen.getByTestId("ultimates-date-clear"));

    expect(onChange).toHaveBeenCalledWith(null);
    expect((screen.getByTestId("ultimates-date-start") as HTMLInputElement).value).toBe("");
  });

  it("sem intervalo aplicado, não oferece Limpar", () => {
    render(<DateRangeFilter value={null} onChange={jest.fn()} />);
    expect(screen.queryByTestId("ultimates-date-clear")).not.toBeInTheDocument();
  });

  it("preenche os campos a partir do intervalo já aplicado", () => {
    render(
      <DateRangeFilter value={{ start: "2026-07-10", end: "2026-07-20" }} onChange={jest.fn()} />
    );
    expect((screen.getByTestId("ultimates-date-start") as HTMLInputElement).value).toBe(
      "2026-07-10"
    );
    expect((screen.getByTestId("ultimates-date-end") as HTMLInputElement).value).toBe(
      "2026-07-20"
    );
  });

  it("anuncia indisponibilidade e desabilita Aplicar", () => {
    render(<DateRangeFilter value={null} onChange={jest.fn()} unavailable />);
    expect(screen.getByTestId("ultimates-date-unavailable")).toBeInTheDocument();
    expect(screen.getByTestId("ultimates-date-apply")).toBeDisabled();
  });
});
