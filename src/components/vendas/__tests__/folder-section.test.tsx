/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FolderSection } from "../folder-section";
import type { FolderSectionGroup } from "../folder-section";
import type { VendasFolderRecord } from "@/types/vendas";

type Item = { id: string; name: string };
function mockView(id: string, name: string): Item {
  return { id, name };
}

function mockFolder(id: string, name: string): VendasFolderRecord {
  return {
    id,
    account_id: "acc-1",
    name,
    created_at: "2026-08-01T10:00:00Z",
    updated_at: "2026-08-01T10:00:00Z",
  };
}

describe("FolderSection", () => {
  it("renderiza o nome da pasta e contador de itens", () => {
    const group: FolderSectionGroup<Item> = {
      id: "f1",
      name: "Pasta Teste",
      isUnfolder: false,
      folder: mockFolder("f1", "Pasta Teste"),
      items: [mockView("c1", "Visualização 1")],
      isExpanded: false,
    };

    render(
      <FolderSection
        group={group}
        selectedId={null}
        isGestor={true}
        onSelect={jest.fn()}
        onToggleExpand={jest.fn()}
      />
    );

    expect(screen.getByText("Pasta Teste")).toBeInTheDocument();
    expect(screen.getByText("1 visualização")).toBeInTheDocument();
  });

  it("renderiza pills quando está expandido e permite selecionar item", () => {
    const onSelect = jest.fn();
    const group: FolderSectionGroup<Item> = {
      id: "f1",
      name: "Pasta Teste",
      isUnfolder: false,
      folder: mockFolder("f1", "Pasta Teste"),
      items: [mockView("c1", "Visualização 1")],
      isExpanded: true,
    };

    render(
      <FolderSection
        group={group}
        selectedId="c1"
        isGestor={true}
        onSelect={onSelect}
        onToggleExpand={jest.fn()}
      />
    );

    const pill = screen.getByTestId("vendas-view-option-c1");
    expect(pill).toBeInTheDocument();

    fireEvent.click(pill);
    expect(onSelect).toHaveBeenCalledWith("c1");
  });

  it("chama onToggleExpand ao clicar no header ou chevron", () => {
    const onToggleExpand = jest.fn();
    const group: FolderSectionGroup<Item> = {
      id: "f1",
      name: "Pasta Teste",
      isUnfolder: false,
      folder: mockFolder("f1", "Pasta Teste"),
      items: [],
      isExpanded: false,
    };

    render(
      <FolderSection
        group={group}
        selectedId={null}
        isGestor={true}
        onSelect={jest.fn()}
        onToggleExpand={onToggleExpand}
      />
    );

    fireEvent.click(screen.getByText("Pasta Teste"));
    expect(onToggleExpand).toHaveBeenCalledWith("f1");
  });
});
