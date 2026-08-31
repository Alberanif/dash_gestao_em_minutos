/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FolderSection } from "../folder-section";
import type { CycleGroup } from "@/lib/vendas/group-cycles";
import type { CycleWithProducts } from "../types";
import type { VendasFolderRecord } from "@/types/vendas";

function mockCycle(id: string, name: string): CycleWithProducts {
  return {
    id,
    name,
    account_id: "acc-1",
    goal_percent: 80,
    status: "ativo",
    counts_new_buyers: true,
    purchases_only: false,
    folder_id: "f1",
    refresh_started_at: null,
    last_refresh_at: null,
    created_by: "user-1",
    created_at: "2026-08-01T10:00:00Z",
    updated_at: "2026-08-01T10:00:00Z",
    products: [],
  };
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
  it("renderiza o nome da pasta e contador de ciclos", () => {
    const group: CycleGroup = {
      id: "f1",
      name: "Pasta Teste",
      isUnfolder: false,
      folder: mockFolder("f1", "Pasta Teste"),
      cycles: [mockCycle("c1", "Ciclo 1")],
      isExpanded: false,
    };

    render(
      <FolderSection
        group={group}
        selectedCycleId={null}
        isGestor={true}
        onSelectCycle={jest.fn()}
        onToggleExpand={jest.fn()}
      />
    );

    expect(screen.getByText("Pasta Teste")).toBeInTheDocument();
    expect(screen.getByText("1 ciclo")).toBeInTheDocument();
  });

  it("renderiza pills quando está expandido e permite selecionar ciclo", () => {
    const onSelectCycle = jest.fn();
    const group: CycleGroup = {
      id: "f1",
      name: "Pasta Teste",
      isUnfolder: false,
      folder: mockFolder("f1", "Pasta Teste"),
      cycles: [mockCycle("c1", "Ciclo 1")],
      isExpanded: true,
    };

    render(
      <FolderSection
        group={group}
        selectedCycleId="c1"
        isGestor={true}
        onSelectCycle={onSelectCycle}
        onToggleExpand={jest.fn()}
      />
    );

    const pill = screen.getByTestId("ultimates-cycle-option-c1");
    expect(pill).toBeInTheDocument();

    fireEvent.click(pill);
    expect(onSelectCycle).toHaveBeenCalledWith("c1");
  });

  it("chama onToggleExpand ao clicar no header ou chevron", () => {
    const onToggleExpand = jest.fn();
    const group: CycleGroup = {
      id: "f1",
      name: "Pasta Teste",
      isUnfolder: false,
      folder: mockFolder("f1", "Pasta Teste"),
      cycles: [],
      isExpanded: false,
    };

    render(
      <FolderSection
        group={group}
        selectedCycleId={null}
        isGestor={true}
        onSelectCycle={jest.fn()}
        onToggleExpand={onToggleExpand}
      />
    );

    fireEvent.click(screen.getByText("Pasta Teste"));
    expect(onToggleExpand).toHaveBeenCalledWith("f1");
  });
});
