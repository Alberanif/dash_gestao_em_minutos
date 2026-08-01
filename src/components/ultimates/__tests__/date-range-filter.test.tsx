/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DateRangeFilter } from "../date-range-filter";

const JANELA = { start: "2026-07-10", end: "2026-07-20" };

function inputs() {
  return {
    start: screen.getByTestId("ultimates-date-start") as HTMLInputElement,
    end: screen.getByTestId("ultimates-date-end") as HTMLInputElement,
    apply: screen.getByTestId("ultimates-date-apply"),
  };
}

describe("DateRangeFilter — gestor", () => {
  it("salva o intervalo preenchido", async () => {
    const onSave = jest.fn().mockResolvedValue(true);
    render(<DateRangeFilter value={null} canEdit onSave={onSave} />);

    const { start, end, apply } = inputs();
    fireEvent.change(start, { target: { value: "2026-07-10" } });
    fireEvent.change(end, { target: { value: "2026-07-20" } });
    fireEvent.click(apply);

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(JANELA));
  });

  it("recusa uma ponta só e não chama onSave", () => {
    const onSave = jest.fn().mockResolvedValue(true);
    render(<DateRangeFilter value={null} canEdit onSave={onSave} />);

    const { start, apply } = inputs();
    fireEvent.change(start, { target: { value: "2026-07-10" } });
    fireEvent.click(apply);

    expect(screen.getByTestId("ultimates-date-error")).toHaveTextContent(
      "Preencha as duas datas"
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("recusa fim anterior ao início", () => {
    const onSave = jest.fn().mockResolvedValue(true);
    render(<DateRangeFilter value={null} canEdit onSave={onSave} />);

    const { start, end, apply } = inputs();
    fireEvent.change(start, { target: { value: "2026-07-20" } });
    fireEvent.change(end, { target: { value: "2026-07-10" } });
    fireEvent.click(apply);

    expect(screen.getByTestId("ultimates-date-error")).toHaveTextContent(
      "A data final não pode ser anterior à inicial"
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("limpar manda null e esvazia os campos", async () => {
    const onSave = jest.fn().mockResolvedValue(true);
    render(<DateRangeFilter value={JANELA} canEdit onSave={onSave} />);

    fireEvent.click(screen.getByTestId("ultimates-date-clear"));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
    expect((screen.getByTestId("ultimates-date-start") as HTMLInputElement).value).toBe("");
  });

  it("sem janela salva, não oferece Limpar", () => {
    render(<DateRangeFilter value={null} canEdit onSave={jest.fn().mockResolvedValue(true)} />);
    expect(screen.queryByTestId("ultimates-date-clear")).not.toBeInTheDocument();
  });

  it("preenche os campos a partir da janela salva", () => {
    render(<DateRangeFilter value={JANELA} canEdit onSave={jest.fn().mockResolvedValue(true)} />);
    expect((screen.getByTestId("ultimates-date-start") as HTMLInputElement).value).toBe(
      "2026-07-10"
    );
    expect((screen.getByTestId("ultimates-date-end") as HTMLInputElement).value).toBe(
      "2026-07-20"
    );
  });

  it("diz que o período vale para todo mundo — não é filtro pessoal", () => {
    render(<DateRangeFilter value={null} canEdit onSave={jest.fn().mockResolvedValue(true)} />);
    expect(screen.getByTestId("ultimates-date-scope")).toHaveTextContent(
      "Vale para todos os usuários"
    );
  });

  it("falha ao salvar avisa e PRESERVA o rascunho", async () => {
    const onSave = jest.fn().mockResolvedValue(false);
    render(<DateRangeFilter value={null} canEdit onSave={onSave} />);

    const { start, end, apply } = inputs();
    fireEvent.change(start, { target: { value: "2026-07-10" } });
    fireEvent.change(end, { target: { value: "2026-07-20" } });
    fireEvent.click(apply);

    expect(await screen.findByTestId("ultimates-date-error")).toHaveTextContent(
      "Não foi possível salvar o período"
    );
    // Quem escolheu duas datas e esbarrou na rede não deve reescolhê-las.
    expect((screen.getByTestId("ultimates-date-start") as HTMLInputElement).value).toBe(
      "2026-07-10"
    );
  });

  it("trava os controles enquanto grava", async () => {
    let resolver: (ok: boolean) => void = () => {};
    const onSave = jest.fn(() => new Promise<boolean>((r) => (resolver = r)));
    render(<DateRangeFilter value={null} canEdit onSave={onSave} />);

    const { start, end, apply } = inputs();
    fireEvent.change(start, { target: { value: "2026-07-10" } });
    fireEvent.change(end, { target: { value: "2026-07-20" } });
    fireEvent.click(apply);

    expect(apply).toBeDisabled();
    expect(apply).toHaveTextContent("Salvando...");

    resolver(true);
    await waitFor(() => expect(apply).not.toBeDisabled());
  });

  it("aviso de recorte não aplicado aparece em vermelho", () => {
    render(
      <DateRangeFilter value={JANELA} canEdit onSave={jest.fn().mockResolvedValue(true)} unavailable />
    );
    expect(screen.getByTestId("ultimates-date-unavailable")).toHaveTextContent(
      "os números abaixo são do ciclo inteiro"
    );
  });
});

describe("DateRangeFilter — quem não edita", () => {
  it("mostra a janela como texto, com autoria e sem controles", () => {
    render(
      <DateRangeFilter value={JANELA} canEdit={false} onSave={jest.fn().mockResolvedValue(true)} />
    );

    expect(screen.getByTestId("ultimates-date-readonly")).toHaveTextContent(
      "Período: 10/07/2026 – 20/07/2026"
    );
    expect(screen.getByText("definido pelo gestor")).toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-date-start")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-date-apply")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ultimates-date-clear")).not.toBeInTheDocument();
  });

  it("sem janela definida, a barra inteira some", () => {
    const { container } = render(
      <DateRangeFilter value={null} canEdit={false} onSave={jest.fn().mockResolvedValue(true)} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("recebe o aviso de recorte não aplicado — é quem não tem como descobrir sozinho", () => {
    render(
      <DateRangeFilter
        value={JANELA}
        canEdit={false}
        onSave={jest.fn().mockResolvedValue(true)}
        unavailable
      />
    );
    expect(screen.getByTestId("ultimates-date-unavailable")).toBeInTheDocument();
  });
});
