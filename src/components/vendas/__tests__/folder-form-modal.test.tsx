/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FolderFormModal } from "../folder-form-modal";

describe("FolderFormModal", () => {
  it("renderiza modo de criação por padrão", () => {
    render(<FolderFormModal onSave={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByText("Nova pasta")).toBeInTheDocument();
    expect(screen.getByTestId("folder-form-submit")).toHaveTextContent("Criar pasta");
  });

  it("renderiza modo de edição com o nome preenchido", () => {
    const folderTarget = {
      id: "f1",
      name: "Pasta Existente",
      account_id: "acc-1",
      created_at: "2026-08-01T10:00:00Z",
      updated_at: "2026-08-01T10:00:00Z",
    };

    render(<FolderFormModal folderTarget={folderTarget} onSave={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByText("Renomear pasta")).toBeInTheDocument();
    expect(screen.getByTestId("folder-name-input")).toHaveValue("Pasta Existente");
    expect(screen.getByTestId("folder-form-submit")).toHaveTextContent("Salvar");
  });

  it("exibe mensagem de erro se o nome for submetido vazio", async () => {
    const onSave = jest.fn();
    render(<FolderFormModal onSave={onSave} onCancel={jest.fn()} />);

    fireEvent.click(screen.getByTestId("folder-form-submit"));

    expect(await screen.findByTestId("folder-form-error")).toHaveTextContent("Nome da pasta é obrigatório");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("chama onSave com o nome aparado (trimmed)", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<FolderFormModal onSave={onSave} onCancel={jest.fn()} />);

    fireEvent.change(screen.getByTestId("folder-name-input"), { target: { value: "  Minha Pasta  " } });
    fireEvent.click(screen.getByTestId("folder-form-submit"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("Minha Pasta");
    });
  });
});
